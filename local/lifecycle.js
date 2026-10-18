'use strict';

// Editable trial prompts are separate from frozen jobs and scoped to role/type.
function promptMaster(r){const d=promptDraft(r);if(!d)return reusableMaster(r);if(!d.master)return null;for(const b of state.batches){const j=b.jobs.find(j=>j.id===d.master.jobId&&j.asset===d.master.asset);if(j)return {job:j,batch:b};}return null;}
function pilotPromptRefs(r){const refs=refsForRole(r),master=promptMaster(r);return master?[...refs,{asset:master.job.asset,role:'角色',note:'已确认的角色基准'}]:refs;}
function automaticPilotPrompt(r,s=state){let text=expand(r,s);if(promptMaster(r))text+='\n参考图'+(refsForRole(r,state.refs,s).length+1)+'：已确认角色基准；保留身份和关键结构，允许按本任务变更视角与构图。';return text;}
function promptDraft(r,s=state){return r?.promptDrafts?.[s.type]||null;}
function promptSource(r){return JSON.stringify([expand(r),refsForRole(r).map(x=>[x.asset,x.role,x.note||''])]);}
function finalPilotPrompt(r,s=state){return promptDraft(r,s)?.text??automaticPilotPrompt(r,s);}
function promptReferenceStrip(refs){return `<div class="prompt-edit-refs">${refs.map((r,i)=>`<figure><button class="ref-mini" data-action="preview-prompt-image" data-id="${esc(r.asset)}" aria-label="放大参考图${i+1}"><img src="${esc(asset(r.asset)?.src)}" alt="参考图${i+1}"></button><figcaption>图${i+1} · ${esc(r.role)}</figcaption></figure>`).join('')}</div><p class="small muted">${refs.length?'图片按以上编号随提示词一起提交。':'本次没有参考图，仅提交文字要求。'}</p>`;}
function finalPromptEditor(r){if(!r)return '';const d=promptDraft(r),stale=d&&d.source!==promptSource(r);return `<details data-detail-key="final-prompt-${r.id}"><summary>编辑最终提示词${d?' · 已手动修改':''}${stale?' · 要求已更新':''}</summary><div class="row"><strong>${esc(r.name)} · 试稿</strong><span class="space"></span><button class="text-action" data-action="compare-prompt" data-id="${r.id}">对照当前模板</button></div>${stale?'<p class="notice">规格或参考已变化，手写内容仍保留。请对照当前模板后决定采用哪版。</p>':''}${promptReferenceStrip(pilotPromptRefs(r))}<label class="field"><span>最终提示词</span><textarea class="final-prompt-input" data-final-prompt="${r.id}" maxlength="50000" spellcheck="false">${esc(finalPilotPrompt(r))}</textarea></label><p class="small muted">自动保存。生成试稿时完整使用这里的文字；批量扩展会按各自规格另行组装。</p></details>`;}
function promptComparePanel(id){const r=state.roles.find(r=>r.id===id);if(!r)return '';return panelHead('对照提示词','原文字保留，由你决定是否应用模板。')+`<div class="prompt-compare-grid"><label class="field"><span>当前文字</span><textarea readonly class="final-prompt-input">${esc(finalPilotPrompt(r))}</textarea></label><label class="field"><span>当前模板生成</span><textarea readonly class="final-prompt-input">${esc(automaticPilotPrompt(r))}</textarea></label></div>${promptReferenceStrip(pilotPromptRefs(r))}<div class="panel-footer"><button data-action="keep-prompt" data-id="${r.id}">保留当前文字</button><button class="primary" data-action="apply-prompt-template" data-id="${r.id}">应用右侧模板</button></div>`;}
function jobPromptPanel(id){const b=active(),j=b?.jobs.find(j=>j.id===id);if(!j)return '';return panelHead('修改提示词',j.name)+`<p class="small muted">沿用原任务的 ${j.w} × ${j.h} 规格和参考图。修改后生成新版本，原任务保留。</p>${promptReferenceStrip(taskRefs(j,b))}<label class="field"><span>最终提示词</span><textarea class="final-prompt-input" data-job-prompt="${j.id}" maxlength="50000" spellcheck="false">${esc(j.promptEditDraft??j.prompt)}</textarea></label><p class="small muted">草稿自动保存 · Seedream · 1 张 · 按方舟账户计费</p><div class="panel-footer"><button data-action="batch">返回试稿</button><button class="primary" data-action="generate-prompt-version" data-id="${j.id}" ${generationBusy?'disabled':''}>生成新版本 · 1 张</button></div>`;}
function createPromptVersion(j,b,text){if(typeof text!=='string'||!text.trim()||text.length>50000)throw Error('请输入 1 至 50000 字的提示词。');const prior=b.jobs.find(x=>x.promptVersion&&x.parent===j.id&&x.prompt===text);if(prior)return prior;if(b.jobs.length>=60)throw Error('当前批次已满，请导出备份后新建批次。');const copy={...structuredClone(j),id:uid(),name:j.roleName+' · 提示词修改版',prompt:text,productionPrompt:text,promptVersion:true,parent:j.id,asset:null,generation:null,adopted:false,rejected:false,ai:'',manual:{},issues:[],reviewNote:'',pilotChecks:{},baselineApproval:null};delete copy.promptEditDraft;delete copy.canvasPosition;delete copy.revision;b.jobs.push(copy);return copy;}
function generationErrorText(g){const messages={'OutputImageSensitiveContentDetected.PolicyViolation':'方舟判断生成图片可能涉及版权限制，未返回图片。可检查并修改提示词或参考素材；该提示不代表已认定侵权。','InputTextSensitiveContentDetected.PolicyViolation':'方舟判断输入文字可能涉及版权限制，请检查提示词。','InputImageSensitiveContentDetected.PolicyViolation':'方舟判断输入参考图可能涉及版权限制，请检查参考素材。'};return messages[g.errorDetails?.code]||g.error||'服务未返回图片。';}
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.finalPrompt){const r=state.roles.find(r=>r.id===t.dataset.finalPrompt);if(r){r.promptDrafts??={};const old=promptDraft(r),master=promptMaster(r);r.promptDrafts[state.type]={text:t.value,source:old?.source??promptSource(r),master:old?old.master:(master?{jobId:master.job.id,asset:master.job.asset}:null)};scheduleSave();}}if(t.dataset.jobPrompt){const j=active()?.jobs.find(j=>j.id===t.dataset.jobPrompt);if(j){j.promptEditDraft=t.value;scheduleSave();}}});
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-action]'),a=btn?.dataset.action;if(!['compare-prompt','keep-prompt','apply-prompt-template','edit-job-prompt','generate-prompt-version','preview-prompt-image'].includes(a))return;e.stopImmediatePropagation();try{const id=btn.dataset.id,r=state.roles.find(r=>r.id===id);if(a==='preview-prompt-image'){showImagePreview(id,btn.dataset.title||asset(id)?.name);return;}if(a==='compare-prompt'){openPanel({kind:'prompt-compare',id},2);return;}if(a==='keep-prompt'||a==='apply-prompt-template'){if(!r)return;snapshot();r.promptDrafts??={};if(a==='apply-prompt-template')delete r.promptDrafts[state.type];else if(promptDraft(r))r.promptDrafts[state.type].source=promptSource(r);changed();openPanel('template',2);return;}if(a==='edit-job-prompt'){openPanel({kind:'job-prompt',id},3);return;}if(generationBusy)return;if(!imageReady){toast('先连接生图接口；提示词草稿已保存。');return;}const b=active(),j=b?.jobs.find(j=>j.id===id);if(!j)return;snapshot();const copy=createPromptVersion(j,b,j.promptEditDraft??j.prompt);changed();openPanel('batch',3);if(copy.asset||copy.generation){toast('这版文字已有任务，已打开；未重复提交。');return;}await runImageJobs([copy],b);}catch(err){toast(err.message);}},true);

