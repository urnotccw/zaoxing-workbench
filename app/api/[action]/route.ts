import { env } from 'cloudflare:workers';
import { ApiError, json, session, login, intelligence, limit, generate, imageTask } from '../../../lib/cloud-api';
import { allowedOrigin, browserResponse, preflight } from '../../../lib/browser-access';
export const dynamic='force-dynamic';
export function OPTIONS(request:Request) { return preflight(request); }
export async function GET(request:Request) { return browserResponse(request,await get(request)); }
export async function POST(request:Request) { return browserResponse(request,await post(request)); }
async function get(request:Request) {
 if(new URL(request.url).pathname!=='/api/status')return json({error:'接口不存在。'},404);
 const owner=await session(request,env);
 return json({hosted:true,authenticated:!!owner,configured:!!owner&&!!env.DEEPSEEK_API_KEY,imageConfigured:!!owner&&!!env.ARK_API_KEY,watermark:true,imageModel:env.SEEDREAM_MODEL||'doubao-seedream-5-0-pro-260628'});
}
async function post(request:Request) {
 try {
  if(!allowedOrigin(request))throw new ApiError('仅允许工作台网页发起请求。',403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new ApiError('请求格式错误。',415);
  const action=new URL(request.url).pathname.split('/').pop()!;
  const known=['login','logout','research','series-plan','reference','audit','generate-image','image-task'];
  if(!known.includes(action))throw new ApiError('在线版不提供修改服务密钥的接口。',404);
  const owner=await session(request,env);if(action!=='login'&&!owner)throw new ApiError('请先输入访问口令，开启 AI 功能。',401);
  const max=action==='login'?2048:24*1024*1024;
  if(Number(request.headers.get('Content-Length'))>max)throw new ApiError('图片合计过大，请压缩后提交。',413);
  const reader=request.body?.getReader();if(!reader)throw new ApiError('请求为空。');
  const chunks:Uint8Array[]=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new ApiError('请求过大。',413);}chunks.push(value);}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new ApiError('请求格式错误。');}
  if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('请求格式错误。');
  if(action==='login')return await login(request,env,data);
  if(action==='logout')return json({ok:true},200,{'Set-Cookie':'zaoxing_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure'});
  if(action==='image-task')return json(await imageTask(env,owner!,data.requestId));
  if(action==='generate-image')return json(await generate(env,owner!,data));
  await limit(env,'intelligence',200);await limit(env,'intelligence:'+owner,6,60000);
  return json(await intelligence(action,env,data));
 }catch(e){if(e instanceof ApiError)return json({error:e.message,...(Object.keys(e.details).length?{errorDetails:e.details}:{})},e.status);return json({error:'在线服务暂未完成请求，原项目保留。'},502);}
}
