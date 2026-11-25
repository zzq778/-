#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "cJSON.h"
#include "driver/i2s_std.h"
#include "esp_crt_bundle.h"
#include "esp_event.h"
#include "esp_http_client.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "nvs_flash.h"

#define SAMPLE_RATE 16000
#define FRAME_SAMPLES 128
#define FRAME_WORDS (FRAME_SAMPLES * 2)
#define MAX_SAMPLES (SAMPLE_RATE * CONFIG_JZX_MAX_TURN_SECONDS)
#define WAV_HEADER_SIZE 44
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1

static const char *TAG = "jzx_voice";
static EventGroupHandle_t s_wifi_events;
static int s_wifi_retry;
static i2s_chan_handle_t s_tx;
static i2s_chan_handle_t s_rx;
static int16_t s_audio[MAX_SAMPLES];
static size_t s_audio_count;
static cJSON *s_history;

static void put_u16(uint8_t *p, uint16_t v) { p[0]=(uint8_t)v; p[1]=(uint8_t)(v>>8); }
static void put_u32(uint8_t *p, uint32_t v) { p[0]=(uint8_t)v; p[1]=(uint8_t)(v>>8); p[2]=(uint8_t)(v>>16); p[3]=(uint8_t)(v>>24); }
static uint16_t get_u16(const uint8_t *p) { return (uint16_t)(p[0] | ((uint16_t)p[1]<<8)); }
static uint32_t get_u32(const uint8_t *p) { return (uint32_t)p[0] | ((uint32_t)p[1]<<8) | ((uint32_t)p[2]<<16) | ((uint32_t)p[3]<<24); }

static void make_wav_header(uint8_t h[WAV_HEADER_SIZE], uint32_t samples) {
    const uint32_t data_bytes = samples * sizeof(int16_t);
    memcpy(h, "RIFF", 4); put_u32(h+4, 36+data_bytes); memcpy(h+8, "WAVEfmt ", 8);
    put_u32(h+16, 16); put_u16(h+20, 1); put_u16(h+22, 1);
    put_u32(h+24, SAMPLE_RATE); put_u32(h+28, SAMPLE_RATE*2);
    put_u16(h+32, 2); put_u16(h+34, 16); memcpy(h+36, "data", 4); put_u32(h+40, data_bytes);
}

static void wifi_event(void *arg, esp_event_base_t base, int32_t id, void *data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) esp_wifi_connect();
    else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_wifi_retry++ < 8) esp_wifi_connect();
        else xEventGroupSetBits(s_wifi_events, WIFI_FAIL_BIT);
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        s_wifi_retry = 0; xEventGroupSetBits(s_wifi_events, WIFI_CONNECTED_BIT);
    }
}

static bool wifi_start(void) {
    s_wifi_events = xEventGroupCreate();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event, NULL));
    wifi_config_t wifi = {0};
    snprintf((char *)wifi.sta.ssid, sizeof(wifi.sta.ssid), "%s", CONFIG_JZX_WIFI_SSID);
    snprintf((char *)wifi.sta.password, sizeof(wifi.sta.password), "%s", CONFIG_JZX_WIFI_PASSWORD);
    wifi.sta.threshold.authmode = WIFI_AUTH_OPEN;
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi));
    ESP_ERROR_CHECK(esp_wifi_start());
    EventBits_t bits = xEventGroupWaitBits(s_wifi_events, WIFI_CONNECTED_BIT|WIFI_FAIL_BIT, pdFALSE, pdFALSE, pdMS_TO_TICKS(30000));
    if (!(bits & WIFI_CONNECTED_BIT)) ESP_LOGE(TAG, "Wi-Fi connection failed");
    else ESP_LOGI(TAG, "Wi-Fi connected");
    return (bits & WIFI_CONNECTED_BIT) != 0;
}

static void i2s_start(void) {
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    ESP_ERROR_CHECK(i2s_new_channel(&chan_cfg, &s_tx, &s_rx));
    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(SAMPLE_RATE),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = GPIO_NUM_4,
            .ws = GPIO_NUM_5,
            .dout = GPIO_NUM_7,
            .din = GPIO_NUM_6,
            .invert_flags = { .mclk_inv=false, .bclk_inv=false, .ws_inv=false }
        }
    };
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(s_tx, &std_cfg));
    ESP_ERROR_CHECK(i2s_channel_init_std_mode(s_rx, &std_cfg));
    ESP_ERROR_CHECK(i2s_channel_enable(s_tx));
    ESP_ERROR_CHECK(i2s_channel_enable(s_rx));
}

static esp_http_client_handle_t make_https_client(const char *url, esp_http_client_method_t method) {
    esp_http_client_config_t cfg = {
        .url = url,
        .method = method,
        .timeout_ms = 60000,
        .buffer_size = 2048,
        .crt_bundle_attach = esp_crt_bundle_attach
    };
    return esp_http_client_init(&cfg);
}

static esp_err_t http_write_all(esp_http_client_handle_t client, const void *data, int len) {
    const char *p = (const char *)data;
    while (len > 0) {
        int n = esp_http_client_write(client, p, len);
        if (n <= 0) return ESP_FAIL;
        p += n; len -= n;
    }
    return ESP_OK;
}