function resultImageButton(id,title,cls='result-image-button'){const a=asset(id);return a?`<button class="${cls}" data-action="preview-prompt-image" data-id="${esc(id)}" data-title="${esc(title||a.name)}" aria-label="放大 ${esc(title||a.name)}"><img class="preview" src="${esc(a.src)}" alt="${esc(title||a.name)}"></button>`:'';}
function showImagePreview(id,title){const a=asset(id);if(!a?.src){toast('图片尚未载入。');return;}let d=document.getElementById('image-preview');if(!d){d=document.createElement('dialog');d.id='image-preview';d.setAttribute('aria-label','图片大图预览');d.className='image-preview-dialog';document.body.appendChild(d);d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-image-close]'))d.close();const zoom=e.target.closest('[data-image-zoom]');if(zoom){const stage=d.querySelector('.image-preview-stage');stage.classList.toggle('actual');zoom.textContent=stage.classList.contains('actual')?'适应窗口':'原始尺寸';}});}d.innerHTML=`<header><div><strong>${esc(title||a.name)}</strong><span class="small muted">${a.w} × ${a.h}</span></div><div class="row"><button data-image-zoom>原始尺寸</button><button data-image-close aria-label="关闭大图">${icon('close')}</button></div></header><div class="image-preview-stage"><img src="${esc(a.src)}" alt="${esc(title||a.name)}"></div>`;if(!d.open)d.showModal();}
let imageReady=false,imageWatermark=true,generationBusy=false,generationStop=false;
function imageSettings(){return `<h3>Seedream 5.0 Pro</h3><p class="small muted">${imageReady?'密钥已配置 · 生成时验证权限':'用于试稿、批量素材与参考图返修'}</p><label class="field"><span>火山方舟 API Key · 加密保存在本机</span><input id="image-key" type="password" autocomplete="off" placeholder="${imageReady?'留空保留当前密钥':'填写方舟 API Key'}"></label><label class="check-option"><input id="image-watermark" type="checkbox" ${imageWatermark?'checked':''}>生成图片带可见水印</label><button data-action="configure-image">${imageReady?'保存生图设置':'连接 Seedream'}</button><p id="image-status" class="small muted" role="status"></p><details><summary>连接说明</summary><p class="small muted">模型：doubao-seedream-5-0-pro-260628。点击生成后按方舟账户计费。密钥通过 Windows 当前用户加密保存在本机，重启服务后自动读取，不进入项目或程序包。生成原图另存到 outputs／造形生成结果。</p><a href="https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh" target="_blank" rel="noopener noreferrer">官方接口说明</a></details>`;}
function generationToolbar(b){const count=batchJobs(b).filter(j=>!j.asset&&!j.generation).length;return `<div class="row"><span class="tag">${imageReady?'Seedream Pro':'生图未连接'}</span><button class="text-action" data-action="export-prompts">导出提示词</button></div><div class="row" style="margin-top:12px">${generationBusy?'<span role="status">正在处理生成任务…</span><button data-action="stop-generation">完成本张后停止</button>':`<button class="primary" data-action="generate-pending" ${!count?'disabled':''}>${icon('spark')}生成待出图 · ${count} 张</button>${!imageReady?'<button data-action="settings">连接接口</button>':''}`}</div><p class="small muted">逐张生成，成功结果不重复提交。${imageWatermark?'当前开启可见水印，可在接口设置中关闭。':'当前关闭可见水印。'} 按方舟账户计费。</p>${b.jobs.some(j=>j.requiresAlpha)?'<p class="small muted">透明素材先生成中间图，仍需抠图后导入；本次不保证透明通道。</p>':''}`;}
function generationJob(j,b){const g=j.generation;if(!g)return `<p class="small muted">待生成</p><button data-action="generate-one" data-id="${j.id}" ${generationBusy?'disabled':''}>${icon('spark')}生成这张</button>`;
  if(g.status==='failed')return `<div class="generation-error" role="status"><strong>生成失败 · 暂无图片</strong><p>${esc(generationErrorText(g))}</p><div class="row"><button data-action="generation-error" data-id="${j.id}">查看原因</button><button class="text-action" data-action="edit-failed-generation" data-id="${j.id}">修改提示词</button><button class="text-action" data-action="retry-generation" data-id="${j.id}" ${generationBusy?'disabled':''}>重新生成</button></div></div>`;
  const running=['running','submitting'].includes(g.status),label=running?'生成中':g.status==='succeeded'?'载入已生成图片':g.status==='missing'?'未找到本地任务':'状态待核对';return `<p class="small muted" role="status">${esc(label)}${g.error?' · '+esc(g.error):''}</p><div class="row"><button data-action="recover-generation" data-id="${j.id}" ${generationBusy?'disabled':''}>${running?'生成中':g.status==='succeeded'?'载入图片':'核对生成状态'}</button>${['uncertain','missing'].includes(g.status)?`<button class="text-action" data-action="retry-generation" data-id="${j.id}" ${generationBusy?'disabled':''}>重新生成</button>`:''}</div>`;
}
function generationErrorPanel(id){const j=active()?.jobs.find(j=>j.id===id),g=j?.generation;if(!g)return panelHead('没有找到任务');return panelHead('生成失败',j.name)+`<p class="notice">这次请求没有返回图片，因此没有结果可以查看。</p><p class="role-summary">${esc(generationErrorText(g))}</p><p class="small muted">${g.errorDetails?'下面保留了服务返回的错误代码，便于核对。':'旧任务只保存了概括性错误，无法从这份记录判断具体是哪项参数被拒绝。'}</p><details><summary>错误记录</summary><p class="small">任务：${esc(g.requestId)}</p><p class="small">模型：${esc(g.model||'Seedream 5.0 Pro')}</p><pre class="prompt-preview">${esc(JSON.stringify(g.errorDetails||{status:g.status},null,2))}</pre></details><div class="panel-footer"><button data-action="batch">返回试稿</button><button class="primary" data-action="edit-failed-generation" data-id="${j.id}">修改提示词</button></div>`;}
async function visionSource(src){if(typeof src!=='string')throw Error('找不到待分析的图片。');if(src.length<=2800000)return src;const img=await loadImage(src),scale=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.88);}
function imagePayload(j,b){const refs=taskRefs(j,b);if(refs.length>10)throw Error('本任务参考图超过 10 张，请精简后创建新试稿。');const images=refs.map(r=>{const a=asset(r.asset);if(!a?.src?.startsWith('data:image/'))throw Error('参考图缺失，请重新导入。');return a.src;});const result={requestId:j.generation.requestId,prompt:j.prompt,w:j.w,h:j.h,images};if(JSON.stringify(result).length>35*1024*1024)throw Error('参考图合计过大，请缩小图片后创建新试稿。');return result;}
function generationFitsProject(src=''){return state.assets.length<24&&state.assets.reduce((n,a)=>n+a.src.length,src.length)<=160*1024*1024;}
async function receiveGeneration(j,b,project,requestId){
  for(let attempt=0;attempt<180;attempt++){
    if(state!==project||!b.jobs.includes(j)||j.generation?.requestId!==requestId)return false;
    const result=await api('image-task',{requestId});
    if(state!==project||!b.jobs.includes(j)||j.generation?.requestId!==requestId)return false;
    const g=j.generation;g.status=result.status;g.error=result.error||'';g.errorDetails=result.errorDetails||null;g.model=result.model||'doubao-seedream-5-0-pro-260628';g.watermark=result.watermark;g.file=result.file||'';scheduleSave();
    if(result.status==='succeeded'){
      if(j.asset)return true;
      const src=result.src;if(!generationFitsProject(src))throw Error('项目图片已达上限。原图已保存在“造形生成结果”目录，请导出项目后整理。');
      const img=await loadImage(src),alpha=await imageTransparency(src);
      if(state!==project||!b.jobs.includes(j)||j.asset||j.generation?.requestId!==requestId)return false;
      const a={id:uid(),name:j.name+'.png',src,w:img.width,h:img.height,origin:'Seedream 5.0 Pro · AI 生成',hasTransparency:alpha};state.assets.push(a);j.asset=a.id;j.adopted=false;j.ai='';j.manual={};j.pilotChecks={};j.baselineApproval=null;
      history=[];future=[];await save();render();return true;
    }
    if(result.status!=='running'){if(result.status==='failed')toast('未生成图片：'+(g.error||'请求失败'));if(result.status==='missing')g.error='本地未找到该任务。可检查结果目录，或重新生成。';render();return false;}
    if(attempt===0)render();await new Promise(resolve=>setTimeout(resolve,2000));
  }
  throw Error('等待时间较长，任务保留。稍后点击任务按钮查看进度，不会重复生成。');
}
async function runImageJobs(jobs,b,{recover=false}={}){
  if(generationBusy)return;if(!recover&&!imageReady){openPanel('settings');toast('先连接 Seedream 生图接口。');return;}
  if(!jobs.length)return;const project=state;generationBusy=true;generationStop=false;render();
  try{
    for(const j of jobs){
      if(state!==project||generationStop)break;if(j.asset)continue;
      if(!recover){
        if(j.generation)continue;
        if(!generationFitsProject())throw Error('最多保存 24 张图片；请先导出项目。');
        j.generation={requestId:'image-'+uid(),status:'submitting',created:new Date().toISOString()};
        let body;try{body=imagePayload(j,b);}catch(e){j.generation=null;throw e;}
        if(!await save()){j.generation=null;throw Error('本地保存失败，尚未提交生图。请先导出备份并解决存储问题。');}
        history=[];future=[];render();
        await api('generate-image',body);
      }
      if(!j.generation)continue;
      const ok=await receiveGeneration(j,b,project,j.generation.requestId);
      if(!ok)break; // Stop the queue on errors; user decides whether to spend again.
    }
  }catch(err){toast(err.name==='AbortError'?'连接超时。稍后查询结果，不要重复提交。':err.message);}
  finally{generationBusy=false;generationStop=false;if(state===project){scheduleSave();const last=jobs.filter(j=>j.asset).at(-1),show=last&&active()===b&&panel==='batch';if(show)panel=null;render();if(show)focusResult(last.id);}}
}
function restoreGeneration(s,raw){for(const b of s.batches){const original=raw.batches.find(x=>x.id===b.id);for(const j of b.jobs){const savedJob=original?.jobs?.find(x=>x.id===j.id);if(Number.isFinite(savedJob?.canvasPosition?.x)&&Number.isFinite(savedJob?.canvasPosition?.y))j.canvasPosition={x:Math.max(-2500,Math.min(12000,savedJob.canvasPosition.x)),y:Math.max(-2500,Math.min(16000,savedJob.canvasPosition.y))};const g=savedJob?.generation;if(g&&/^[A-Za-z0-9_-]{8,100}$/.test(g.requestId)){j.generation={requestId:g.requestId,status:['submitting','running','failed','uncertain','missing','succeeded'].includes(g.status)?g.status:'uncertain',error:cleanText(g.error,400),model:cleanText(g.model,100),created:cleanText(g.created,100),file:cleanText(g.file,150),watermark:g.watermark===true,errorDetails:g.errorDetails&&typeof g.errorDetails==='object'?{httpStatus:Number(g.errorDetails.httpStatus)||0,code:cleanText(g.errorDetails.code,120),parameter:cleanText(g.errorDetails.parameter,120),providerRequestId:cleanText(g.errorDetails.providerRequestId,160)}:null};}}}return s;}
document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-action]'),a=btn?.dataset.action;
  if(!['generation-error','edit-failed-generation','configure-image','generate-pending','generate-one','recover-generation','retry-generation','stop-generation'].includes(a))return;e.stopImmediatePropagation();
  if(a==='stop-generation'){generationStop=true;characterBulkStop=true;btn.disabled=true;btn.textContent='本张完成后停止';return;}
  if(a==='configure-image'){const status=$('#image-status');status.textContent='正在保存…';try{const result=await api('configure-image',{key:$('#image-key').value.trim(),watermark:$('#image-watermark').checked});imageReady=true;imageWatermark=result.watermark;$('#image-key').value='';status.textContent='已配置。到第四步点击生成试稿。';renderNodes();}catch(err){status.textContent=err.message;}return;}
  const b=active();if(!b)return;const j=b.jobs.find(x=>x.id===btn.dataset.id);
  if(a==='generation-error'){openPanel({kind:'generation-error',id:j.id},3);return;}
  if(a==='edit-failed-generation'){if(!j)return;openPanel({kind:'job-prompt',id:j.id},3);return;}
  if(a==='recover-generation'){if(j?.generation?.status==='failed'){openPanel({kind:'generation-error',id:j.id},3);return;}if(j?.generation)await runImageJobs([j],b,{recover:true});return;}
  if(a==='retry-generation'){
    if(!j||generationBusy)return;
    if(!await ask('重新生成会发起一次新的付费请求。若上次状态不确定，请先核对方舟记录。继续？'))return;
    j.generation=null;await runImageJobs([j],b);return;
  }
  await runImageJobs(a==='generate-one'?(j?[j]:[]):batchJobs(b).filter(j=>!j.asset&&!j.generation),b);
},true);
// Five production decisions share one contract. Approvals are content-addressed;
// frozen jobs keep the contract, references and source version that produced them.
const FLOW_DEFAULTS={mode:'cast',crop:'full',expression:'沿用角色设定',fixed:'',variable:'',transparent:false};
const cleanText=(v,n=1000)=>typeof v==='string'?v.slice(0,n):'';
function flow(s=state){const f=s.flow||{};return {...FLOW_DEFAULTS,mode:f.mode==='variants'?'variants':'cast',crop:f.crop==='half'?'half':'full',expression:cleanText(f.expression,160)||FLOW_DEFAULTS.expression,fixed:cleanText(f.fixed,600),variable:cleanText(f.variable,600),transparent:f.transparent===true};}
function briefKey(s=state){return JSON.stringify([s.brief,s.notes||'',s.roles.map(r=>[r.id,r.name,r.feature,r.summary||'',r.proposal||'',designData(r),r.evidence||'unverified',r.sourceIds||[],r.suggestion||null,r.suggestion?(r.suggestionDecision||'pending'):'']),s.sources,s.directionIds||null]);}
function briefConfirmed(s=state){return !!s.briefApproval&&s.briefApproval.key===briefKey(s);}
function referenceKey(s=state){return JSON.stringify([s.style,s.refs.map(r=>[r.id,r.asset,r.scope||'all',r.role,r.taskType||'all',r.note||'',r.avoid||'',r.priority||'normal',r.source||'']),s.roles.map(r=>[r.id,r.excludedRefs||[],r.referenceChoices||null])]);}
function referencesConfirmed(){return state.referenceApproval===referenceKey();}
function lifecycleSignature(){return [flow(),state.refs.map(r=>[r.id,r.taskType||'all',r.priority||'normal',r.avoid||'']),state.roles.map(r=>[r.id,r.evidence||'unverified',r.suggestion?(r.suggestionDecision||'pending'):''])];}
function evidenceName(r){return ({user:'用户原创设定',reviewed:'用户已核对出处',unverified:'待核实／创作参考'})[r.evidence]||'待核实／创作参考';}
function suggestionKey(r){return JSON.stringify(r.suggestion||null);}
function suggestionWasApplied(r){return r.suggestionApplied===suggestionKey(r)||(!r.suggestionApplied&&r.suggestionDecision==='accepted');}
function pendingDesignRoles(){return state.roles.filter(r=>r.suggestion&&!suggestionWasApplied(r)&&r.suggestionDecision!=='dismissed');}
function designDirectionIds(){const ids=Array.isArray(state.directionIds)?state.directionIds:state.briefApproval?selectedRoles().map(r=>r.id):[];return [...new Set(ids)].filter(id=>characterRoles().some(r=>r.id===id));}
function pendingDesignSummary(){const ids=designDirectionIds();return `<p class="direction-selection-summary small">已选 ${ids.length} 个方向 · 未选方案保留为备选，不会加入本次任务。</p>`;}
function continueFromBackground(){
  const ids=designDirectionIds();if(!ids.length)throw Error('先勾选至少一个想继续制作的方向。');
  const available=characterRoles().map(r=>r.id),roles=structuredClone(state.roles);for(const r of roles){if(!available.includes(r.id))continue;r.enabled=ids.includes(r.id);if(r.enabled&&!r.proposal?.trim()&&r.suggestion&&r.suggestionDecision!=='dismissed'&&!suggestionWasApplied(r))applyDesignSuggestion(r);}
  validateBriefDirections(roles.filter(r=>available.includes(r.id)&&r.enabled));
  state.roles=roles;state.directionIds=ids;previewRoleId=ids.includes(editingRoleId)?editingRoleId:ids[0];confirmBrief();return true;
}
document.addEventListener('change',e=>{const t=e.target;if(!t.dataset.designDirection)return;e.stopImmediatePropagation();snapshot();const ids=designDirectionIds().filter(id=>id!==t.dataset.designDirection);if(t.checked){ids.push(t.dataset.designDirection);editingRoleId=t.dataset.designDirection;}else if(editingRoleId===t.dataset.designDirection&&ids.length)editingRoleId=ids[0];state.directionIds=ids;for(const r of characterRoles())r.enabled=ids.includes(r.id);changed();},true);
function applyDesignSuggestion(r){
  if(!r.suggestion)return false;
  if(suggestionWasApplied(r)){r.suggestionApplied=suggestionKey(r);r.suggestionDecision='accepted';return false;}
  const current=r.proposal||'',incoming=r.suggestion.proposal||'';
  const proposal=!incoming.trim()||current.includes(incoming)?current:current.trim()?current+'\n\n【AI 建议补充】\n'+incoming:current+incoming;
  if(proposal.length>2000)throw Error('补充后超过 2000 字，尚未修改任何内容。请精简文字，或从左侧选取需要的建议。');
  r.proposal=proposal;
  for(const [key] of DESIGN_FIELDS)if(!(r[key]||'').trim())r[key]=designData(r.suggestion)[key];
  r.suggestionApplied=suggestionKey(r);r.suggestionDecision='accepted';return true;
}
function dismissDesignSuggestion(r){if(!r.suggestion)return;if(suggestionWasApplied(r))r.suggestionApplied=suggestionKey(r);r.suggestionDecision='dismissed';}
let backgroundPart='facts',editingRoleId='';
function backgroundSteps(){return `<nav class="background-steps" aria-label="设计背景子步骤"><button data-action="background-part" data-part="request" class="${backgroundView==='request'?'current':''}">1 描述需求</button><button data-action="background-part" data-part="facts" class="${backgroundView!=='request'?'current':''}" ${state.roles.length?'':'disabled'}>2 选择与调整</button></nav>`;}
function backgroundPanel(){
  if(backgroundView==='request'){return baseBackgroundPanel().replace('<label class="field brief-field">',backgroundSteps()+'<label class="field brief-field">');}
  if(!characterRoles().length){backgroundView='request';return backgroundPanel();}
  backgroundPart='facts';const ids=designDirectionIds(),r=characterRoles().find(x=>x.id===editingRoleId)||characterRoles().find(x=>ids.includes(x.id))||characterRoles()[0];editingRoleId=r.id;
  return panelHead('设计背景','选好制作方向，在同一处核对资料、调整设计。')+backgroundSteps()+`
  <div class="direction-choices" aria-label="选择制作方向">${characterRoles().map(x=>`<div class="direction-option ${x.id===r.id?'current':''} ${ids.includes(x.id)?'chosen':''}"><input type="checkbox" data-design-direction="${x.id}" aria-label="选用 ${esc(x.name)||'未命名方向'}" ${ids.includes(x.id)?'checked':''}><button data-action="edit-background-role" data-id="${x.id}" aria-pressed="${x.id===r.id}">${esc(x.name)||'未命名方向'}</button></div>`).join('')}<button class="text-action" data-action="add-background-role">${icon('plus')}添加</button></div>
  <p class="small muted">勾选决定本次制作范围；点击名称查看详情，不改变已选范围。已选 ${ids.length} 个。</p>
  <div class="background-columns"><section class="background-evidence"><h3>资料与依据</h3><p class="role-summary">${esc(r.summary)||'可直接填写已有的角色设定。'}</p>${(r.sourceIds||[]).filter(i=>state.sources[i]).map(i=>`<a class="source-link" href="${esc(state.sources[i].url)}" target="_blank" rel="noopener noreferrer">${esc(state.sources[i].title)}</a>`).join('')}
  <details><summary>出处核对状态</summary><label class="field"><span>依据状态</span><select data-role-evidence="${r.id}">${[['unverified','待核实／创作参考'],['user','用户原创设定'],['reviewed','我已核对所附出处']].map(([v,n])=>`<option value="${v}" ${(r.evidence||'unverified')===v?'selected':''}>${n}</option>`).join('')}</select></label></details>
  ${r.suggestion?`<h3>AI 造型建议</h3><p class="role-summary">${esc(r.suggestion.proposal)}</p><details><summary>查看细化建议</summary><p>${esc(designText(r.suggestion))}</p></details><div class="row"><button data-action="accept-suggestion" data-id="${r.id}" ${suggestionWasApplied(r)?'disabled':''}>${suggestionWasApplied(r)?'已补充':'补充到设计'}</button><button class="text-action" data-action="dismiss-suggestion" data-id="${r.id}">${r.suggestionDecision==='dismissed'?'已忽略':'忽略建议'}</button></div>`:''}</section>
  <section><label class="field"><span>角色名称</span><input data-role="${r.id}" data-key="name" maxlength="100" value="${esc(r.name)}"></label><label class="field"><span>视觉特征</span><textarea class="compact-input" data-role="${r.id}" data-key="feature" maxlength="600">${esc(r.feature)}</textarea></label><label class="field"><span>最终设计（可选）</span><textarea data-role="${r.id}" data-key="proposal" maxlength="2000" placeholder="填写自己的要求；留空时沿用未忽略的 AI 建议">${esc(r.proposal||'')}</textarea></label>${roleDesignFields(r)}${currentCharacter()&&characterRoles().length>1?`<button class="text-action" data-action="separate-direction" data-id="${r.id}">作为独立角色制作</button>`:''}<button class="text-action danger" data-action="remove-role" data-id="${r.id}">移除方向</button></section></div>
  <div class="panel-footer"><button data-action="background-part" data-part="request">修改需求</button><button class="primary" data-action="confirm-background" ${ids.length?'':'disabled'}>使用已选 ${ids.length} 个方向，继续参考 ${icon('arrow')}</button></div>`;
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-action]');if(!button)return;const a=button.dataset.action;if(!['background-part','edit-background-role','add-background-role'].includes(a))return;e.stopImmediatePropagation();if(a==='background-part'){const part=button.dataset.part;if(part!=='request'&&!characterRoles().length)return;if(part==='design'&&backgroundPart==='facts'&&prepareDesignDetails()===false)return;backgroundView=part==='request'?'request':'results';if(part!=='request')backgroundPart=part;}if(a==='edit-background-role'){editingRoleId=button.dataset.id;if(button.dataset.part==='design'){backgroundPart='design';backgroundView='results';}}if(a==='add-background-role'){if(characterRoles().length>=10||state.roles.length>=100){toast('最多 10 个角色。');return;}snapshot();const r={id:uid(),name:'',feature:'',pose:'',enabled:!Array.isArray(state.directionIds),referenceChoices:[]};state.roles.push(r);registerCharacterRoles([r.id]);editingRoleId=r.id;backgroundPart='facts';scheduleSave();}renderPanel();const area=$('#inspector .inspector-content');if(area)area.scrollTop=0;},true);
// Research refreshes evidence and proposes designs; user-authored fields remain owned by the user.
function mergeResearch(data,project=state){
  const sources=structuredClone(project.sources),roles=structuredClone(project.roles),indices=[];
  for(const src of (Array.isArray(data.sources)?data.sources:[]).slice(0,15)){
    if(!src||!/^https?:\/\//.test(src.url)){indices.push(-1);continue;}
    const next={title:cleanText(src.title,200),url:cleanText(src.url,2000),summary:cleanText(src.summary,2000)};
    let index=sources.findIndex(x=>x.url===next.url&&x.summary===next.summary);
    if(index<0){index=sources.length;sources.push(next);}indices.push(index);
  }
  const names=new Set();
  for(const incoming of data.roles){
    if(!incoming||typeof incoming.name!=='string'||!incoming.name.trim())continue;
    const name=incoming.name.trim().slice(0,100);
    if(names.has(name))throw Error('研究返回了重复角色，原内容未修改，请重试。');names.add(name);
    let role=roles.find(r=>r.name.trim()===name&&(!currentCharacter()||currentCharacter().roleIds.includes(r.id)));
    if(!role){role={id:uid(),name,feature:'',proposal:'',pose:'',...designData({}),enabled:!Array.isArray(project.directionIds),excludedRefs:[],referenceChoices:[]};roles.push(role);}
    role.summary=cleanText(incoming.summary,600);
    role.sourceIds=[...new Set([...(role.sourceIds||[]),...(Array.isArray(incoming.source_ids)?incoming.source_ids:[]).filter(i=>Number.isInteger(i)&&indices[i]>=0).map(i=>indices[i])])];
    role.researchFeature=cleanText(incoming.feature,600);
    if(!role.feature?.trim())role.feature=role.researchFeature;
    const suggestion={proposal:cleanText(incoming.proposal,600),...designData(incoming)};
    if(JSON.stringify(suggestion)!==JSON.stringify(role.suggestion)){role.suggestion=suggestion;role.suggestionDecision='pending';}
    role.evidence=role.evidence==='user'?'user':'unverified';
  }
  if(roles.length>100)throw Error('新增后超过 100 个设计方向，原内容未修改。请移除不需要的角色后重试。');
  // Retain only cited evidence; remap indices without changing any existing citation.
  const used=[...new Set(roles.flatMap(r=>r.sourceIds||[]))].filter(i=>sources[i]);
  if(used.length>150)throw Error('资料数量已达上限，原内容未修改。请导出备份后新建项目。');
  for(const role of roles)role.sourceIds=(role.sourceIds||[]).map(i=>used.indexOf(i)).filter(i=>i>=0);
  return {roles,sources:used.map(i=>sources[i])};
}
async function research(){backgroundPart='facts';await baseResearch();}
function applyReferenceAnalysis(r){
  if(!r.analysis?.trim()||r.analysisApplied===r.analysis)return false;
  const current=r.note||'',incoming=r.analysis;
  const note=current.includes(incoming)?current:current.trim()?current+'\n【AI 补充】'+incoming:current+incoming;
  if(note.length>300)throw Error('补充后超过 300 字，原说明未修改。请从建议中选取需要的内容，或精简后再补充。');
  r.note=note;r.analysisApplied=incoming;return true;
}
function validateBriefDirections(roles){
  if(!state.brief.trim()||!roles.length||roles.some(r=>!r.name.trim()||!r.feature.trim()))throw Error('先填写需求，并补充已选方向的名称和视觉特征。');
  if(new Set(roles.map(r=>r.name.trim())).size!==roles.length)throw Error('已选方向的名称不能重复，请设置可区分的名称。');
  if(roles.some(r=>r.evidence==='reviewed'&&!(r.sourceIds||[]).some(i=>state.sources[i])))throw Error('没有关联出处的方向不能标为已核对；可选择用户原创或待核实。');
}
function confirmBrief(){validateBriefDirections(selectedRoles());state.briefApproval={key:briefKey(),at:new Date().toISOString(),roles:structuredClone(selectedRoles()),sources:structuredClone(state.sources)};}
function refsForRole(role,refs=state.refs,s=state){return baseRefsForRole(role,refs).filter(r=>(!r.taskType||r.taskType==='all'||r.taskType===s.type)&&!(s.type==='views'&&r.role==='姿态'));}
function referenceConflicts(roles=characterRoles(),types=['portrait','views','card']){
  const out=[];for(const r of roles){for(const type of types){const refs=refsForRole(r,state.refs,{...state,type});for(const use of ['画风','角色','构图','姿态','材质']){const same=refs.filter(x=>x.role===use);if(same.length>1&&same.filter(x=>x.priority==='primary').length!==1&&same.some(x=>!x.note?.trim()))out.push(`${r.name} · ${TYPES[type].name}的${use}参考需指定一张主参考，或逐张说明取用范围`);}}}return [...new Set(out)];
}
function referenceWarnings(){const warnings=referenceConflicts();return warnings.length?`<details open><summary>待处理的参考搭配 · ${warnings.length}</summary><p class="small muted">按用途和范围提醒，不代表 AI 已识别图片冲突。</p>${warnings.map(w=>`<p class="notice">${esc(w)}</p>`).join('')}</details>`:'';}
function refExtra(r){return `<details class="reference-note"><summary>适用任务与取用范围</summary>
  <div class="form-pair"><label class="field"><span>适用素材</span><select data-ref-flow="taskType" data-id="${r.id}">${[['all','所有类型'],['portrait','仅立绘'],['views','仅三视图'],['card','仅卡牌']].map(([v,l])=>`<option value="${v}" ${(r.taskType||'all')===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field"><span>优先级</span><select data-ref-flow="priority" data-id="${r.id}"><option value="normal" ${r.priority!=='primary'?'selected':''}>辅助参考</option><option value="primary" ${r.priority==='primary'?'selected':''}>同用途主参考</option></select></label></div>
  <label class="field"><span>只取用什么</span><textarea class="compact-input" data-ref-note="${r.id}" maxlength="300" placeholder="例如：只取服装的金属材质">${esc(r.note||'')}</textarea></label>
  <label class="field"><span>不要取用什么</span><input data-ref-flow="avoid" data-id="${r.id}" maxlength="300" value="${esc(r.avoid||'')}" placeholder="例如：不参考脸型和发色"></label>
  <label class="field"><span>来源链接或作者</span><input data-ref-source="${r.id}" maxlength="500" value="${esc(r.source||'')}"></label>
  <button class="text-action" data-action="analyze-reference" data-id="${r.id}" ${busy?'disabled':''}>${icon('spark')}AI 提取图片特征</button>
  ${r.analysis?`<div class="suggestion"><p>${esc(r.analysis)}</p><button data-action="use-reference-analysis" data-id="${r.id}" ${r.analysisApplied===r.analysis?'disabled':''}>${r.analysisApplied===r.analysis?'已补充':'补充到取用说明'}</button></div>`:'<p class="small muted">需连接支持图像输入的接口；分析仅作建议。</p>'}</details>`;}
function refsPanel(){
  const focused=state.refs.find(r=>r.id===libraryPreviewId);if(focused&&libraryPreviewProject===state)return libraryReferencePanel(focused);
  const roles=selectedRoles(),role=roles.find(r=>r.id===referencePickerRole)||roles[0];if(role)referencePickerRole=role.id;
  return panelHead('参考图','勾选本次使用的图片；点击图片放大并设置用途。')+`
  <div class="row"><button class="primary" data-action="upload-refs">${icon('upload')}上传图片</button><span class="small muted">图库 ${state.refs.length} 张 · 上传不自动选用</span></div>
  ${roles.length>1?`<div class="role-switcher" aria-label="参考图用于哪个角色">${roles.map(r=>`<button data-action="reference-role" data-id="${r.id}" class="${r.id===role.id?'current':''}">${esc(r.name)} · ${refsForRole(r).length}</button>`).join('')}</div>`:role?`<h3>${esc(role.name)}</h3>`:'<p class="notice">先在背景中选择制作方向，再为角色选图。</p>'}
  ${role?basePromptReferences(role).replace(/<button data-action="reference-picker-toggle"[\s\S]*?<\/button>/,''):''}
  <details><summary>统一画风与查找图片（可选）</summary><label class="field"><span>统一画风</span><textarea data-state="style" maxlength="2000" placeholder="例如：线条、配色与绘画表现">${esc(state.style)}</textarea></label><label class="field"><span>查找参考图</span><input id="ref-query" placeholder="题材或风格关键词"></label><button data-action="search-refs">打开图片搜索</button><p class="small muted">选好后上传；不会自动采集图片。</p></details>
  ${referenceWarnings()}<div class="panel-footer"><button class="primary" data-action="confirm-references">沿用这些参考，继续规格 ${icon('arrow')}</button></div>`;
}
function promptReferences(role){if(!role)return '';const roles=selectedRoles();return `<section class="reference-summary"><div class="row"><h3>已沿用参考</h3><span class="space"></span><button class="text-action" data-action="refs">更换参考</button></div>${roles.map(r=>`<p class="small">${esc(r.name)} · ${refsForRole(r).length} 张${refsForRole(r).length?' · '+REFERENCE_USES.map(u=>{const n=refsForRole(r).filter(x=>x.role===u).length;return n?u+' '+n:'';}).filter(Boolean).join(' / '):' · 仅文字要求'}</p>`).join('')}</section>`;}
function productionSpec(s=state){const spec=baseProductionSpec(s),f=flow(s);
  if(spec.type==='portrait'&&f.crop==='half'){
    spec.purpose='对话或人物介绍用半身立绘。';spec.summary[2]='半身聚焦';
    spec.rules[0]=spec.rules[0].replace('全身','半身');
    spec.rules[2]='单角色半身或腰部以上入画，头部与关键识别点完整；裁切避开肘腕等关节，不强求腿脚入画。';
    spec.rules[spec.rules.findIndex(x=>x.startsWith('避免：'))]='避免：多人、重复身体、无关道具、文字、水印、边框、UI。半身构图允许计划内的下身裁切。';
    spec.checks[0]='半身裁切避开关节，头部与关键识别点完整';
  }
  if(spec.type!=='views')spec.rules.push('表情要求：'+f.expression+'；适配角色解剖结构，不擅自改变脸型。');
  spec.rules.push('保持不变：角色身份、标志性结构、主要服装和项目画风'+(f.fixed?'；'+f.fixed:'')+'。');
  spec.rules.push('允许变化：'+(spec.type==='views'?'仅改变观察视角，保持中立姿态与同一套造型':f.variable||'只按当前模板改变姿态、构图与表情')+'。');
  if(f.transparent&&spec.type!=='views'){spec.rules.push('交付需带真实透明通道；纯色底只作中间图。未实现自动抠图，须导入已处理素材。透明像素检测不替代边缘质量人工检查。');if(spec.type==='portrait'){spec.rules[4]='最终交付为透明背景，单角色清晰轮廓，无场景、地台或投影；纯色底仅可作待抠图中间图。';spec.checks[2]='真实透明背景且抠图边缘无残留，画风与角色设定符合要求';spec.summary[1]='透明交付';}else{spec.rules[4]='最终交付为透明背景，保留角色与明确指定的技能效果，不生成环境；禁止将棋盘格画进图片。';spec.checks[0]='透明背景下主角与识别点清楚，边缘无残留，特效不遮挡主体';}}
  spec.checks.push('同角色身份与已确认基准一致；不同角色仍可区分');spec.requiresAlpha=f.transparent&&spec.type!=='views';return spec;
}
function expand(role,s=state){if(role.seriesStyle)s={...s,style:role.seriesStyle};const refs=refsForRole(role,state.refs,s);let text=baseExpand(role,s);if(state.world?.trim())text='项目世界背景：'+state.world+'\n\n'+text;const old=refsForRole(role);if(old.length){const marker='\n\n参考图使用范围：';text=text.split(marker)[0];}
  const styleRefs=refs.map((r,i)=>({r,i})).filter(({r})=>r.role==='画风');
  if(styleRefs.length)text='画风基准：'+styleRefs.map(({r,i})=>'参考图'+(i+1)+(r.priority==='primary'?'（主画风）':'')+(r.note?'，'+r.note:'')).join('；')+'。沿用其线条、上色、明暗层次与材质的绘画表现，角色身份和服装结构按下文设计。背景资料中的雕塑、壁画或实物材质用于解释造型，不自动转换成照片或三维渲染；表现方式以画风参考与用户明确的风格要求为准。\n\n'+text;

  if(refs.length)text+='\n\n参考图使用范围：\n'+refs.map((r,i)=>`参考图${i+1}：${asset(r.asset)?.name||'图片'}；仅参考${r.role}${r.priority==='primary'?'（同用途主参考）':''}${r.note?'；取用：'+r.note:''}${r.avoid?'；不取用：'+r.avoid:''}`).join('\n')+'\n每张图只按指定用途取用；发生冲突时同用途主参考优先，不混合其他角色身份。';return text;
}
function productionIssues(roles=selectedRoles()){const out=baseProductionIssues(roles);for(const r of roles){const d=promptDraft(r);if(d&&!d.text.trim())out.push({step:'template',text:r.name+'：最终提示词不能为空'});if(d&&d.source!==promptSource(r))out.push({step:'template',text:r.name+'：要求已更新，请核对手写提示词'});}if(referenceConflicts(roles,[state.type]).length)out.push({step:'refs',text:'处理本次角色的参考搭配提醒'});return out;}
function previewPilotRole(){const roles=Array.isArray(state.directionIds)?selectedRoles():characterRoles();return roles.find(r=>r.id===previewRoleId&&r.name.trim())||roles.find(r=>r.name.trim());}
function pilotRoles(b){const available=characterRoles();return b?.pilotRoleIds?b.pilotRoleIds.map(id=>available.find(r=>r.id===id)).filter(Boolean):selectedRoles();}

function flowControls(){const f=flow();return `<details><summary>固定项、变化项与交付规格</summary>
  ${state.type==='portrait'?`<label class="field"><span>立绘范围</span><select data-flow="crop"><option value="full" ${f.crop==='full'?'selected':''}>完整全身</option><option value="half" ${f.crop==='half'?'selected':''}>半身／对话</option></select></label>`:''}
  ${state.type!=='views'?`<label class="field"><span>表情</span><input data-flow="expression" maxlength="160" value="${esc(f.expression)}" placeholder="如：平静、警惕、愤怒"></label>`:''}
  <label class="field"><span>额外固定项</span><textarea class="compact-input" data-flow="fixed" maxlength="600" placeholder="如：保留额头纹样、右肩护甲，不换装">${esc(f.fixed)}</textarea></label>
  <label class="field"><span>本次允许变化</span><textarea class="compact-input" data-flow="variable" maxlength="600" placeholder="留空沿用所选模板；不要与固定项冲突">${esc(f.variable)}</textarea></label>
  ${state.type==='views'?'<p class="small muted">当前三视图采用白底设定板，不套用立绘的透明要求。</p>':`<label class="check-option"><input type="checkbox" data-flow="transparent" ${f.transparent?'checked':''}>交付要求真实透明背景</label><p class="small muted">透明要求将在导入与交付时检查；本工具不自动抠图。</p>`}</details>`;}
function templatePanel(){let html=baseTemplatePanel().replace('提示词模板</h2>','制作规格</h2>');html=html.replace('<div class="preset-overview">',flowControls()+'<div class="preset-overview">');html=html.replace(/<div class="row"><h3>完整提示词[\s\S]*?<p class="small muted">[^<]*张参考图随该角色任务保存；点击生成时按编号发送实际图片。<\/p>/,()=>finalPromptEditor(previewPilotRole()));html=html.replace(/<div class="panel-footer">[\s\S]*$/,`<p class="small muted">Seedream 5.0 Pro · ${selectedRoles().length} 张试稿 · 按方舟账户计费${imageWatermark?' · 带可见水印':''}。已完成的试稿不会重复生成。</p><div class="panel-footer"><button class="primary" data-action="generate-pilots" ${!selectedRoles().length||generationBusy?'disabled':''}>生成试稿 · ${selectedRoles().length} 张 ${icon('spark')}</button></div>`);return html;}
function legacyPilotRecipe(){const parts=JSON.parse(signature());parts[5]=1;parts[9].variationMode='same';return JSON.stringify(parts);}
function pilotRecipe(roles=selectedRoles()){
  const normalized={...state,copies:1,options:{...normalizeOptions(state.options),variationMode:'same'}};
  const spec=productionSpec(normalized);
  return JSON.stringify({version:2,type:state.type,spec,roles:roles.map(r=>({id:r.id,prompt:promptDraft(r,normalized)?.text??expand(r,normalized),refs:refsForRole(r).map(ref=>({id:ref.id,asset:ref.asset}))}))});
}
function productionRecipe(roles){return JSON.stringify({type:state.type,copies:state.copies,jobs:roles.flatMap(r=>Array.from({length:state.copies},(_,i)=>{const s=variantState(i);return {id:r.id,prompt:expand(r,s),spec:productionSpec(s),refs:refsForRole(r,state.refs,s).map(x=>[x.id,x.asset])};}))});}
function batchCurrent(b){return b.phase==='pilot'?pilotCurrent(b):b.productionRecipe?b.productionRecipe===productionRecipe((b.contract?.brief?.roles||[]).map(r=>state.roles.find(x=>x.id===r.id)).filter(Boolean)):b.signature===signature();}
function comparableRecipe(value){try{const x=JSON.parse(value);for(const r of x.roles||[])r.prompt=r.prompt.replace(/\n\n依据状态：[^\n]*/g,'').replace(/；来源记录：[^\n]*/g,'');return JSON.stringify(x);}catch{return value;}}
function pilotCurrent(b){if(b.pilotRoleIds){const roles=pilotRoles(b);if(!roles.length)return false;let recipe=b.recipe;if(currentCharacter()){try{const value=JSON.parse(recipe);value.roles=value.roles.filter(r=>roles.some(x=>x.id===r.id));recipe=JSON.stringify(value);}catch{}}else if(roles.length!==b.pilotRoleIds.length)return false;return comparableRecipe(recipe)===comparableRecipe(pilotRecipe(roles));}return (b.recipe||b.signature)===(b.recipe?legacyPilotRecipe():signature());}
function roleMasterKey(r){return JSON.stringify([state.brief,state.style,r.name,r.feature,r.proposal,designData(r),baseRefsForRole(r).filter(x=>['画风','角色','材质'].includes(x.role)).map(x=>[x.id,x.asset,x.note||'',x.avoid||'',x.priority||'normal'])]);}
function validMaster(j,b){return !!j.asset&&j.baselineApproval?.asset===j.asset&&j.baselineApproval?.signature===b.signature&&['identity','style','purpose'].every(k=>j.pilotChecks?.[k])&&!manualIssues(j).length&&!openIssues(j).length;}
function reusableMaster(role){for(const b of [...state.batches].reverse())for(const j of [...b.jobs].reverse())if(j.roleId===role.id&&validMaster(j,b)&&j.masterKey===roleMasterKey(role))return {job:j,batch:b};return null;}
function makeBatch(roleId){
  const roles=roleId?state.roles.filter(r=>r.id===roleId):selectedRoles();
  const issues=productionIssues(roles);if(issues.length){toast(issues[0].text);const step=issues[0].step;if(step==='background-results')backgroundView='results';openPanel(step==='background-results'?'background':step,step==='refs'?1:step==='template'?2:0);return;}
  const existing=state.batches.find(b=>b.phase==='pilot'&&pilotCurrent(b)&&JSON.stringify(pilotRoles(b).map(r=>r.id))===JSON.stringify(roles.map(r=>r.id)));if(existing){state.activeBatch=existing.id;openPanel('batch',3);toast('已打开这组要求的试稿。');return existing;}
  if(state.batches.length>=60){toast('最多60个批次，请导出备份后新建项目。');return;}
  snapshot();const spec=productionSpec();const b={id:uid(),phase:'pilot',pilotRoleIds:roles.map(r=>r.id),recipe:pilotRecipe(roles),signature:signature(),type:state.type,typeName:spec.name,spec:structuredClone(spec),refs:structuredClone(state.refs),brief:state.brief,style:state.style,created:new Date().toISOString(),contract:{brief:{brief:state.brief,roles:structuredClone(roles),sources:structuredClone(state.sources)},flow:flow()},jobs:[]};
  for(const r of roles){
    const master=promptMaster(r),refs=refsForRole(r),job={id:uid(),name:r.name+' · 试稿',variant:'试稿',roleId:r.id,roleName:r.name,roleFeature:[r.feature,r.proposal,designText(r)].filter(Boolean).join('；'),prompt:finalPilotPrompt(r),w:spec.w,h:spec.h,requiresAlpha:spec.requiresAlpha,referenceIds:refs.map(x=>x.id),referenceBindings:refs.map(referenceBinding),checks:[...spec.checks],manual:{},issues:[],reviewNote:'',asset:null,adopted:false,ai:'',parent:null,pilotChecks:{},masterKey:roleMasterKey(r)};
    if(master){const ref={id:'master-'+job.id,asset:master.job.asset,role:'角色',scope:r.id,note:'已确认的角色基准；仅保留身份和造型，当前构图按新规格',priority:'primary',source:'项目内已确认试稿 '+master.job.id};b.refs.push(ref);job.referenceIds.push(ref.id);job.baselineAsset=master.job.asset;job.baselineJob=master.job.id;}
    if(job.prompt.length>50000){toast('提示词过长，请精简后创建。');return;}b.jobs.push(job);
  }
  state.batches.push(b);state.activeBatch=b.id;changed();openPanel('batch',3);return b;
}
function approvePilot(id){const b=active(),j=b?.jobs.find(j=>j.id===id);if(!j?.asset)throw Error('先导入试稿图片。');if(b.phase!=='pilot')throw Error('请在试稿批次中选定基准。');if(!pilotCurrent(b))throw Error('制作要求已改变，请按新要求创建试稿。');if(openIssues(j).length||manualIssues(j).length)throw Error('先处理试稿中的问题记录。');for(const other of b.jobs)if(other.id!==j.id&&other.roleId===j.roleId)other.baselineApproval=null;j.pilotChecks={identity:true,style:true,purpose:true};j.baselineApproval={asset:j.asset,signature:b.signature,at:new Date().toISOString()};j.adopted=true;j.rejected=false;}
function expandApprovedBatch(){
  const pilot=active();if(pilot?.phase!=='pilot')throw Error('先打开一组试稿。');if(!pilotCurrent(pilot))throw Error('本次角色的出图要求已改变；旧试稿仍保留，请按新要求试稿。');const issues=productionIssues(pilotRoles(pilot));if(issues.length)throw Error(issues[0].text);
  const chosen=pilotRoles(pilot).map(r=>({r,j:[...pilot.jobs].reverse().find(j=>j.roleId===r.id&&validMaster(j,pilot))}));if(chosen.some(x=>!x.j))throw Error('每个参与角色都需要一张已确认试稿。');
  const baselineSelection=chosen.map(({r,j})=>({roleId:r.id,jobId:j.id,assetId:j.asset}));const exists=state.batches.find(b=>b.pilotId===pilot.id&&(b.productionRecipe?b.productionRecipe===productionRecipe(chosen.map(x=>x.r)):b.signature===signature())&&JSON.stringify(b.baselineSelection)===JSON.stringify(baselineSelection));if(exists){state.activeBatch=exists.id;return exists;}
  if(state.batches.length>=60)throw Error('最多60个批次，请先导出项目备份。');
  const b={id:uid(),phase:'production',pilotId:pilot.id,baselineSelection,productionRecipe:productionRecipe(chosen.map(x=>x.r)),signature:signature(),created:new Date().toISOString(),type:state.type,typeName:TYPES[state.type].name,spec:structuredClone(productionSpec()),refs:structuredClone(state.refs),brief:state.brief,style:state.style,contract:structuredClone(pilot.contract),jobs:[]};
  for(const {r,j:master} of chosen){const ref={id:'master-'+master.id,asset:master.asset,role:'角色',scope:r.id,note:'已确认基准：保留身份、服饰与识别结构；姿态和视角按任务要求',priority:'primary',source:'试稿 '+master.id};b.refs.push(ref);
    for(let i=0;i<state.copies;i++){const s=variantState(i),spec=productionSpec(s),refs=refsForRole(r,state.refs,s),variant=state.type==='portrait'&&normalizeOptions(state.options).variationMode==='poses'?selectedPose(s).name:'方案 '+(i+1);b.jobs.push({id:uid(),name:r.name+' · '+variant,variant,roleName:r.name,roleId:r.id,roleFeature:master.roleFeature,prompt:expand(r,s)+'\n参考图'+(refs.length+1)+'：已确认的角色基准图；保持身份、服装、关键部件，当前动作和构图以本任务为准。同用途发生冲突时以此基准的角色造型为准。',w:spec.w,h:spec.h,requiresAlpha:spec.requiresAlpha,referenceIds:[...refs.map(x=>x.id),ref.id],referenceBindings:refs.map(referenceBinding),baselineAsset:master.asset,baselineJob:master.id,checks:[...spec.checks],manual:{},issues:[],reviewNote:'',asset:null,adopted:false,ai:'',parent:null});}
  }
  state.batches.push(b);state.activeBatch=b.id;return b;
}
function batchPanel(){const b=active();if(!b)return panelHead('试稿与批量','先确认一张试稿，再扩展一组素材。')+'<button class="primary" data-action="template">确定制作规格</button>';
  const pilot=b.phase==='pilot',ready=pilot?pilotRoles(b).filter(r=>b.jobs.some(j=>j.roleId===r.id&&validMaster(j,b))).length:0;
  return panelHead(pilot?'确认试稿':'批量素材',pilot?`${ready} / ${pilotRoles(b).length} 个角色已确认方向`:`${batchJobs(b).length} 个任务 · 基准与制作要求已保存`)+`
  <div class="batch-toolbar">${generationToolbar(b)}</div>
  <label class="field batch-picker"><span>当前批次</span><select data-batch>${characterBatches().map((x,i)=>`<option value="${x.id}" ${x.id===b.id?'selected':''}>${i+1} · ${x.phase==='pilot'?'试稿':x.phase==='production'?'批量':'历史任务'} · ${x.typeName}</option>`).join('')}</select></label>
  ${!batchCurrent(b)?'<p class="notice">要求已变化，旧任务保留原要求。</p><button data-action="template">查看新要求并试稿</button>':''}
  <div class="batch-jobs ${pilot?'pilot-grid':''}">${batchJobs(b).map(j=>`<article class="job ${pilot?'pilot-card':''}"><div class="row"><strong>${esc(j.name)}</strong><span class="space"></span>${ib('import-result',j.asset?'替换结果图片':'导入试稿或结果','upload',`data-id="${j.id}"`)}</div><p class="small muted">${j.w} × ${j.h} · ${taskRefs(j,b).length} 张参考${j.parent?' · 返修版本':''}</p>
  ${j.asset?`${resultImageButton(j.asset,j.name)}`: generationJob(j,b)}
  ${j.referenceAsset?`<details data-detail-key="job-original-${j.id}"><summary>本轮返修原图</summary>${resultImageButton(j.referenceAsset,'本轮返修原图')}<p class="small muted">${esc(j.revision?.change||'')}<br>保持：${esc(j.revision?.keep||'')}</p></details>`:''}
  ${j.baselineAsset?`<details data-detail-key="job-baseline-${j.id}"><summary>本任务使用的角色基准</summary>${resultImageButton(j.baselineAsset,'角色基准图')}</details>`:''}
  ${pilot?`<button class="text-action" data-action="another-pilot" data-id="${j.id}" title="生成新图片，保留当前方案；按方舟账户计费">${icon('plus')}再生成一张</button><span class="small muted">Seedream · 1 张 · 计费</span>`:''}
  ${j.asset?`<div class="row"><button class="${validMaster(j,b)?'':'primary'}" data-action="${pilot?'approve-pilot':'adopt'}" data-id="${j.id}" ${pilot&&validMaster(j,b)?'disabled':''}>${pilot&&validMaster(j,b)?'已采用':j.adopted?'取消选用':'采用这张'}</button><button data-action="revision" data-id="${j.id}">修改这张</button><button class="text-action" data-action="new-series" data-batch="${b.id}" data-id="${j.id}">扩展同风格系列</button></div><p class="small muted">采用表示认可设计方向；文件与结构检查在审核中查看。</p>`:''}
  <details data-detail-key="job-prompt-${j.id}"><summary>提示词与参考</summary><button class="text-action" data-action="edit-job-prompt" data-id="${j.id}">修改提示词</button><pre class="prompt-preview">${esc(j.prompt)}</pre>${taskRefs(j,b).map((r,i)=>`<p class="small">参考图${i+1} · ${esc(asset(r.asset)?.name)} · ${esc(r.role)}</p>`).join('')}</details></article>`).join('')}</div>
  ${pilot?`<details><summary>继续批量生成（可选）</summary><p class="small muted">沿用已采用的试稿与参考。Seedream 5.0 Pro · 按方舟账户计费。</p><label class="field"><span>每角色新增张数</span><select data-copies>${[1,2,3,4].map(n=>`<option value="${n}" ${state.copies===n?'selected':''}>${n} 张</option>`).join('')}</select></label>${state.type==='portrait'?`<label class="field"><span>变化方式</span><select data-option="variationMode"><option value="same" ${normalizeOptions(state.options).variationMode==='same'?'selected':''}>保持当前姿态</option><option value="poses" ${normalizeOptions(state.options).variationMode==='poses'?'selected':''}>站姿／坐姿／动态／悬浮系列</option></select></label>`:''}<p class="small muted">${pilotRoles(b).map(r=>esc(r.name)).join('、')} · 共 ${pilotRoles(b).length*state.copies} 张</p><button data-action="expand-approved" ${ready!==pilotRoles(b).length||generationBusy?'disabled':''}>生成批量素材 · ${pilotRoles(b).length*state.copies} 张</button></details>`:''}
  <div class="panel-footer"><button class="primary" data-action="review">查看结果，审核与导出 ${icon('arrow')}</button></div>`;
}
function openIssues(j){return (j.issues||[]).filter(x=>x.status!=='resolved');}
function issueRows(j){return `<details><summary>问题与处理 · ${openIssues(j).length} 项待处理</summary>
  ${(j.issues||[]).map(x=>`<div class="issue-entry"><div class="form-pair"><label class="field"><span>层次</span><select data-issue-field="layer" data-issue="${x.id}" data-job="${j.id}">${['单张质量','角色一致性','整组区分度','文件规格'].map(v=>`<option ${x.layer===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>程度</span><select data-issue-field="severity" data-issue="${x.id}" data-job="${j.id}">${['需修改','阻断交付','待讨论'].map(v=>`<option ${x.severity===v?'selected':''}>${v}</option>`).join('')}</select></label></div>
  ${[['location','问题位置'],['reason','判断依据'],['change','需要怎么改'],['keep','哪些不能动']].map(([k,l])=>`<label class="field"><span>${l}</span><input data-issue-field="${k}" data-issue="${x.id}" data-job="${j.id}" value="${esc(x[k])}" maxlength="500"></label>`).join('')}
  <label class="field"><span>处理结论</span><input data-issue-field="resolution" data-issue="${x.id}" data-job="${j.id}" value="${esc(x.resolution)}" maxlength="500" placeholder="复核通过或不采纳的具体理由"></label>
  <button data-action="resolve-issue" data-id="${j.id}" data-issue="${x.id}">${x.status==='resolved'?'重新打开问题':'记录结论并关闭问题'}</button></div>`).join('')}
  <button class="text-action" data-action="add-issue" data-id="${j.id}">${icon('plus')}记录一个问题</button></details>`;}
function specIssues(j){const out=baseSpecIssues(j),a=asset(j.asset);if(a&&j.requiresAlpha&&a.hasTransparency!==true)out.push(a.hasTransparency===false?'需要真实透明背景，当前图片完全不透明':'透明信息尚未检查，请重新导入图片');return out;}
function deliveryProblems(j){return [!j.asset?'缺少图片':'',...specIssues(j),...(j.checks||[]).some((_,i)=>j.manual?.[i]!=='pass')?['人工检查未全部通过']:[],...openIssues(j).length?['仍有待处理问题']:[]].filter(Boolean);}
function reviewPanel(){let html=baseReviewPanel().replace('审核与返修</h2>','审核与导出</h2>');html=html.replace('<button class="text-action" data-action="export-review">导出记录</button>','<button class="text-action" data-action="delivery">查看导出清单</button>');for(const j of resultJobs()){const needle=`<div class="row"><button class="${j.adopted?'':'primary'} small" data-action="adopt" data-id="${j.id}">`;html=html.replace(needle,issueRows(j)+needle);}html=html.replaceAll('取消选定','取消选用').replaceAll('人工选定','保留这张').replaceAll('>返修</button>','>修改这张</button>');return html+`<p class="small muted">选择图片即可下载。未完成的检查和已有问题会写入清单，不会自动标为通过。</p><div class="panel-footer"><button class="primary" data-action="export-delivery" ${deliveryJobs().length?'':'disabled'}>导出已选 · ${deliveryJobs().length} 张 ${icon('download')}</button></div>`;}
function revisionPanel(id){const j=active()?.jobs.find(x=>x.id===id);if(!j)return '';return panelHead('修改图片',j.name)+`${seriesReturnId&&seriesById(seriesReturnId)?.characterIds.includes(currentCharacter()?.id)?`<button class="text-action" data-action="return-series" data-id="${seriesReturnId}">返回系列对照</button>`:''}
  ${j.asset?`${resultImageButton(j.asset,'返修原图')}`:''}
  <div class="row"><button class="text-action" data-action="background-results">改设定</button><button class="text-action" data-action="refs">改参考</button><button class="text-action" data-action="template">改规格</button></div><p class="small muted">方向有误，回上游修改后创建新试稿；局部问题在下方创建返修。</p>
  <label class="field"><span>哪里要改？</span><textarea id="revision-change" maxlength="1000">${esc([...manualIssues(j),j.reviewNote,...openIssues(j).map(x=>[x.location,x.reason,x.change].filter(Boolean).join('：'))].filter(Boolean).join('；'))}</textarea></label>
  <details><summary>保持不变的内容（已自动带入）</summary><label class="field"><span>本轮保持不变</span><textarea id="revision-keep" maxlength="1000">${esc(['保留角色身份、画风与输出规格',j.roleFeature,...openIssues(j).map(x=>x.keep)].filter(Boolean).join('；'))}</textarea></label></details>
  <p class="small muted">Seedream 5.0 Pro · 1 张 · 按方舟账户计费。保留原图和问题记录，生成独立版本。返修会携带原图与修改要求；模型仍可能改变未指定区域，需要复核。</p>
  <div class="panel-footer"><button class="primary" data-action="create-flow-revision" data-id="${j.id}">生成修改版 · 1 张</button></div>`;}
function createFlowRevision(id,change,keep){const b=active(),j=b?.jobs.find(x=>x.id===id);if(!j?.asset)throw Error('先导入需要返修的图片。');if(!change.trim()||!keep.trim())throw Error('请写明修改与保留的内容。');if(b.jobs.length>=60)throw Error('当前批次已达60个任务。');
  const productionPrompt=j.productionPrompt||j.prompt;const prompt=productionPrompt+'\n参考图'+((b.refs||[]).filter(r=>j.referenceIds.includes(r.id)).length+1)+'：本轮返修原图；以该图为修改基础，非修改区域保持不变。\n本轮返修：'+change+'\n保持不变：'+keep;if(prompt.length>50000)throw Error('返修提示词过长，请精简。');
  const copy={...structuredClone(j),id:uid(),name:j.roleName+' · 返修 '+(b.jobs.filter(x=>x.roleId===j.roleId&&x.parent).length+1),productionPrompt,prompt,asset:null,generation:null,adopted:false,rejected:false,ai:'',parent:j.id,referenceAsset:j.asset,manual:{},pilotChecks:{},baselineApproval:null,reviewNote:'',issues:openIssues(j).map(x=>({...x,id:uid(),status:'open',resolution:''})),revision:{change,keep,at:new Date().toISOString()}};b.jobs.push(copy);return copy;}
async function imageTransparency(src){const img=await loadImage(src);if(img.width*img.height>40000000)throw Error('图片像素超过4000万，请先缩小后导入。');const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;for(let i=3;i<data.length;i+=4)if(data[i]<255)return true;return false;}
function deliveryJobs(){return state.batches.flatMap(b=>batchJobs(b).filter(j=>j.adopted&&j.asset).map(j=>({j,b})));}
function safeFileName(name){return String(name||'素材').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/g,'').slice(0,70)||'素材';}
function deliveryPanel(){const rows=deliveryJobs();return panelHead('交付素材','导出全部批次中人工选定的版本，保留原始图片。')+`
  <p class="flow-status">${rows.length} 张已选定 · ZIP 素材包</p>
  ${rows.map(({j,b})=>`<div class="delivery-row">${resultImageButton(j.asset,j.name,'result-image-button thumb-button')}<div><strong>${esc(j.name)}</strong><small>${esc(b.typeName)} · ${asset(j.asset)?.w} × ${asset(j.asset)?.h}</small>${deliveryProblems(j).map(x=>`<p class="job-flag">${esc(x)}</p>`).join('')}</div>${ib('unselect-delivery','取消此交付版本','close',`data-id="${j.id}" data-batch-id="${b.id}"`)}</div>`).join('')||'<p class="notice">先选用需要导出的图片。</p>'}
  <p class="small muted">包括原图、交付清单、冻结的设定与参考来源、提示词和审核记录。不自动放大、抠图或改格式。</p>
  <div class="panel-footer"><button class="primary" data-action="export-delivery" ${rows.length?'':'disabled'}>${icon('download')}导出素材包</button></div>`;}
function crc32(bytes){let crc=0xffffffff;for(const n of bytes){crc^=n;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function storedZip(files){const chunks=[],central=[],encoder=new TextEncoder();let offset=0;for(const file of files){const name=encoder.encode(file.name),data=typeof file.data==='string'?encoder.encode(file.data):file.data,crc=crc32(data);const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,data);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);central.push(c);offset+=local.length+data.length;}
  const size=central.reduce((n,x)=>n+x.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);return new Blob([...chunks,...central,end],{type:'application/zip'});
}
function deliveryFiles(){const rows=deliveryJobs();if(!rows.length)throw Error('没有已选定的素材。');
  const files=[],manifest={schema:1,project:state.title,exportedAt:new Date().toISOString(),note:'用户导入或 Seedream 生成的原始图片；未自动放大、抠图或格式转换。',items:[]};
  for(const {j,b} of rows){const a=asset(j.asset),m=/^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(a.src);if(!m)throw Error('请重新导入可导出的图片：'+a.name);const name='images/'+safeFileName(j.roleName)+'_'+b.type+'_'+j.id+'.'+(m[1]==='jpeg'?'jpg':m[1]),data=Uint8Array.from(atob(m[2]),c=>c.charCodeAt(0));files.push({name,data});manifest.items.push({file:name,sourceName:a.name,origin:a.origin,generation:j.generation||null,role:j.roleName,jobId:j.id,batchId:b.id,phase:b.phase||'legacy',actualSize:[a.w,a.h],targetSize:[j.w,j.h],hasTransparency:a.hasTransparency??null,requiresAlpha:!!j.requiresAlpha,parent:j.parent,baselineJob:j.baselineJob||null,prompt:j.prompt,references:taskRefs(j,b).map((r,i)=>({number:i+1,name:asset(r.asset)?.name,id:r.id,role:r.role,note:r.note||'',avoid:r.avoid||'',source:r.source||''})),contract:b.contract||null,qualityStatus:deliveryProblems(j).length?'needs-review':'checked',warnings:deliveryProblems(j),review:{checks:j.checks,manual:j.manual,issues:j.issues||[],note:j.reviewNote,ai:j.ai,selectedBy:'user'}});}
  files.push({name:'交付清单.json',data:JSON.stringify(manifest,null,2)},{name:'使用说明.txt',data:'images 文件夹是人工选定的原始素材；选用不等于审核通过，请查看清单中的质量状态与提醒。\n交付清单包含尺寸、透明信息、来源、制作要求与审核记录。\nAI 意见仅是疑点提示，不替代人工结论；透明检测只验证存在透明像素，不证明抠图边缘合格。\n完整项目请另用顶部“导出项目”备份。'});return files;
}
function restoreLifecycle(s,raw){
  if(Array.isArray(raw.directionIds))s.directionIds=[...new Set(raw.directionIds.filter(id=>s.roles.some(r=>r.id===id)))];
  s.flow=flow(raw);s.referenceApproval=cleanText(raw.referenceApproval,100000);s.briefApproval=null;
  for(const a of s.assets){const x=raw.assets.find(x=>x.id===a.id);a.hasTransparency=typeof x?.hasTransparency==='boolean'?x.hasTransparency:null;}
  for(const r of s.roles){const x=raw.roles.find(x=>x.id===r.id)||{};r.evidence=['reviewed','user'].includes(x.evidence)?x.evidence:'unverified';r.suggestionDecision=['accepted','dismissed'].includes(x.suggestionDecision)?x.suggestionDecision:'pending';if(x.suggestion&&typeof x.suggestion==='object')r.suggestion={proposal:cleanText(x.suggestion.proposal,600),...designData(x.suggestion)};r.suggestionApplied=cleanText(x.suggestionApplied,10000);r.researchFeature=cleanText(x.researchFeature,600);r.seriesStyle=cleanText(x.seriesStyle,2000);r.promptDrafts={};for(const type of ['portrait','views','card']){const d=x.promptDrafts?.[type];if(d&&typeof d.text==='string')r.promptDrafts[type]={text:cleanText(d.text,50000),source:cleanText(d.source,100000),master:d.master&&s.assets.some(a=>a.id===d.master.asset)?{jobId:cleanText(d.master.jobId,100),asset:d.master.asset}:null};}}
  function extraRefs(refs,original){for(const r of refs){const x=(original||[]).find(x=>x.id===r.id)||{};r.taskType=['portrait','views','card'].includes(x.taskType)?x.taskType:'all';r.priority=x.priority==='primary'?'primary':'normal';r.avoid=cleanText(x.avoid,300);r.analysis=cleanText(x.analysis,300);r.analysisApplied=cleanText(x.analysisApplied,300);}}
  extraRefs(s.refs,raw.refs);
  // Only restore a current approval if the sanitized content still matches it.
  if(raw.briefApproval?.key===briefKey(s))s.briefApproval={key:briefKey(s),at:cleanText(raw.briefApproval.at,100),roles:structuredClone(s.roles),sources:structuredClone(s.sources)};
  const ids=new Set(s.assets.map(a=>a.id));
  for(const b of s.batches){const x=raw.batches.find(x=>x.id===b.id)||{};b.phase=['pilot','production'].includes(x.phase)?x.phase:'legacy';b.productionRecipe=cleanText(x.productionRecipe,1000000);b.pilotId=cleanText(x.pilotId,100);b.recipe=cleanText(x.recipe,100000);if(Array.isArray(x.pilotRoleIds))b.pilotRoleIds=[...new Set(x.pilotRoleIds.filter(id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(id)))].slice(0,10);b.baselineSelection=(Array.isArray(x.baselineSelection)?x.baselineSelection:[]).slice(0,10).map(v=>({roleId:cleanText(v.roleId,100),jobId:cleanText(v.jobId,100),assetId:ids.has(v.assetId)?v.assetId:null}));extraRefs(b.refs,x.refs);b.contract=x.contract&&typeof x.contract==='object'?(JSON.stringify(x.contract).length<=300000?structuredClone(x.contract):null):null;
    for(const j of b.jobs){const a=(x.jobs||[]).find(a=>a.id===j.id)||{};if(typeof a.promptEditDraft==='string')j.promptEditDraft=cleanText(a.promptEditDraft,50000);j.promptVersion=a.promptVersion===true;j.rejected=a.rejected===true&&!j.adopted;j.requiresAlpha=a.requiresAlpha===true;j.productionPrompt=cleanText(a.productionPrompt,50000);j.baselineAsset=ids.has(a.baselineAsset)?a.baselineAsset:null;j.baselineJob=cleanText(a.baselineJob,100);j.masterKey=cleanText(a.masterKey,100000);j.pilotChecks=Object.fromEntries(['identity','style','purpose'].map(k=>[k,a.pilotChecks?.[k]===true]));j.issues=(Array.isArray(a.issues)?a.issues:[]).slice(0,20).map(i=>({id:/^[\w-]{1,100}$/.test(i.id)?i.id:uid(),...Object.fromEntries(['layer','severity','location','reason','change','keep','resolution'].map(k=>[k,cleanText(i[k],500)])),status:i.status==='resolved'&&i.resolution?'resolved':'open'}));j.baselineApproval=a.baselineApproval?.asset===j.asset&&a.baselineApproval?.signature===b.signature?{asset:j.asset,signature:b.signature,at:cleanText(a.baselineApproval.at,100)}:null;j.revision=a.revision?{change:cleanText(a.revision.change),keep:cleanText(a.revision.keep),at:cleanText(a.revision.at,100)}:null;}
  }return s;
}
async function analyzeReference(id){const r=state.refs.find(x=>x.id===id),a=asset(r?.asset);if(!a)return;if(!apiReady){toast('先连接支持图像输入的 DeepSeek 接口。');openPanel('settings');return;}if(busy)return;busy=true;renderPanel();const project=state,source=a.src,role=r.role,note=r.note||'';
  try{const result=await api('reference',{src:await visionSource(source),role,note});if(state!==project||!state.refs.includes(r)||asset(r.asset)?.src!==source)return;if(r.role!==role||(r.note||'')!==note){toast('分析期间取用要求已修改，未写入旧建议，请重新分析。');return;}r.analysis=cleanText(result.note,300);scheduleSave();toast(r.analysis?'已提取建议，确认后才写入取用范围。':'未得到可用建议。');}catch(e){toast(e.message);}finally{busy=false;renderPanel();}}
const FLOW_ACTIONS=new Set(['reject-result','generate-pilots','reference-role','inherit-reference','make-one-pilot','another-pilot','confirm-background','accept-suggestion','dismiss-suggestion','confirm-references','approve-pilot','expand-approved','add-issue','resolve-issue','create-flow-revision','adopt','delivery','export-delivery','unselect-delivery','analyze-reference','use-reference-analysis']);
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-action]');if(!btn||!FLOW_ACTIONS.has(btn.dataset.action))return;e.stopImmediatePropagation();const a=btn.dataset.action,id=btn.dataset.id;
  try{
    if(a==='reject-result'){const j=active()?.jobs.find(x=>x.id===id);if(j){snapshot();j.rejected=!j.rejected;if(j.rejected)j.adopted=false;changed();}return;}
    if(a==='reference-role'){referencePickerRole=id;referenceDetailId='';changed();return;}
    if(a==='inherit-reference'){const r=state.roles.find(r=>r.id===btn.dataset.roleId),c=r?.referenceChoices?.find(c=>c.id===id);if(c){snapshot();r.referenceChoices=r.referenceChoices.map(x=>x===c?{id,inherit:true}:x);changed();}return;}
    if(a==='make-one-pilot'||a==='generate-pilots'){if(generationBusy)return;const role=previewPilotRole();if(a==='make-one-pilot'&&!role)return;const b=makeBatch(a==='make-one-pilot'?role.id:undefined);if(b)await runImageJobs(batchJobs(b).filter(j=>!j.asset&&!j.generation),b);return;}
    if(a==='confirm-background'){snapshot();if(continueFromBackground()){changed();openPanel('refs',1);}return;}
    if(a==='accept-suggestion'||a==='dismiss-suggestion'){const r=state.roles.find(x=>x.id===id);if(!r?.suggestion)return;snapshot();if(a==='accept-suggestion'){const added=applyDesignSuggestion(r);toast(added?'已补充建议，保留原有文字和已填写的约束。':'这条建议已添加，不会重复写入。');}else{dismissDesignSuggestion(r);toast('已标记不采用，现有设计内容保持不变。');}changed();return;}
    if(a==='confirm-references'){snapshot();state.referenceApproval=referenceKey();changed();openPanel('template',2);return;}
    if(a==='another-pilot'){if(generationBusy)return;const b=active(),j=b?.jobs.find(x=>x.id===id);if(!j||b.phase!=='pilot')return;if(b.jobs.length>=60)throw Error('本批已达60个任务。');snapshot();b.jobs.push({...structuredClone(j),id:uid(),name:j.roleName+' · 试稿 '+(b.jobs.filter(x=>x.roleId===j.roleId).length+1),asset:null,adopted:false,ai:'',manual:{},issues:[],reviewNote:'',pilotChecks:{},baselineApproval:null,generation:null,parent:null});changed();await runImageJobs([b.jobs.at(-1)],b);return;}
    if(a==='approve-pilot'){snapshot();approvePilot(id);changed();return;}
    if(a==='expand-approved'){if(generationBusy)return;snapshot();const b=expandApprovedBatch();changed();openPanel('batch',3);if(b)await runImageJobs(batchJobs(b).filter(j=>!j.asset&&!j.generation),b);return;}
    if(a==='add-issue'){const j=active()?.jobs.find(x=>x.id===id);if(!j)return;if((j.issues||[]).length>=20)throw Error('每张图最多20条问题，请合并相关问题。');snapshot();j.issues=j.issues||[];j.issues.push({id:uid(),layer:'单张质量',severity:'需修改',location:'',reason:'',change:'',keep:'',resolution:'',status:'open'});changed();return;}
    if(a==='resolve-issue'){const j=active()?.jobs.find(x=>x.id===id),issue=j?.issues?.find(x=>x.id===btn.dataset.issue);if(!issue)return;if(issue.status!=='resolved'&&!issue.resolution.trim())throw Error('请先写明处理结论，再关闭问题。');snapshot();issue.status=issue.status==='resolved'?'open':'resolved';changed();return;}
    if(a==='create-flow-revision'){if(generationBusy)return;snapshot();const b=active(),j=createFlowRevision(id,$('#revision-change').value,$('#revision-keep').value);changed();openPanel('batch',3);await runImageJobs([j],b);return;}
    if(a==='adopt'){const j=active()?.jobs.find(x=>x.id===id);if(!j)return;if(!j.asset)throw Error('尚无图片可选用。');snapshot();j.adopted=!j.adopted;if(j.adopted)j.rejected=false;changed();return;}
    if(a==='delivery'){openPanel('delivery',4);return;}
    if(a==='unselect-delivery'){const j=state.batches.find(b=>b.id===btn.dataset.batchId)?.jobs.find(j=>j.id===id);if(j){snapshot();j.adopted=false;changed();}return;}
    if(a==='export-delivery'){const files=deliveryFiles();download(safeFileName(state.title)+'_交付素材.zip',storedZip(files),'application/zip');toast('已导出原始素材与交付清单。');return;}
    if(a==='analyze-reference'){await analyzeReference(id);return;}
    if(a==='use-reference-analysis'){const r=state.refs.find(x=>x.id===id);if(r?.analysis){snapshot();applyReferenceAnalysis(r);changed();}return;}
  }catch(err){toast(err.message);}
},true);
document.addEventListener('input',e=>{const t=e.target;if(t.dataset.flow){state.flow={...flow(),[t.dataset.flow]:t.type==='checkbox'?t.checked:t.value};scheduleSave();updatePromptPreview();}
  if(t.dataset.refFlow&&t.tagName!=='SELECT'){const r=state.refs.find(x=>x.id===t.dataset.id);if(r){r[t.dataset.refFlow]=t.value;scheduleSave();}}
  if(t.dataset.issueField&&t.tagName!=='SELECT'){const j=active()?.jobs.find(j=>j.id===t.dataset.job),x=j?.issues?.find(x=>x.id===t.dataset.issue);if(x){x[t.dataset.issueField]=t.value;scheduleSave();}}
});
document.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.roleEvidence){const r=state.roles.find(x=>x.id===t.dataset.roleEvidence);if(r){r.evidence=t.value;changed();}}
  if(t.dataset.flow){state.flow={...flow(),[t.dataset.flow]:t.type==='checkbox'?t.checked:t.value};changed();}
  if(t.dataset.refFlow){const r=state.refs.find(x=>x.id===t.dataset.id);if(r){r[t.dataset.refFlow]=t.value;changed();}}
  if(t.dataset.pilotCheck){const j=active()?.jobs.find(x=>x.id===t.dataset.id);if(j){j.pilotChecks=j.pilotChecks||{};j.pilotChecks[t.dataset.pilotCheck]=t.checked;if(!t.checked)j.baselineApproval=null;changed();}}
  if(t.dataset.issueField){const j=active()?.jobs.find(j=>j.id===t.dataset.job),x=j?.issues?.find(x=>x.id===t.dataset.issue);if(x){x[t.dataset.issueField]=t.value;scheduleSave();renderNodes();}}

});

