export const pagesOrigin='https://urnotccw.github.io';
export function allowedOrigin(request:Request) {
 const origin=request.headers.get('Origin');
 return origin===new URL(request.url).origin||origin===pagesOrigin;
}
export function browserResponse(request:Request,response:Response) {
 if(request.headers.get('Origin')!==pagesOrigin)return response;
 const headers=new Headers(response.headers);
 headers.set('Access-Control-Allow-Origin',pagesOrigin);
 headers.set('Vary','Origin');
 return new Response(response.body,{status:response.status,headers});
}
export function preflight(request:Request) {
 if(!allowedOrigin(request))return new Response(null,{status:403});
 return browserResponse(request,new Response(null,{status:204,headers:{
  'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type, X-Zaoxing-Session',
  'Access-Control-Max-Age':'600'
 }}));
}
