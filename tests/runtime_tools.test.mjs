import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeTools} from '../src/runtime-tools.mjs';
import {runProductAgent} from '../src/product-agent.mjs';
const json=x=>new Response(JSON.stringify(x),{status:200});
const forecast={daily:{time:['2026-11-18'],temperature_2m_min:[-8],temperature_2m_max:[2],precipitation_probability_max:[20],weather_code:[3]}};
test('runtime tools are absent without configuration; weather validates response and scope',async()=>{
 assert.equal(runtimeTools({}).length,0);let calls=0;
 const [weather]=runtimeTools({WEATHER_ENABLED:'true'},async(u,opts)=>{calls++;assert.equal(u.hostname,'api.open-meteo.com');assert.equal(u.searchParams.get('timezone'),'Asia/Shanghai');assert.equal(opts.redirect,'error');return json(forecast)});
 assert.equal((await weather.run({region:'unknown'})).error,'UNKNOWN_REGION');const r=await weather.run({region:'吉林市'});assert.equal(calls,1);assert.equal(r.forecast[0].minC,-8);assert.match(r.scope,/不是景区/);
});
test('search uses fixed provider, strips unsafe URLs, and rejects sensitive query',async()=>{
 const [search]=runtimeTools({BRAVE_SEARCH_KEY:'testing-key-123'},async(u,opts)=>{assert.equal(u.hostname,'api.search.brave.com');assert.equal(opts.headers['X-Subscription-Token'],'testing-key-123');return json({web:{results:[{url:'https://www.jl.gov.cn/',title:'<b>吉林</b>',description:'<em>资料</em>'},{url:'javascript:alert(1)',title:'fake'},{url:'http://127.0.0.1/',title:'local'}]}})});
 assert.equal((await search.run({query:'电话13812345678'})).error,'QUERY_REJECTED');const r=await search.run({query:'吉林旅游'});assert.equal(r.results.length,1);assert.equal(r.results[0].title,'吉林');assert.equal(r.sources[0].url,'https://www.jl.gov.cn/');
});
test('agent consumes actual weather result, and no provider capability is invented',async()=>{
 let n=0;const runtime=runtimeTools({WEATHER_ENABLED:'true'},async()=>json(forecast));
 const call=(name,args)=>({tool_calls:[{id:name,function:{name,arguments:JSON.stringify(args)}}]});
 const result=await runProductAgent({question:'吉林市天气',runtime,invoke:async(messages,tools)=>{if(n++===0){assert.ok(tools.some(t=>t.function.name==='weather_forecast'));return call('weather_forecast',{region:'吉林市'})}assert.match(messages.at(-1).content,/"minC":-8/);return call('reply',{text:'最低温度为-8度，城区预报。'})}});
 assert.equal(result.status,'complete');assert.equal(result.sources[0].url,'https://open-meteo.com/');
 const denied=await runProductAgent({question:'天气',invoke:async()=>call('weather_forecast',{region:'吉林市'})});assert.equal(denied.status,'unavailable');
});
