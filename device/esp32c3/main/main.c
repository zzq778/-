#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

#include "driver/gpio.h"
#include "driver/i2s_std.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_spiffs.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#include "secrets.h"

// ESP32-C3: shared I2S BCLK and WS; TX and RX never enabled together.
// INMP441 L/R pin goes to GND (left channel).
#define PIN_BUTTON GPIO_NUM_3
#define PIN_I2S_BCLK GPIO_NUM_4
#define PIN_I2S_WS GPIO_NUM_5
#define PIN_I2S_MIC GPIO_NUM_6
#define PIN_I2S_SPEAKER GPIO_NUM_7

#define SAMPLE_RATE 16000
#define RECORD_SECONDS 3
#define RECORD_SAMPLES (SAMPLE_RATE * RECORD_SECONDS)
#define PCM_BYTES (RECORD_SAMPLES * 2)
#define MAX_RESPONSE_BYTES 960000
#define RECORDING_FILE "/spiffs/request.pcm"
#define WIFI_CONNECTED_BIT BIT0

static const char *TAG="jzzx-voice";
static EventGroupHandle_t wifi_events;
static i2s_chan_handle_t microphone;
static i2s_chan_handle_t speaker;
static int wifi_retries=0;

static void wifi_event(void *arg,esp_event_base_t base,int32_t id,void *data){
    if(base==WIFI_EVENT && id==WIFI_EVENT_STA_START){
        esp_wifi_connect();
    }else if(base==WIFI_EVENT && id==WIFI_EVENT_STA_DISCONNECTED){
        xEventGroupClearBits(wifi_events,WIFI_CONNECTED_BIT);
        if(wifi_retries++<3)esp_wifi_connect();
        ESP_LOGW(TAG,"Wi-Fi disconnected");
    }else if(base==IP_EVENT && id==IP_EVENT_STA_GOT_IP){
        wifi_retries=0;
        xEventGroupSetBits(wifi_events,WIFI_CONNECTED_BIT);
        ESP_LOGI(TAG,"Wi-Fi connected");
    }
}

static void start_wifi(void){
    wifi_events=xEventGroupCreate();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t init=WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&init));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT,ESP_EVENT_ANY_ID,wifi_event,NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT,IP_EVENT_STA_GOT_IP,wifi_event,NULL));
    wifi_config_t cfg={0};
    // Empty credentials must fail explicitly, rather than connect to an arbitrary network.
    if(strlen(JZZX_WIFI_SSID)==0||strlen(JZZX_WIFI_SSID)>32||
       strlen(JZZX_WIFI_PASSWORD)>63){
        ESP_LOGE(TAG,"Invalid Wi-Fi configuration");
        abort();
    }
    strncpy((char *)cfg.sta.ssid,JZZX_WIFI_SSID,sizeof(cfg.sta.ssid)-1);
    strncpy((char *)cfg.sta.password,JZZX_WIFI_PASSWORD,sizeof(cfg.sta.password)-1);
    cfg.sta.threshold.authmode=WIFI_AUTH_WPA2_PSK;
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA,&cfg));
    ESP_ERROR_CHECK(esp_wifi_start());
}

static void start_storage(void){
    const esp_vfs_spiffs_conf_t config={
        .base_path="/spiffs",.partition_label="storage",
        .max_files=2,.format_if_mount_failed=true
    };
    ESP_ERROR_CHECK(esp_vfs_spiffs_register(&config));
}