// Result cards live on the canvas. Their prompts and references belong to frozen jobs.
function canvasResults(){return state.batches.flatMap(b=>batchJobs(b).filter(j=>asset(j.asset)).map(j=>({b,j})));}
function resultPosition(j,index){return j.canvasPosition||(Array.isArray(state.characters)?{x:(index%3)*380,y:420+Math.floor(index/3)*900}:{x:state.positions[3].x+(index%3)*380,y:Math.max(...state.positions.map(p=>p.y))+580+Math.floor(index/3)*900});}
function canvasResultMarkup(){return canvasResults().map(({b,j},index)=>{
  const a=asset(j.asset),p=resultPosition(j,index),refs=taskRefs(j,b),styleCount=refs.filter(r=>r.role==='画风').length;
  return `<article class="node result-node" data-result="${j.id}" style="left:${p.x}px;top:${p.y}px"><header class="node-title" data-result-drag="${j.id}"><h2>${esc(j.name)}</h2>${icon('drag')}</header><button class="result-picture" data-action="view-result" data-id="${j.id}" aria-label="放大 ${esc(j.name)}"><img src="${esc(a.src)}" alt="${esc(j.name)}" loading="lazy"></button><div class="result-content"><div class="row"><span class="small muted">${a.w} × ${a.h}</span><span class="space"></span><button class="text-action" data-action="result-batch" data-id="${j.id}">试稿与返修 ${icon('arrow')}</button></div><p class="small muted">本任务参考 · ${refs.length} 张${styleCount?' · 画风 '+styleCount+' 张':' · 未绑定画风图片'}</p>${refs.length?`<div class="result-refs">${refs.map((r,i)=>`<figure><img src="${esc(asset(r.asset)?.src)}" alt="参考图${i+1} ${esc(r.role)}" title="${esc(r.note||r.role)}"><figcaption>${i+1} · ${esc(r.role)}${r.priority==='primary'?' · 主':''}</figcaption></figure>`).join('')}</div>`:''}<div class="row"><strong class="small">本次提示词</strong><span class="space"></span>${ib('copy-result-prompt','复制本次提示词','copy',`data-id="${j.id}"`)}</div><button class="text-action" data-action="new-series" data-batch="${b.id}" data-id="${j.id}">扩展同风格系列 ${icon('arrow')}</button><p class="result-prompt-summary">${esc(j.prompt)}</p><details class="result-prompt-details"><summary>展开完整提示词</summary><pre class="prompt-preview">${esc(j.prompt)}</pre></details></div></article>`;
}).join('');}
function focusResult(id){const rows=canvasResults(),index=rows.findIndex(({j})=>j.id===id);if(index<0)return;const p=resultPosition(rows[index].j,index),vp=$('#viewport'),height=document.querySelector(`[data-result="${id}"]`)?.offsetHeight||760;document.body.classList.add('result-focused');view.z=Math.min(1,Math.max(.3,Math.min((vp.clientWidth-48)/352,(vp.clientHeight-(window.innerWidth<=520?120:60))/height)));view.x=(vp.clientWidth-352*view.z)/2-p.x*view.z;view.y=24-p.y*view.z;transform();}
document.addEventListener('toggle',e=>{if(e.target.classList?.contains('result-prompt-details'))requestAnimationFrame(()=>{const vp=$('#viewport');vp.scrollTop=0;vp.scrollLeft=0;});},true);
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-action]');if(!btn||!['view-result','result-batch','copy-result-prompt'].includes(btn.dataset.action))return;e.stopImmediatePropagation();const row=canvasResults().find(({j})=>j.id===btn.dataset.id);if(!row)return;const {b,j}=row;if(btn.dataset.action==='copy-result-prompt'){try{await navigator.clipboard.writeText(j.prompt);toast('已复制这张图的提示词。');}catch{toast('请展开提示词后选中复制。');}return;}state.activeBatch=b.id;selected=3;scheduleSave();if(btn.dataset.action==='result-batch'){openPanel('batch',3);return;}showImagePreview(j.asset,j.name);},true);

