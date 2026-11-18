import {runProductAgent} from './product-agent.mjs';
const schema={type:'function',function:{name:'read_feedback_summary',description:'读取当前已授权商户或地区反馈的真实汇总。仅有分类数量和答复状态，没有原始反馈或个人资料。',parameters:{type:'object',properties:{},required:[],additionalProperties:false}}};
export async function analyzeFeedback(env,summary,question){
 if(!env.AI||!env.LIMITER)return {status:'partial',text:'智能分析暂不可用。下方为已核验的反馈统计。'};
 const invoke=(messages,tools)=>env.AI.run('@cf/zai-org/glm-4.7-flash',{messages,tools,tool_choice:'required',parallel_tool_calls:false,max_completion_tokens:650,temperature:.2,chat_template_kwargs:{enable_thinking:false}});
 let read=false;
 const out=await runProductAgent({question,region:summary.region,invoke,budgetMs:22000,pageContext:'\n当前工作台为获授权的反馈分析。仅分析 read_feedback_summary 返回的实际统计，区分数量与推断；不要输出单条投诉、身份或未核实经营结论。',runtime:[{schema,run:()=>{read=true;return summary}}]});
 if(!read||out.status!=='complete')return {status:'partial',text:'智能分析未完成。下方仍为真实反馈统计。'};
 return {status:'complete',text:out.text};
}
