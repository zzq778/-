import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const html=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const md=v=>String(v??'').replace(/[\r\n]+/g,' ').replace(/[|]/g,'\\|');
const csv=v=>'"'+String(v??'').replace(/^[=+\-@\t\r]/,"'$&").replace(/"/g,'""')+'"';
export async function saveArtifact(folder,kind,ext,data){
 const root=resolve(folder);await mkdir(root,{recursive:true});
 const name=kind+'-'+randomUUID()+'.'+ext,path=join(root,name);
 await writeFile(path,data,{flag:'wx',mode:0o600});
 return {path,filename:name,bytes:Buffer.byteLength(data)};
}
const safeSource=s=>{try{const u=new URL(s.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};
export async function tripReport(folder,it){
 const body=it.plan.map(d=>'<section><h2>'+html(d.title)+'</h2>'+d.nodes.map(n=>'<article><h3>'+html(n.slot)+' · '+html(n.name)+'</h3><p>'+html(n.caveat)+'</p><p>开放：'+html(n.hours||'官方核实')+'　票价：'+html(n.ticket||'官方核实')+'</p></article>').join('')+'</section>').join('');
 const links=it.sources.map(s=>{const url=safeSource(s);return url?'<li><a href="'+html(url)+'" rel="noopener noreferrer">'+html(s.label)+'</a></li>':''}).join('');
 const page='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+html(it.title)+'</title><style>body{font:16px/1.7 system-ui,sans-serif;color:#233e34;background:#faf9f4;max-width:760px;margin:32px auto;padding:0 20px}h1{font-size:30px}h2{border-bottom:1px solid #b9cabe;padding-bottom:8px}article{padding:6px 0}h3{margin-bottom:4px}p{margin:5px 0}a{color:#205e4f}@media print{body{background:white}}</style><h1>'+html(it.title)+'</h1><p>吉政知行 · 候选行程，非实时交通与票务核验</p>'+body+'<h2>出行提醒</h2><ul>'+[...it.warnings.map(x=>x.message),...it.tips].map(x=>'<li>'+html(x)+'</li>').join('')+'</ul><h2>参考来源</h2><ul>'+links+'</ul></html>';
 return saveArtifact(folder,'itinerary','html',page);
}
export async function feedbackReport(folder,s){
 if(!Array.isArray(s.categories)||!s.categories.every(c=>['total','answered','pending'].every(k=>Number.isInteger(c[k])&&c[k]>=0)))throw Error('INVALID_SUMMARY');
 const rows=s.categories.map(c=>[c.category,c.total,c.answered,c.pending]);
 const text='# 文旅反馈统计\n\n'+md(s.environment||'云端授权业务')+'\n\n范围：'+md(s.region)+' · '+md(s.scope)+'\n\n统计时间：'+md(s.asOf)+'\n\n合计：'+s.total+' 条；已答复 '+s.answered+' 条；待答复 '+s.pending+' 条。\n\n| 类别 | 总数 | 已答复 | 待答复 |\n|---|---:|---:|---:|\n'+rows.map(r=>'| '+r.map(md).join(' | ')+' |').join('\n')+'\n\n说明：统计来自数据库全量授权范围，不等于行业满意度或整改完成率。\n';
 const table='\ufeff'+[['类别','总数','已答复','待答复'],...rows].map(r=>r.map(csv).join(',')).join('\r\n')+'\r\n';
 return {report:await saveArtifact(folder,'feedback-report','md',text),table:await saveArtifact(folder,'feedback-summary','csv',table),environment:s.environment||'云端授权业务'};
}