function prepareDesignDetails(){
  const ids=designDirectionIds();
  if(!ids.length&&Array.isArray(state.directionIds)){toast('先选一个想制作的方向。');return false;}
  if(!ids.length){const r=state.roles.find(r=>r.id===editingRoleId)||state.roles[0];if(!r)return;snapshot();state.directionIds=[r.id];scheduleSave();}
  if(!designDirectionIds().includes(editingRoleId))editingRoleId=designDirectionIds()[0];
}

let libraryPreviewId='',libraryPreviewProject=null;
function libraryReferencePanel(r){
  const a=asset(r.asset);if(!a)return panelHead('图片不存在');
  return panelHead('参考图用途','查看大图，说明要参考的部分。')+`<div class="library-reference-detail"><div class="library-reference-image"><img src="${esc(a.src)}" alt="${esc(a.name)}"><p class="small muted">${esc(a.name)} · ${a.w} × ${a.h}</p></div><section class="library-reference-fields"><label class="field"><span>参考用途</span><select data-ref="${r.id}">${REFERENCE_USES.map(use=>`<option ${r.role===use?'selected':''}>${use}</option>`).join('')}</select></label><label class="field"><span>参考什么</span><textarea class="compact-input" data-ref-note="${r.id}" maxlength="300" placeholder="例如：配色、线条和上色方式">${esc(r.note||'')}</textarea></label><label class="field"><span>不要参考什么（可选）</span><input data-ref-flow="avoid" data-id="${r.id}" maxlength="300" value="${esc(r.avoid||'')}" placeholder="例如：人物造型和服装"></label><details><summary>适用范围与来源</summary><label class="field"><span>可用角色</span><select data-ref-scope="${r.id}"><option value="all" ${!r.scope||r.scope==='all'?'selected':''}>全部角色可选</option>${state.roles.map(x=>`<option value="${x.id}" ${r.scope===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}${r.scope&&r.scope!=='all'&&!state.roles.some(x=>x.id===r.scope)?'<option selected disabled>角色已移除，请重选</option>':''}</select></label><div class="form-pair"><label class="field"><span>适用素材</span><select data-ref-flow="taskType" data-id="${r.id}">${[['all','所有类型'],['portrait','仅立绘'],['views','仅三视图'],['card','仅卡牌']].map(([v,l])=>`<option value="${v}" ${(r.taskType||'all')===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="field"><span>优先级</span><select data-ref-flow="priority" data-id="${r.id}"><option value="normal" ${r.priority!=='primary'?'selected':''}>辅助参考</option><option value="primary" ${r.priority==='primary'?'selected':''}>同用途主参考</option></select></label></div><label class="field"><span>来源链接或作者</span><input data-ref-source="${r.id}" maxlength="500" value="${esc(r.source||'')}"></label></details><details><summary>AI 提取特征（可选）</summary><button class="text-action" data-action="analyze-reference" data-id="${r.id}" ${busy?'disabled':''}>${icon('spark')}提取图片特征</button>${r.analysis?`<p class="small">${esc(r.analysis)}</p><button data-action="use-reference-analysis" data-id="${r.id}" ${r.analysisApplied===r.analysis?'disabled':''}>${r.analysisApplied===r.analysis?'已补充':'补充到参考说明'}</button>`:''}</details><p class="small muted">图库默认设置会沿用到未单独调整的角色。已生成任务保留原设置。</p></section></div><div class="panel-footer"><button class="text-action danger" data-action="remove-ref" data-id="${r.id}">移除图片</button><button class="primary" data-action="close-library-reference">完成 ${icon('check')}</button></div>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b||!['preview-library-reference','close-library-reference'].includes(b.dataset.action))return;e.stopImmediatePropagation();libraryPreviewId=b.dataset.action==='preview-library-reference'?b.dataset.id:'';libraryPreviewProject=state;renderPanel();const area=$('#inspector .inspector-content');if(area)area.scrollTop=0;},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&panel==='refs'&&libraryPreviewId){e.stopImmediatePropagation();e.preventDefault();libraryPreviewId='';renderPanel();}},true);
