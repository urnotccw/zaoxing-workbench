import prompts from './prompts.json';
type Data = Record<string, any>;
export class ApiError extends Error { constructor(message:string, public status=400, public details:Data={}) { super(message); } }
export const text=(v:unknown,n=3000)=>String(v??'').slice(0,n);
export const json=(value:unknown,status=200,headers:HeadersInit={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
export async function hash(value:string) { const a=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(a),x=>x.toString(16).padStart(2,'0')).join(''); }
async function sign(value:string,key:string) { const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join(''); }
export async function session(request:Request,env:Cloudflare.Env,allowExpired=false) {
 const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('zaoxing_session='))?.slice(16)||'';
 const [id,expires,signature]=token.split('.');
 if(!env.SESSION_SECRET||!id||!expires||!Number.isFinite(Number(expires))||(!allowExpired&&Number(expires)<Date.now())||Number(expires)>Date.now()+86401000)return null;
 if(!/^[a-f0-9-]{36}$/.test(id)||signature!==await sign(id+'.'+expires,env.SESSION_SECRET))return null;
 return id;
}
export async function login(request:Request,env:Cloudflare.Env,data:Data) {
 if(!env.ACCESS_PASSWORD||!env.SESSION_SECRET)throw new ApiError('在线访问口令尚未配置。',503);
 await limit(env,'login:'+await hash(request.headers.get('CF-Connecting-IP')||'unknown'),10,600000);
 if(await hash(text(data.password,200))!==await hash(env.ACCESS_PASSWORD))throw new ApiError('访问口令不正确，请向项目作者索取。',401);
 const id=await session(request,env,true)||crypto.randomUUID(),expires=String(Date.now()+86400000),payload=id+'.'+expires;
 return json({ok:true},200,{'Set-Cookie':`zaoxing_session=${payload}.${await sign(payload,env.SESSION_SECRET)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`});
}
export async function limit(env:Cloudflare.Env,kind:string,max:number,period=86400000) {
 if(!env.DB)throw new ApiError('任务存储暂不可用。',503);
 const key=kind+':'+Math.floor(Date.now()/period);
 const row=await env.DB.prepare('INSERT INTO request_counters(id,count) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(key,max).first();
 if(!row)throw new ApiError('本时段访问次数已达上限，请稍后再试。',429);
}
async function provider(key:string,url:string,body:Data,timeout=120000) {
 let response:Response;
 try { response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(timeout)}); }
 catch { throw new ApiError('上游连接中断或超时；生成任务请先查询状态，避免重复提交。',504); }
 if(!response.ok) {
  const status=response.status,detail:Data={httpStatus:status};
  try { const v:any=await response.json();for(const [a,b] of [['code','code'],['param','parameter']])if(/^[\w.\[\]-]{1,120}$/.test(v.error?.[a]||''))detail[b]=v.error[a]; }catch{}
  const messages:Record<number,string>={400:'服务拒绝了请求，请检查提示词、图片与规格。',401:'服务密钥无效，请联系作者更新后台配置。',402:'服务账户余额不足。',403:'服务账户未开通此模型权限。',404:'模型或接口不可用，请联系作者检查配置。',429:'模型服务额度不足或请求过于频繁。'};
  throw new ApiError(messages[status]||'模型服务暂时不可用。',status,detail);
 }
 try{return await response.json() as Data;}catch{throw new ApiError('模型服务未返回有效结果。',502);}
}
async function chat(env:Cloudflare.Env,system:string,content:unknown,max_tokens=4500) {
 if(!env.DEEPSEEK_API_KEY)throw new ApiError('资料服务尚未配置。',503);
 const value=await provider(env.DEEPSEEK_API_KEY,'https://api.deepseek.com/chat/completions',{model:env.DEEPSEEK_MODEL||'deepseek-flash',messages:[{role:'system',content:system},{role:'user',content:typeof content==='string'||Array.isArray(content)?content:JSON.stringify(content)}],response_format:{type:'json_object'},thinking:{type:'disabled'},max_tokens});
 if(!value.choices?.length||value.choices[0].finish_reason==='length')throw new ApiError('模型返回不完整，请缩小任务后重试。',502);
 try{const out=JSON.parse(value.choices[0].message.content);if(!out||typeof out!=='object'||Array.isArray(out))throw Error();return out;}catch{throw new ApiError('模型没有返回有效的结构化内容。',502);}
}
async function search(env:Cloudflare.Env,brief:string,names:string[]=[]) {
 if(!env.DEEPSEEK_API_KEY)throw new ApiError('资料服务尚未配置。',503);
 const out=await provider(env.DEEPSEEK_API_KEY,'https://api.deepseek.com/v1/tools/search',{query:(brief.slice(0,85)+' '+names.join(' ').slice(0,25)+' 角色 形象 文献').slice(0,128),count:8,need_content:true,ori_question:brief.slice(0,128)});
 const sources=(Array.isArray(out.results)?out.results:[]).slice(0,8).filter((r:Data)=>r&&/^https?:\/\//.test(r.url)&&text(r.content||r.summary||r.snippet).trim()).map((r:Data)=>({title:text(r.title,200),url:text(r.url,2000),summary:text(r.content||r.summary||r.snippet,2500)}));
 if(!sources.length)throw new ApiError('未检索到可用资料，请补充需求或自行填写；未用模型记忆代替检索。');
 return sources;
}
function roles(rows:unknown,sources:Data[],count:number,exclude:string[]=[]) {
 if(!Array.isArray(rows))throw new ApiError('模型没有返回有效角色清单。',502);
 const seen=new Set(exclude.map(x=>x.trim().toLowerCase())),out:Data[]=[];
 for(const row of rows.slice(0,count)) {
  if(!row||typeof row!=='object')continue;const name=text(row.name,100).trim();if(!name||seen.has(name.toLowerCase()))continue;seen.add(name.toLowerCase());
  const ids=(Array.isArray(row.source_ids)?row.source_ids:[]).filter((i:any)=>Number.isInteger(i)&&i>=0&&i<sources.length);
  out.push({name,summary:text(row.summary,600),feature:(ids.length?'':'待核实：')+text(row.feature,600),proposal:text(row.proposal,1200),source_ids:ids,...Object.fromEntries(['silhouette','palette','material','keep','avoid'].map(k=>[k,text(row[k],400)]))});
 }
 if(!out.length)throw new ApiError('未返回可用角色，原内容保留。',502);return out;
}
function image(src:unknown) {if(typeof src!=='string'||src.length>3000000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src))throw new ApiError('图像格式无效或过大，请重新上传。');return src;}
export async function intelligence(action:string,env:Cloudflare.Env,d:Data) {
 if(action==='research'||action==='series-plan') {
  const brief=text(d.brief).trim(),series=action==='series-plan';if(!brief)throw new ApiError('请先描述需求。');
  if(series&&(!Number.isInteger(d.count)||d.count<1||d.count>19))throw new ApiError('每次可新增 1 至 19 个角色。');
  const names=Array.isArray(d.names)?d.names.slice(0,19).map((n:any)=>text(n,100)):[],exclude=Array.isArray(d.exclude)?d.exclude.slice(0,50).map((n:any)=>text(n,100)):[];
  const sources=await search(env,brief,names);
  const result=await chat(env,series?prompts.series_plan:prompts.research,{需求:brief,新增数量:d.count,指定角色:names,排除角色:exclude,统一画风:text(d.style,2000),用户补充:text(d.notes,4000),已有角色:Array.isArray(d.roles)?d.roles.slice(0,10):[],已有设计:Array.isArray(d.existing)?d.existing.slice(0,19):[],检索资料:sources},series?10000:4500);
  return {title:text(result.title,120),roles:roles(result.roles,sources,series?d.count:10,exclude),sources};
 }
 if(action==='reference') {
  const result=await chat(env,prompts.reference,[{type:'text',text:JSON.stringify({参考用途:text(d.role,30),用户取用要求:text(d.note,300)})},{type:'image_url',image_url:{url:image(d.src)}}]);
  if(typeof result.note!=='string'||!result.note.trim())throw new ApiError('未返回可用的参考图建议。',502);return {note:result.note.slice(0,300)};
 }
 if(action==='audit') {
  if(!Array.isArray(d.images)||!d.images.length||d.images.length>6)throw new ApiError('每次可分析 1 至 6 张图片。');
  const refs=d.references||[];if(!Array.isArray(refs)||refs.length>6)throw new ApiError('每次最多携带 6 张参考图。');
  const content:Data[]=[{type:'text',text:JSON.stringify({项目背景:text(d.brief),画风:text(d.style,2000)})}];
  const ids=new Set(d.images.map((x:Data)=>text(x.id,100))),refIds=new Set(refs.map((x:Data)=>text(x.id,100)));
  for(const r of refs)content.push({type:'text',text:JSON.stringify({参考图id:text(r.id,100),用途:text(r.role,30),取用范围:text(r.note,300)})},{type:'image_url',image_url:{url:image(r.src)}});
  for(const r of d.images)content.push({type:'text',text:JSON.stringify({待审结果id:text(r.id,100),角色:text(r.name,180),要求:text(r.prompt,16000),本任务审核条件:Array.isArray(r.checks)?r.checks.slice(0,12).map((x:any)=>text(x,300)):[],只比较这些参考图id:Array.isArray(r.reference_ids)?r.reference_ids.filter((x:any)=>refIds.has(x)):[]})},{type:'image_url',image_url:{url:image(r.src)}});
  const result=await chat(env,prompts.audit,content);if(!Array.isArray(result.findings))throw new ApiError('未返回有效的审核记录。',502);
  return {findings:result.findings.filter((x:Data)=>x&&ids.has(x.id)).map((x:Data)=>({id:x.id,note:text(x.note,2000)}))};
 }
 throw new ApiError('接口不存在。',404);
}
export async function imageTask(env:Cloudflare.Env,owner:string,id:unknown) {
 if(typeof id!=='string'||!/^[-\w]{8,100}$/.test(id))throw new ApiError('任务标识无效。');
 const row=await env.DB!.prepare('SELECT * FROM image_tasks WHERE id=? AND owner=?').bind(id,owner).first<Data>();if(!row)return {status:'missing'};
 const result=JSON.parse(row.result);result.status=row.status;
 if(row.status==='running'&&Date.now()-row.created>300000){result.status='uncertain';result.error='生成连接可能中断，请检查服务用量后决定是否重新生成。';}
 if(row.status==='succeeded') {
  const file=await env.BUCKET!.get(`results/${owner}/${id}.png`);if(!file)return {...result,status:'uncertain',error:'图片文件暂不可用，请联系作者检查。'};
  result.src='data:image/png;base64,'+Buffer.from(await file.arrayBuffer()).toString('base64');
 }
 return result;
}
export async function generate(env:Cloudflare.Env,owner:string,d:Data) {
 const id=d.requestId,w=d.w,h=d.h;
 if(typeof id!=='string'||!/^[-\w]{8,100}$/.test(id))throw new ApiError('任务标识无效。');
 if(typeof d.prompt!=='string'||!d.prompt.trim()||d.prompt.length>50000)throw new ApiError('提示词为空或过长。');
 if(!Number.isInteger(w)||!Number.isInteger(h)||w*h<921600||w*h>4624220||w/h<1/16||w/h>16)throw new ApiError('生图尺寸需在 92 万至 462 万像素之间。');
 const refs=d.images||[];if(!Array.isArray(refs)||refs.length>10)throw new ApiError('每个任务最多 10 张参考图。');
 for(const src of refs)if(typeof src!=='string'||src.length>32*1024*1024||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src))throw new ApiError('参考图无效或过大。');
 if(!env.ARK_API_KEY||!env.DB||!env.BUCKET)throw new ApiError('生图服务尚未配置完成。',503);
 const body:Data={model:env.SEEDREAM_MODEL||'doubao-seedream-5-0-pro-260628',prompt:d.prompt,size:`${w}x${h}`,response_format:'b64_json',output_format:'png',watermark:true};if(refs.length)body.image=refs;
 const digest=await hash(JSON.stringify(body)),existing=await env.DB.prepare('SELECT owner,digest,status FROM image_tasks WHERE id=?').bind(id).first<Data>();
 if(existing){if(existing.owner!==owner||existing.digest!==digest)throw new ApiError('任务标识已被使用或内容已变化，请新建任务。',409);return {status:existing.status,requestId:id};}
 await limit(env,'images',40);await limit(env,'image-start:'+owner,2,60000);
 const result:Data={requestId:id,status:'running',model:body.model,watermark:true,size:body.size,created:Date.now()};
 const reserved=await env.DB.prepare('INSERT OR IGNORE INTO image_tasks(id,owner,digest,status,created,result) VALUES (?,?,?,?,?,?) RETURNING id').bind(id,owner,digest,'running',Date.now(),JSON.stringify(result)).first();
 if(!reserved)return {status:'running',requestId:id};
 try {
  const out=await provider(env.ARK_API_KEY,'https://ark.cn-beijing.volces.com/api/v3/images/generations',body,160000);
  const encoded=out.data?.[0]?.b64_json;if(typeof encoded!=='string'||encoded.length>34*1024*1024)throw new ApiError('服务未返回可保存的图片。',502);
  const png=Buffer.from(encoded,'base64');if(png.length>24*1024*1024||png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new ApiError('返回图片格式异常。',502);
  await env.BUCKET.put(`results/${owner}/${id}.png`,png,{httpMetadata:{contentType:'image/png'}});
  result.status='succeeded';result.file=id+'.png';
 }catch(e){const err=e instanceof ApiError?e:new ApiError('生成或保存中断，请先查询任务状态。',502);result.status=err.status>=500?'uncertain':'failed';result.error=err.message;result.errorDetails=err.details;}
 await env.DB.prepare('UPDATE image_tasks SET status=?,result=? WHERE id=? AND owner=?').bind(result.status,JSON.stringify(result),id,owner).run();
 return {status:result.status,requestId:id};
}