static bool play_wav_url(const char *url) {
    esp_http_client_handle_t client = make_https_client(url, HTTP_METHOD_GET);
    if (!client) return false;
    esp_err_t err = esp_http_client_open(client, 0);
    if (err != ESP_OK) { esp_http_client_cleanup(client); return false; }
    (void)esp_http_client_fetch_headers(client);
    if (esp_http_client_get_status_code(client) != 200) {
        esp_http_client_close(client); esp_http_client_cleanup(client); return false;
    }
    uint8_t header[WAV_HEADER_SIZE];
    int got=0;
    while (got < WAV_HEADER_SIZE) {
        int n=esp_http_client_read(client,(char *)header+got,WAV_HEADER_SIZE-got);
        if(n<=0) break;
        got+=n;
    }
    if(got!=WAV_HEADER_SIZE || memcmp(header,"RIFF",4) || memcmp(header+8,"WAVE",4) ||
       get_u16(header+20)!=1 || get_u16(header+34)!=16 || get_u32(header+24)!=SAMPLE_RATE) {
        ESP_LOGE(TAG,"Unsupported TTS WAV format");
        esp_http_client_close(client); esp_http_client_cleanup(client); return false;
    }
    const uint16_t channels=get_u16(header+22);
    if(channels<1 || channels>2) { esp_http_client_close(client); esp_http_client_cleanup(client); return false; }
    uint8_t in[1024];
    int32_t out[512];
    while (1) {
        int n=esp_http_client_read(client,(char *)in,sizeof(in));
        if(n<=0) break;
        n -= n % (2*channels);
        size_t frames=(size_t)n/(2*channels);
        for(size_t i=0;i<frames;i++) {
            int16_t sample=(int16_t)get_u16(in+i*2*channels);
            int32_t expanded=((int32_t)sample)<<16;
            out[i*2]=expanded;
            out[i*2+1]=expanded;
        }
        size_t written=0;
        if(i2s_channel_write(s_tx,out,frames*2*sizeof(int32_t),&written,portMAX_DELAY)!=ESP_OK) break;
    }
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    return true;
}

static bool upload_turn(void) {
    if (s_audio_count < SAMPLE_RATE/3) return false;
    char url[192];
    snprintf(url,sizeof(url),"%s/api/voice/turn",CONFIG_JZX_WORKER_URL);
    const char *boundary="----JZXVoiceBoundary7MA4YWxk";
    char part[256];
    int part_len=snprintf(part,sizeof(part),
        "--%s\r\\nContent-Disposition: form-data; name=\"region\"\r\\n\r\\n%s\r\\n"
        "--%s\r\\nContent-Disposition: form-data; name=\"history\"\r\\n\r\\n",
        boundary,CONFIG_JZX_REGION,boundary);
    if(!s_history) s_history=cJSON_CreateArray();
    char *history=cJSON_PrintUnformatted(s_history);
    if(!history) return false;
    size_t history_len=strlen(history);
    char tail[192];
    int tail_len=snprintf(tail,sizeof(tail),
        "\r\\n--%s\r\\nContent-Disposition: form-data; name=\"audio\"; filename=\"turn.wav\"\r\\nContent-Type: audio/wav\r\\n\r\\n",
        boundary);
    char endbuf[80];
    int end_len=snprintf(endbuf,sizeof(endbuf),"\r\\n--%s--\r\\n",boundary);
    uint8_t wav_header[WAV_HEADER_SIZE];
    make_wav_header(wav_header,(uint32_t)s_audio_count);
    size_t audio_len=WAV_HEADER_SIZE+s_audio_count*sizeof(int16_t);
    size_t body_len=(size_t)part_len+history_len+(size_t)tail_len+audio_len+(size_t)end_len;

    esp_http_client_handle_t client=make_https_client(url,HTTP_METHOD_POST);
    if(!client){free(history);return false;}
    char auth[160];
    snprintf(auth,sizeof(auth),"Bearer %s",CONFIG_JZX_DEVICE_TOKEN);
    char content_type[100];
    snprintf(content_type,sizeof(content_type),"multipart/form-data; boundary=%s",boundary);
    esp_http_client_set_header(client,"Authorization",auth);
    esp_http_client_set_header(client,"Content-Type",content_type);
    esp_err_t err=esp_http_client_open(client,(int)body_len);
    if(err==ESP_OK) err=http_write_all(client,part,part_len);
    if(err==ESP_OK) err=http_write_all(client,history,(int)history_len);
    if(err==ESP_OK) err=http_write_all(client,tail,tail_len);
    if(err==ESP_OK) err=http_write_all(client,wav_header,sizeof(wav_header));
    if(err==ESP_OK) err=http_write_all(client,s_audio,(int)(s_audio_count*sizeof(int16_t)));
    if(err==ESP_OK) err=http_write_all(client,endbuf,end_len);
    free(history);
    if(err!=ESP_OK){esp_http_client_close(client);esp_http_client_cleanup(client);return false;}
    int64_t response_len=esp_http_client_fetch_headers(client);
    if(esp_http_client_get_status_code(client)!=200 || response_len<=0 || response_len>8192){
        ESP_LOGE(TAG,"Voice endpoint HTTP %d",esp_http_client_get_status_code(client));
        esp_http_client_close(client);esp_http_client_cleanup(client);return false;
    }
    char *response=calloc(1,(size_t)response_len+1);
    if(!response){esp_http_client_close(client);esp_http_client_cleanup(client);return false;}
    int read=0;
    while(read<response_len){
        int n=esp_http_client_read(client,response+read,(int)response_len-read);
        if(n<=0)break;
        read+=n;
    }
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
    if(read<=0){free(response);return false;}
    cJSON *root=cJSON_Parse(response);
    free(response);
    if(!root)return false;
    const cJSON *transcript=cJSON_GetObjectItemCaseSensitive(root,"transcript");
    const cJSON *reply=cJSON_GetObjectItemCaseSensitive(root,"reply");
    const cJSON *audio=cJSON_GetObjectItemCaseSensitive(root,"audioUrl");
    bool ok=false;
    if(cJSON_IsString(transcript)&&cJSON_IsString(reply)&&cJSON_IsString(audio)){
        ESP_LOGI(TAG,"用户：%s",transcript->valuestring);
        ESP_LOGI(TAG,"吉小知：%s",reply->valuestring);
        cJSON_AddItemToArray(s_history,cJSON_CreateObject());
        cJSON *last=cJSON_GetArrayItem(s_history,cJSON_GetArraySize(s_history)-1);
        cJSON_AddStringToObject(last,"role","user");
        cJSON_AddStringToObject(last,"content",transcript->valuestring);
        cJSON_AddItemToArray(s_history,cJSON_CreateObject());
        last=cJSON_GetArrayItem(s_history,cJSON_GetArraySize(s_history)-1);
        cJSON_AddStringToObject(last,"role","assistant");
        cJSON_AddStringToObject(last,"content",reply->valuestring);
        while(cJSON_GetArraySize(s_history)>4)cJSON_DeleteItemFromArray(s_history,0);
        ok=play_wav_url(audio->valuestring);
    }
    cJSON_Delete(root);
    return ok;
}

