'use strict';
const pagesHosted=location.origin==='https://urnotccw.github.io';
const cloudApiOrigin=pagesHosted?'https://zaoxing-workbench.urnotccw1.chatgpt.site':'';
const sessionStorageKey='zaoxing-ai-session-v1';
let cloudSessionToken='';
try{cloudSessionToken=localStorage.getItem(sessionStorageKey)||'';}catch{}
async function cloudFetch(path,options={}){
 const headers=new Headers(options.headers||{});
 if(pagesHosted&&cloudSessionToken)headers.set('X-Zaoxing-Session',cloudSessionToken);
 const response=await fetch(cloudApiOrigin+path,{...options,headers,credentials:pagesHosted?'omit':'same-origin'});
 if(pagesHosted&&response.ok&&(path==='/api/login'||path==='/api/logout')){
  const body=await response.clone().json();
  cloudSessionToken=path==='/api/logout'?'':body.sessionToken||'';
  try{if(cloudSessionToken)localStorage.setItem(sessionStorageKey,cloudSessionToken);else localStorage.removeItem(sessionStorageKey);}catch{}
 }
 return response;
}
