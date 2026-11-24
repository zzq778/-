(function(){
'use strict';
const $=id=>document.getElementById(id),status=$('studioStatus'),form=$('studioForm'),button=$('studioGenerate'),image=$('studioImage'),result=$('studioResult');
let ready=false,busy=false,base64='';
function note(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
try{const raw=sessionStorage.getItem('jzzx-poster-draft-v1');if(raw){sessionStorage.removeItem('jzzx-poster-draft-v1');const d=JSON.parse(raw);if(typeof d.prompt==='string')$('studioPrompt').value=d.prompt.slice(0,1200)}}catch{}
async function check(){
 try{const r=await fetch('/api/v1/images/status',{cache:'no-store',signal:AbortSignal.timeout(8000)});ready=r.ok&&(await r.json()).ready===true}catch{ready=false}
 button.disabled=!ready;note(ready?'核对素材描述后即可生成。':'素材生成服务暂不可用。仍可编辑描述或复制到其他创作工具。',!ready);
}
function decode(value){if(typeof value!=='string'||value.length>4200000||!/^\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(value))return null;try{const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));return bytes.length>=12&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217?bytes:null}catch{return null}}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||!ready||!$('studioConsent').checked)return;
 const prompt=$('studioPrompt').value.trim(),code=$('studioCode').value.trim();
 if(!prompt||code.length<32){note('请输入素材描述和有效的服务凭证。',true);return}
 busy=true;button.disabled=true;$('studioConsent').checked=false;note('正在生成素材…');
 try{
  const r=await fetch('/api/v1/images',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+code},body:JSON.stringify({prompt,confirm:true}),signal:AbortSignal.timeout(38000)});
  const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(r.status===401?'素材凭证不正确。':r.status===429?'请求过多，请稍后再试。':'图片暂未生成，请核对后重试。');
  if(x.status!=='complete'||x.mime!=='image/jpeg'||!decode(x.base64))throw Error('返回的图片数据无效。');
  await new Promise((resolve,reject)=>{const probe=new Image();probe.onload=resolve;probe.onerror=()=>reject(Error('暂时无法打开生成的图片。'));probe.src='data:image/jpeg;base64,'+x.base64;});
  base64=x.base64;image.src='data:image/jpeg;base64,'+base64;result.hidden=false;note('素材已生成。');
 }catch(e){note(e.message||'图片暂未生成，请重试。',true)}
 finally{busy=false;button.disabled=!ready;$('studioCode').value='';}
});
$('studioSave').addEventListener('click',()=>{
 if(!base64)return;const bytes=decode(base64);if(!bytes){note('素材无法保存。',true);return}
 const name='吉林文旅创意-'+Date.now()+'.jpg';
 if(window.JZZXNativeFiles?.save){window.JZZXNativeFiles.save('image/jpeg',name,base64);note('请在系统保存窗口选择位置。');return}
 const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);note('已发起图片下载。');
});
check();
})();