static void audio_loop(void) {
    int32_t frame[FRAME_WORDS];
    bool recording=false;
    int silence_frames=0;
    const int silence_limit=(SAMPLE_RATE/FRAME_SAMPLES)*7/10;
    const int threshold=CONFIG_JZX_VAD_THRESHOLD;
    ESP_LOGI(TAG,"开始聆听：I2S 16 kHz，GPIO4/5 时钟，GPIO6 RX，GPIO7 TX");
    while(1){
        size_t bytes=0;
        esp_err_t err=i2s_channel_read(s_rx,frame,sizeof(frame),&bytes,portMAX_DELAY);
        if(err!=ESP_OK||bytes<sizeof(frame))continue;
        int64_t energy=0;
        int16_t mono[FRAME_SAMPLES];
        for(int i=0;i<FRAME_SAMPLES;i++){
            int32_t raw=frame[i*2];
            int16_t sample=(int16_t)(raw>>16);
            mono[i]=sample;
            energy+=(int32_t)sample*sample;
        }
        int rms=(int)sqrt((double)energy/FRAME_SAMPLES);
        if(!recording && rms>threshold){
            recording=true;
            s_audio_count=0;
            silence_frames=0;
            ESP_LOGI(TAG,"检测到语音");
        }
        if(recording){
            size_t copy=FRAME_SAMPLES;
            if(copy>MAX_SAMPLES-s_audio_count)copy=MAX_SAMPLES-s_audio_count;
            memcpy(s_audio+s_audio_count,mono,copy*sizeof(int16_t));
            s_audio_count+=copy;
            if(rms>threshold/2)silence_frames=0;
            else silence_frames++;
            if(silence_frames>=silence_limit||s_audio_count>=MAX_SAMPLES){
                recording=false;
                ESP_LOGI(TAG,"语音结束，时长 %.1f s，提交云端",s_audio_count/(float)SAMPLE_RATE);
                ESP_ERROR_CHECK(i2s_channel_disable(s_rx));
                bool ok=upload_turn();
                if(ok) ESP_LOGI(TAG,"播报完成，恢复聆听"); else ESP_LOGW(TAG,"本轮失败，恢复聆听");
                ESP_ERROR_CHECK(i2s_channel_enable(s_rx));
                silence_frames=0;
            }
        }
    }
}

void app_main(void) {
    ESP_ERROR_CHECK(nvs_flash_init());
    if(strlen(CONFIG_JZX_WIFI_SSID)==0||strlen(CONFIG_JZX_WORKER_URL)==0||strlen(CONFIG_JZX_DEVICE_TOKEN)<24){
        ESP_LOGE(TAG,"请在 menuconfig 配置 Wi-Fi、Worker API URL 和 VOICE_DEVICE_TOKEN");
        return;
    }
    if(!wifi_start()) return;
    i2s_start();
    audio_loop();
}
