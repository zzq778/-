// A model may echo pseudo-tool syntax even when asked to answer in plain text.
// Only human-readable reply content is allowed across the API boundary.
export function visibleChatText(raw) {
 if(typeof raw!=='string')return '';
 let value=raw.trim();
 const hasToolSyntax=/<\|(?:tool_call|im_start|im_end|function_call)[^>]*\|>|call\s*:\s*[a-z_]+\s*\{/i.test(value);
 if(hasToolSyntax){
  const match=value.match(/call\s*:\s*reply\s*\{\s*(?:content|text)\s*:\s*("(?:\\.|[^"\\])*")/is);
  if(!match)return '';
  try{value=JSON.parse(match[1]);}catch{return '';}
  if(typeof value!=='string')return '';
 }
 // Do not disclose control tokens or embedded model/tool instructions as user text.
 if(/<\|[^<>]{1,120}\|>|call\s*:\s*[a-z_]+\s*\{/i.test(value))return '';
 value=value
  .replace(/\r\n?/g,'\n')
  .replace(/^\s{0,3}#{1,6}\s+/gm,'')
  .replace(/\*\*([\s\S]*?)\*\*/g,'$1')
  .replace(/__([^\n]*?)__/g,'$1')
  .replace(/^\s*[-*]\s+/gm,'• ')
  .replace(/\[([^\]\n]{1,140})\]\(https?:\/\/[^)\s]+\)/g,'$1')
  .replace(/\n{3,}/g,'\n\n')
  .trim();
 if(!value||/<\|[^<>]{1,120}\|>|call\s*:\s*[a-z_]+\s*\{/i.test(value))return '';
 return value.slice(0,1800);
}
