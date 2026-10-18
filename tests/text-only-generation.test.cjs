const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const events=[],el={addEventListener(){},classList:{add(){},remove(){},toggle(){}},style:{},querySelectorAll(){return []}};
const ctx={document:{querySelector:()=>el,addEventListener:(type,fn,capture)=>events.push({type,fn,capture})},window:{addEventListener(){}},setTimeout,clearTimeout,structuredClone,queueMicrotask,assert,console,location:{protocol:'https:'}};
vm.createContext(ctx);
const source=['production','workflow','lifecycle','characters','app'].map(n=>fs.readFileSync('public/workbench/'+n+'.js','utf8').replace(/init\(\);\s*$/,'')).join('\n');
vm.runInContext(source+`
changed=render=renderPanel=scheduleSave=toast=snapshot=()=>{};
let opened=null;openPanel=(kind,step)=>{opened={kind,step};};
state=empty();state.brief='原创青鸟角色设计';state.roles=[{id:'bird',name:'青鸟',feature:'青绿羽毛，短喙，长尾',proposal:'',evidence:'user',enabled:true}];state.directionIds=['bird'];backgroundView='results';
assert.equal(productionIssues().length,0,'no image and no style must not block generation');
assert(!expand(state.roles[0]).includes('遵循此任务绑定的画风参考图'),'text prompt must not invent an image');
const batch=makeBatch();assert(batch);assert.equal(batch.jobs.length,1);
batch.jobs[0].generation={requestId:'text-only-test'};
assert.equal(imagePayload(batch.jobs[0],batch).images.length,0);
assert(imagePayload(batch.jobs[0],batch).prompt.includes('青绿羽毛'));
assert(refsPanel().includes('不使用参考图，继续出图'));
assert(templatePanel().includes('画风描述（可选）'));
`,ctx);
async function click(action,next){const button={dataset:{action,next}};for(const e of events.filter(e=>e.type==='click'&&e.capture)){let stopped=false;await e.fn({target:{closest:()=>button},stopImmediatePropagation(){stopped=true;}});if(stopped)break;}}
(async()=>{
 await click('confirm-background');vm.runInContext(`assert.equal(opened.kind,'template');assert.equal(opened.step,2);`,ctx);
 await click('confirm-background','refs');vm.runInContext(`assert.equal(opened.kind,'refs');`,ctx);
 vm.runInContext(`
 state.assets=[{id:'image',name:'风格参考',src:'data:image/png;base64,dGVzdA=='}];
 state.refs=[{id:'ref',asset:'image',role:'画风',scope:'all'}];
 assert(expand(state.roles[0]).includes('参考图1'));
 const withRefs=makeBatch();withRefs.jobs[0].generation={requestId:'with-reference-test'};
 assert.equal(imagePayload(withRefs.jobs[0],withRefs).images.length,1);
 assert.equal(batch.jobs[0].referenceIds.length,0,'old text-only job remains frozen');
 state.roles[0].feature='';assert(productionIssues().some(i=>i.text.includes('识别特征')));
 `,ctx);
 console.log('PASS: text-only task creation and payload, direct settings navigation, optional reference navigation, image-reference preservation and required role validation.');
})().catch(e=>{console.error(e);process.exitCode=1});
