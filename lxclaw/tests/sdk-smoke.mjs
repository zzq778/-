// Interoperability smoke using the published standard MCP client, not the test JSON-RPC client.
import {Client} from '../../.mcp-smoke/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '../../.mcp-smoke/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const server=fileURLToPath(new URL('../mcp-server/server.mjs',import.meta.url));
const client=new Client({name:'jzzx-sdk-smoke',version:'1.0.0'},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:[server,'--mode','local']});
await client.connect(transport);
try{
 const list=await client.listTools();assert.ok(list.tools.some(x=>x.name==='jzzx_plan_trip'));
 const r=await client.callTool({name:'jzzx_plan_trip',arguments:{requirements:'延边两天民俗美食'}});
 assert.ok(!r.isError);const x=JSON.parse(r.content[0].text);assert.equal(x.status,'complete');assert.equal(x.itinerary.days,2);assert.ok(x.check.ok);
 console.log('Published MCP SDK transport, discovery and tool call PASS');
}finally{await client.close()}
