// Keep one Workers AI adapter for both user-facing tool loops.
// Logs contain only structural metadata, never input, model text, arguments or credentials.
export async function normalizeModelResult(value){
 let raw=value;
 for(let i=0;i<3;i++){
  if(raw instanceof Response){if(!raw.ok)throw Error('MODEL_HTTP_ERROR');raw=await raw.json();continue}
  if(typeof raw==='string'){try{raw=JSON.parse(raw);continue}catch{return {response:raw}}}
  if(raw&&typeof raw==='object'&&!raw.choices&&!raw.tool_calls&&!raw.message){
   if(raw.result&&typeof raw.result==='object'){raw=raw.result;continue}
   if(raw.response&&typeof raw.response==='object'){raw=raw.response;continue}
  }
  break;
 }
 return raw;
}
export function workersModel(env,model,route,maxTokens,temperature){
 return async (messages,tools)=>{
  const begin=Date.now(),names=tools.map(t=>t.function.name);
  try{
   const input={messages,tools,tool_choice:'required',parallel_tool_calls:route==='chat',max_completion_tokens:maxTokens,temperature,chat_template_kwargs:{enable_thinking:false}};
   let output;
   try{output=await env.AI.run(model,input)}
   catch(e){
    // One retry for transient upstream failure; the caller's original deadline remains binding.
    if(e?.name!=='InferenceUpstreamError')throw e;
    console.warn(JSON.stringify({event:'jzzx-model-retry',route,ms:Date.now()-begin}));
    await new Promise(r=>setTimeout(r,400));output=await env.AI.run(model,input);
   }
   const raw=await normalizeModelResult(output);
   const msg=raw?.choices?.[0]?.message??raw?.message??raw;
   const count=Array.isArray(msg?.tool_calls??raw?.tool_calls)?(msg?.tool_calls??raw?.tool_calls).length:0;
   console.info(JSON.stringify({event:'jzzx-model',route,ms:Date.now()-begin,tools:names,toolCount:count,format:Array.isArray(raw?.choices)?'choices':raw?.tool_calls?'direct':'other'}));
   return raw;
  }catch(e){
   console.warn(JSON.stringify({event:'jzzx-model-error',route,ms:Date.now()-begin,name:String(e?.name||'Error').slice(0,40),code:typeof e?.code==='number'?e.code:undefined}));
   throw e;
  }
 };
}