static void start_audio(void){
    i2s_chan_config_t channel=I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0,I2S_ROLE_MASTER);
    ESP_ERROR_CHECK(i2s_new_channel(&channel,NULL,&microphone));
    // Mono 32-bit slots preserve INMP441's left-justified 24-bit sample.
    i2s_std_config_t mic_config={
        .clk_cfg=I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
        .slot_cfg=I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT,I2S_SLOT_MODE_MONO),
        .gpio_cfg={
            .mclk=I2S_GPIO_UNUSED,.bclk=PIN_I2S_BCLK,.ws=PIN_I2S_WS,
            .dout=I2S_GPIO_UNUSED,.din=PIN_I2S_MIC
        }
    };
    mic_config.slot_cfg.slot_mask=I2S_STD_SLOT_LEFT;
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(microphone,&mic_config));

    // ESP32-C3 allows independent simplex RX/TX channels on one controller.
    ESP_ERROR_CHECK(i2s_new_channel(&channel,&speaker,NULL));
    i2s_std_config_t output={
        .clk_cfg=I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
        .slot_cfg=I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT,I2S_SLOT_MODE_STEREO),
        .gpio_cfg={
            .mclk=I2S_GPIO_UNUSED,.bclk=PIN_I2S_BCLK,.ws=PIN_I2S_WS,
            .dout=PIN_I2S_SPEAKER,.din=I2S_GPIO_UNUSED
        }
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(speaker,&output));
}

static bool record_three_seconds(void){
    FILE *file=fopen(RECORDING_FILE,"wb");
    if(!file){ESP_LOGE(TAG,"Cannot open recording file");return false;}
    esp_err_t err=i2s_channel_enable(microphone);
    if(err!=ESP_OK){fclose(file);return false;}
    ESP_LOGI(TAG,"Recording for %d seconds",RECORD_SECONDS);
    uint32_t raw[256];
    int16_t output[256];
    int remaining=RECORD_SAMPLES;
    bool ok=true;
    while(remaining>0){
        size_t bytes=0;
        size_t wanted=(size_t)(remaining>256?256:remaining)*sizeof(uint32_t);
        err=i2s_channel_read(microphone,raw,wanted,&bytes,pdMS_TO_TICKS(800));
        if(err!=ESP_OK||bytes==0||bytes%4){ok=false;break;}
        const size_t samples=bytes/4;
        for(size_t i=0;i<samples;i++){
            output[i]=(int16_t)(((int32_t)raw[i])>>16);
        }
        if(fwrite(output,sizeof(int16_t),samples,file)!=samples){ok=false;break;}
        remaining-=(int)samples;
    }
    i2s_channel_disable(microphone);
    if(fclose(file)!=0)ok=false;
    if(!ok||remaining){remove(RECORDING_FILE);ESP_LOGE(TAG,"Recording failed");return false;}
    return true;
}

static bool write_all(esp_http_client_handle_t client,const char *buffer,int count){
    int pos=0;
    while(pos<count){
        int wrote=esp_http_client_write(client,buffer+pos,count-pos);
        if(wrote<=0)return false;
        pos+=wrote;
    }
    return true;
}

static bool play_pcm_response(esp_http_client_handle_t client,int content_length){
    if(content_length<2||content_length>MAX_RESPONSE_BYTES||content_length%2)return false;
    if(i2s_channel_enable(speaker)!=ESP_OK)return false;
    char incoming[1024];
    int16_t stereo[1024]; // two channels for each input sample
    int remaining=content_length,received=0;
    bool ok=true;
    while(remaining>0){
        const int requested=remaining>(int)sizeof(incoming)?sizeof(incoming):remaining;
        int count=esp_http_client_read(client,incoming,requested);
        if(count<=0||count%2){ok=false;break;}
        for(int i=0;i<count/2;i++){
            const uint16_t lo=(uint8_t)incoming[2*i];
            const uint16_t hi=(uint8_t)incoming[2*i+1];
            const int16_t sample=(int16_t)((hi<<8)|lo);
            stereo[2*i]=sample;stereo[2*i+1]=sample;
        }
        const size_t bytes=(size_t)count*2;
        size_t written=0;
        if(i2s_channel_write(speaker,stereo,bytes,&written,pdMS_TO_TICKS(2000))!=ESP_OK||written!=bytes){
            ok=false;break;
        }
        received+=count;remaining-=count;
    }
    i2s_channel_disable(speaker);
    ESP_LOGI(TAG,"Playback %s (%d bytes)",ok&&remaining==0?"complete":"failed",received);
    return ok&&remaining==0;
}

