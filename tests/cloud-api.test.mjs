import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/cloud-api.ts'],bundle:true,platform:'node',format:'esm',outfile:'.sites-runtime/tests/api.mjs'});
const {login,session,generate,imageTask,limit}=await import('../.sites-runtime/tests/api.mjs');
const tasks=new Map(),counts=new Map(),files=new Map();
const env={ACCESS_PASSWORD:'test-access-only',SESSION_SECRET:'test-session-only',ARK_API_KEY:'test-key',DB:{prepare(sql){return {bind(...values){return {async first(){
 if(sql.startsWith('INSERT INTO request_counters')){const [id,max]=values,n=counts.get(id)||0;if(n>=max)return null;counts.set(id,n+1);return {count:n+1};}
 if(sql.startsWith('SELECT * FROM image_tasks')){const v=tasks.get(values[0]);return v?.owner===values[1]?v:null;}
 if(sql.startsWith('SELECT owner'))return tasks.get(values[0])||null;
 if(sql.startsWith('INSERT OR IGNORE')){const [id,owner,digest,status,created,result]=values;if(tasks.has(id))return null;tasks.set(id,{id,owner,digest,status,created,result});return {id};}
 throw new Error('Unexpected SQL: '+sql);
 },async run(){const [status,result,id,owner]=values;const v=tasks.get(id);assert.equal(v.owner,owner);Object.assign(v,{status,result});}};}}}},BUCKET:{async put(k,v){files.set(k,v)},async get(k){const v=files.get(k);return v?{arrayBuffer:async()=>v}:null}}};
const request=new Request('https://test.local/api/login',{headers:{'CF-Connecting-IP':'127.0.0.1'}});
await assert.rejects(()=>login(request,env,{password:'wrong'}),e=>e.status===401);
const response=await login(request,env,{password:'test-access-only'}),cookie=response.headers.get('Set-Cookie').split(';')[0];
assert(cookie.includes('zaoxing_session='));assert(response.headers.get('Set-Cookie').includes('HttpOnly'));
const authed=new Request('https://test.local/api/status',{headers:{Cookie:cookie}}),owner=await session(authed,env);assert(owner);
assert.equal(await session(request,env),null);
assert.equal(await session(new Request('https://test.local',{headers:{Cookie:cookie+'x'}}),env),null);
const renewed=await login(authed,env,{password:'test-access-only'});assert(renewed.headers.get('Set-Cookie').includes(owner));
let calls=0;const realFetch=globalThis.fetch;
globalThis.fetch=async()=>{calls++;return Response.json({data:[{b64_json:Buffer.from('89504e470d0a1a0a','hex').toString('base64')}]})};
const payload={requestId:'test-image-123456',prompt:'a test character',w:1024,h:1536,images:[]};
assert.equal((await generate(env,owner,payload)).status,'succeeded');
assert.equal((await generate(env,owner,payload)).status,'succeeded');assert.equal(calls,1);
assert((await imageTask(env,owner,payload.requestId)).src.startsWith('data:image/png;base64,'));
assert.equal((await imageTask(env,'other-user',payload.requestId)).status,'missing');
await assert.rejects(()=>generate(env,owner,{...payload,prompt:'changed'}),e=>e.status===409);
await assert.rejects(()=>generate(env,owner,{...payload,w:1}),e=>e.status===400);
await assert.rejects(()=>generate(env,owner,{...payload,images:['https://private.example/secret']}),e=>e.status===400);
globalThis.fetch=async()=>{calls++;return Response.json({error:{code:'InvalidRequest',message:'DO NOT ECHO PROVIDER CONTENT'}},{status:400})};
const failed={...payload,requestId:'test-image-654321'};assert.equal((await generate(env,owner,failed)).status,'failed');
const failure=await imageTask(env,owner,failed.requestId);assert(!JSON.stringify(failure).includes('DO NOT ECHO'));assert.equal(failure.errorDetails.httpStatus,400);
await limit(env,'one-only',1);await assert.rejects(()=>limit(env,'one-only',1),e=>e.status===429);
globalThis.fetch=realFetch;
console.log('PASS: access authentication, session reuse, task isolation, idempotency, validation, provider error redaction and quotas.');
