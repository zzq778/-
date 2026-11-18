(function(){
'use strict';
const root=document.getElementById('onlinePortal'),cats=['服务态度','设施与环境','价格与收费','安全问题','其他'],labels={tourist:'游客',merchant:'商户',government:'管理人员'};
let key='',actor=null,items=[],merchants=[],busy=false,ready=null,flash='',failed=false,draft=null,requests=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{const raw=sessionStorage.getItem('jzzx-feedback-draft-v1');if(raw){sessionStorage.removeItem('jzzx-feedback-draft-v1');const d=JSON.parse(raw);if(cats.includes(d.category)&&typeof d.text==='string'&&d.text.trim())draft={category:d.category,text:d.text.slice(0,400)}}}catch{}
const errorMessage=code=>({AUTH_REQUIRED:'业务凭证不正确。',FORBIDDEN:'当前身份无权执行此操作。',PORTAL_NOT_CONFIGURED:'联网反馈服务暂不可用。',RATE_LIMIT:'请求过多，请稍后再试。',MERCHANT_NOT_FOUND:'该商户当前无法接收反馈。',REQUEST_ID_CONFLICT:'请求内容发生冲突，请刷新后重试。',NOT_FOUND:'没有可访问的记录。'})[code]||'服务暂不可用，请稍后重试。';
async function api(path,body,auth=true){
 const headers={accept:'application/json'};if(auth)headers.authorization='Bearer '+key;if(body)headers['content-type']='application/json';
 const r=await fetch('/api/v1/portal/'+path,{method:body?'POST':'GET',headers,...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:AbortSignal.timeout(12000)});
 const x=await r.json().catch(()=>({}));if(!r.ok)throw Error(errorMessage(x.error));return x;
}
function render(){
 const head='<header><h1>联网文旅反馈</h1><p class="op-note">仅面向已获得业务访问权限的用户。非政府官方受理平台。</p></header>';
 if(!actor){root.innerHTML=head+(ready===false?'<p role="status" class="op-error">联网反馈服务暂不可用。您仍可使用本机工作台记录问题。</p><div class="op-actions"><button type="button" data-op="check">重新连接</button></div>':'<form id="op-login"><label for="op-key">业务访问凭证</label><input id="op-key" type="password" required autocomplete="off" maxlength="160" placeholder="请输入已获发的业务凭证"><div class="op-actions"><button type="submit">登录</button></div></form>')+(draft?'<section class="op-section"><h2>待核对的反馈草稿</h2><p>'+esc(draft.text)+'</p><p class="op-note">此草稿还没有提交。</p></section>':'')+'<p class="op-flash" role="status">'+esc(flash)+'</p>';return}
 const select=merchants.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+'</option>').join('');
 const create=actor.role==='tourist'?'<section class="op-section"><h2>提出反馈</h2>'+(merchants.length?'<form id="op-create"><label for="op-merchant">反馈对象</label><select id="op-merchant" required><option value="">请选择商户</option>'+select+'</select><label for="op-category">问题类型</label><select id="op-category">'+cats.map(c=>'<option '+(draft?.category===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select><label for="op-text">具体描述</label><textarea id="op-text" required maxlength="500" placeholder="请不要填写身份证号、密码等敏感资料">'+esc(draft?.text||'')+'</textarea><div class="op-actions"><button type="submit">确认提交反馈</button></div><p class="op-note">提交后，授权商户和所在地区管理人员可以查看并答复。</p></form>':'<p class="op-note">当前地区没有已开放的商户，暂不能提交反馈。</p>')+'</section>':'';
 const list=items.map(f=>'<article class="op-item"><h3>'+esc(f.category)+' · '+esc(f.merchant_name)+'</h3><p class="op-meta">'+esc(f.created_at?.slice(0,16).replace('T',' '))+' · '+(f.status==='answered'?'已答复':'待答复')+'</p><p>'+esc(f.body)+'</p>'+f.replies.map(r=>'<div class="op-reply"><strong>'+esc(labels[r.actor_role]||'工作人员')+'答复</strong><p>'+esc(r.body)+'</p></div>').join('')+(actor.role!=='tourist'?'<form data-op-reply="'+esc(f.id)+'"><label>答复<textarea required maxlength="400" name="text"></textarea></label><button type="submit">确认发送</button></form>':'')+'</article>').join('');
 root.innerHTML=head+'<div class="op-note">'+esc(labels[actor.role])+' · '+esc(actor.region)+'</div><div class="op-actions"><button type="button" data-op="refresh" class="secondary">刷新记录</button><button type="button" data-op="logout" class="secondary">退出</button></div><p class="op-flash'+(failed?' op-error':'')+'" role="status">'+esc(flash)+'</p>'+create+'<section class="op-section"><h2>'+ (actor.role==='tourist'?'我的反馈':'反馈待办')+'</h2>'+(items.length?list:'<p class="op-note">'+(failed?'暂时无法读取记录。':'当前没有反馈。')+'</p>')+'</section>';
}
async function check(){try{ready=(await api('status',null,false)).ready===true}catch{ready=false}render()}
async function load(){const list=await api('feedback');if(!Array.isArray(list.items))throw Error('返回数据不完整。');const next=actor.role==='tourist'?await api('merchants'):{items:[]};if(!Array.isArray(next.items))throw Error('返回数据不完整。');items=list.items;merchants=next.items}
function notify(text,error=false){flash=text;failed=error;const e=root.querySelector('.op-flash');if(e){e.textContent=text;e.classList.toggle('op-error',error)}}
async function exclusive(fn){if(busy)return;busy=true;root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn()}catch(e){notify(e.message||'未能完成操作，请重试。',true)}finally{busy=false;root.querySelectorAll('button').forEach(b=>b.disabled=false)}}
function requestId(type,data){const signature=type+JSON.stringify(data);if(!requests.has(signature))requests.set(signature,crypto.randomUUID());return {signature,id:requests.get(signature)}}
root.addEventListener('submit',e=>{
 e.preventDefault();const form=e.target;
 if(form.id==='op-login'){exclusive(async()=>{const input=root.querySelector('#op-key');key=input.value.trim();input.value='';try{actor=await api('me');if(!labels[actor.role])throw Error('身份无效。');await load();flash='';failed=false;render()}catch(err){key='';actor=null;items=[];merchants=[];throw err}});return}
 if(!actor)return;
 if(form.id==='op-create'){exclusive(async()=>{const data={merchantId:root.querySelector('#op-merchant').value,category:root.querySelector('#op-category').value,text:root.querySelector('#op-text').value.trim()};if(!data.merchantId||!data.text)return;const req=requestId('feedback',data);const r=await api('feedback',{...data,requestId:req.id});if(r.status!=='stored')throw Error('未确认写入，请重试。');requests.delete(req.signature);draft=null;form.reset();try{await load();flash='反馈已提交。';failed=false;render()}catch{notify('反馈已提交，记录暂未刷新。请点击刷新。',true)}});return}
 if(form.dataset.opReply){exclusive(async()=>{const id=form.dataset.opReply,text=new FormData(form).get('text')?.trim();if(!text)return;const req=requestId(id,{text});const r=await api('feedback/'+encodeURIComponent(id)+'/replies',{text,requestId:req.id});if(r.status!=='stored')throw Error('未确认写入，请重试。');requests.delete(req.signature);form.reset();try{await load();flash='答复已发送。';failed=false;render()}catch{notify('答复已发送，记录暂未刷新。请点击刷新。',true)}})}
});
root.addEventListener('click',e=>{const action=e.target.closest('[data-op]')?.dataset.op;if(action==='check'){exclusive(check)}else if(action==='refresh'){exclusive(async()=>{await load();flash='';failed=false;render()})}else if(action==='logout'&&!busy){key='';actor=null;items=[];merchants=[];requests.clear();flash='';failed=false;render()}});
check();
})();