static bool ask_cloud(void){
    EventBits_t bits=xEventGroupWaitBits(wifi_events,WIFI_CONNECTED_BIT,pdFALSE,pdTRUE,pdMS_TO_TICKS(15000));
    if(!(bits&WIFI_CONNECTED_BIT)){ESP_LOGE(TAG,"No Wi-Fi connection");return false;}
    FILE *file=fopen(RECORDING_FILE,"rb");
    if(!file)return false;
    struct stat st;
    if(stat(RECORDING_FILE,&st)!=0||st.st_size!=PCM_BYTES){fclose(file);return false;}
    esp_http_client_config_t config={
        .url=JZZX_DEVICE_URL,.method=HTTP_METHOD_POST,
        .timeout_ms=65000,.crt_bundle_attach=esp_crt_bundle_attach,
        .buffer_size=2048,.buffer_size_tx=2048
    };
    esp_http_client_handle_t http=esp_http_client_init(&config);
    if(!http){fclose(file);return false;}
    char authorization[200];
    int len=snprintf(authorization,sizeof(authorization),"Bearer %s",JZZX_DEVICE_CODE);
    bool ok=false;
    if(len<=7||len>=(int)sizeof(authorization)){ESP_LOGE(TAG,"Invalid device code");goto cleanup;}
    ESP_ERROR_CHECK(esp_http_client_set_header(http,"Authorization",authorization));
    ESP_ERROR_CHECK(esp_http_client_set_header(http,"Content-Type","application/octet-stream"));
    // POST a known Content-Length; do not buffer audio in RAM for HTTPS.
    if(esp_http_client_open(http,PCM_BYTES)!=ESP_OK){ESP_LOGE(TAG,"HTTPS connection failed");goto cleanup;}
    char buffer[1024];
    size_t total=0;
    while(total<PCM_BYTES){
        size_t n=fread(buffer,1,sizeof(buffer),file);
        if(!n||!write_all(http,buffer,(int)n)){ESP_LOGE(TAG,"Upload failed");goto cleanup;}
        total+=n;
    }
    if(esp_http_client_fetch_headers(http)<0){ESP_LOGE(TAG,"Response timeout");goto cleanup;}
    int status=esp_http_client_get_status_code(http);
    if(status!=200){
        char error[120]={0};
        int count=esp_http_client_read(http,error,sizeof(error)-1);
        if(count>0)error[count]=0;
        ESP_LOGE(TAG,"Server HTTP %d: %s",status,error);
        goto cleanup;
    }
    int response_length=esp_http_client_get_content_length(http);
    ESP_LOGI(TAG,"Playing cloud response: %d bytes",response_length);
    ok=play_pcm_response(http,response_length);
cleanup:
    memset(authorization,0,sizeof(authorization));
    fclose(file);
    esp_http_client_close(http);
    esp_http_client_cleanup(http);
    return ok;
}

void app_main(void){
    ESP_ERROR_CHECK(nvs_flash_init());
    start_storage();
    start_audio();
    gpio_config_t button={
        .pin_bit_mask=1ULL<<PIN_BUTTON,.mode=GPIO_MODE_INPUT,
        .pull_up_en=GPIO_PULLUP_ENABLE,.pull_down_en=GPIO_PULLDOWN_DISABLE,
        .intr_type=GPIO_INTR_DISABLE
    };
    ESP_ERROR_CHECK(gpio_config(&button));
    start_wifi();
    ESP_LOGI(TAG,"Ready. Press GPIO3 button once: record 3 s, then ask 吉小知.");
    while(true){
        if(gpio_get_level(PIN_BUTTON)==0){
            vTaskDelay(pdMS_TO_TICKS(40)); // Debounce
            if(gpio_get_level(PIN_BUTTON)==0){
                if(record_three_seconds())ask_cloud();
                // One request per press: wait for release before accepting another.
                while(gpio_get_level(PIN_BUTTON)==0)vTaskDelay(pdMS_TO_TICKS(30));
            }
        }
        vTaskDelay(pdMS_TO_TICKS(30));
    }
}
