'use strict';
// Production contract: each output preset owns its prompt, target size and review criteria.
// Numeric composition defaults are editable project choices, not universal art standards.
let previewRoleId='', reviewFilter='all';
function normalizeOptions(raw={}) {
  if(!raw||typeof raw!=='object')raw={};
  const percent=(v,f)=>Number.isFinite(Number(v))?Math.max(0,Math.min(30,Math.round(Number(v)))):f;
  return {posePreset:['follow','standing','seated','dynamic','floating','crouched'].includes(raw.posePreset)?raw.posePreset:'follow',poseDetail:typeof raw.poseDetail==='string'?raw.poseDetail.slice(0,400):'',cardMode:['story','skill','showcase'].includes(raw.cardMode)?raw.cardMode:'story',variationMode:raw.variationMode==='poses'?'poses':'same',portraitBG:raw.portraitBG==='gray'?'gray':'white',
    ratio:['2:3','3:4','1:1'].includes(raw.ratio)?raw.ratio:'2:3',
    cardCrop:raw.cardCrop==='full'?'full':'half',cardSafe:raw.cardSafe!==false,
    safeTop:percent(raw.safeTop,10),safeBottom:percent(raw.safeBottom,20),
    cardScene:typeof raw.cardScene==='string'?raw.cardScene.slice(0,500):''};
}
function baseProductionSpec(s=state) {
  const o=normalizeOptions(s.options), type=TYPES[s.type]?s.type:'portrait';
  const [w,h]=type==='views'?[2048,1024]:({'2:3':[1024,1536],'3:4':[1152,1536],'1:1':[1024,1024]})[o.ratio];
  const shared='遵守已确认的角色身份、识别特征、配色与项目画风；历史背景仅作为角色语境，画面背景按以下输出要求处理。不要把不同角色的造型混合。';
  let purpose,rules,checks,summary;
  if(type==='portrait') {
    purpose='单角色全身立绘，方便后续排版与抠图。';
    summary=['完整全身',o.portraitBG==='gray'?'浅灰底':'白底','清晰轮廓'];
    rules=[`游戏角色全身立绘，${o.ratio}构图，目标${w}×${h}。`,shared,
      '单一角色完整入画；头顶、脚部或尾部、角、翅膀及确认的随身装备均不得裁切。四周留出约5%的安全边距，可为横向展开的非人角色适当增加留白。',
      '主体轮廓清楚；手臂、装备与躯干避免不必要的重叠，关键识别结构不能被特效遮挡。保持符合设定的解剖结构，不擅自补成人形。',
      `背景为${o.portraitBG==='gray'?'均匀浅灰色':'纯白色'}，没有场景、地台或大面积投影。主体边缘明确，便于后续抠图；纯色背景不等于透明通道。`,
      '光照统一、明暗清楚，保留项目中的线条与材质语言。动作按当前姿态模板执行；沿用角色设定时才读取原动作。',
      '避免：多人、重复身体、拼贴、裁切、无关道具、文字、水印、边框、UI。输出单张平面插画，不代表已经拆层或可直接用于绑定。'];
    checks=['头尾、肢体与关键装备完整，无意外裁切','轮廓与身体结构可读，关键特征未被遮挡','纯色背景、边缘、画风与角色设定符合要求'];
  } else if(type==='views') {
    purpose='用于核对角色结构的设定板。';summary=[s.viewHead===false?'正／侧／背':'特写＋正／侧／背','同一比例','中立姿态'];
    rules=[`角色三视图设定板，2:1横构图，目标${w}×${h}，纯白背景。`,shared,
      s.viewHead===false?'仅三个等宽区域，从左到右为全身正面、严格90度侧面、180度背面，不含头部特写。':'四个区域从左到右为正面头部特写（占画面宽度1/3），其余2/3等分为全身正面、严格90度侧面、180度背面。',
      '区域间使用浅灰色（#E2E2E2）细分隔线，目标约2px；线条只用于排版，不添加视角名称或文字。',
      '三个全身视图统一比例，头顶与足底对齐；非人角色按其轴向与结构对应展示。完整保留角、翼、尾部等识别部件，不裁切。',
      '使用适合角色解剖结构的中立展示姿态，不继承立绘的冲刺、跳跃等动作；人形自然站立、双手放松。',
      '所有视角保持同一身份、发型、体型、衣物、纹样、颜色和材质；服饰接缝与装备位置应在不同视角合理连续。',
      '均匀中性柔光、弱阴影，无戏剧性透视、环境或景深。不新增手持道具，保留已确认的身体组成和必要识别结构。',
      '避免：把侧面画成四分之三视角、多角色、视角间换装、缺少视角、裁切、文字、水印、卡牌边框。'];
    checks=[s.viewHead===false?'正、侧、背三个视角完整且顺序正确':'头部特写＋正、侧、背四区完整且顺序正确','各视角比例、服饰、纹样和身体结构对应一致','中立姿态、白底、完整入画，无多余角色或文字'];
  } else {
    purpose='供卡牌排版使用的插画底图，卡框与文字后续叠加。';
    summary=[o.cardCrop==='full'?'全身叙事':'半身聚焦',o.cardSafe?'预留信息区':'全幅插画','主体优先'];
    rules=[`游戏角色卡牌插画底图，${o.ratio}构图，目标${w}×${h}。`,shared,
      o.cardCrop==='full'?'采用全身叙事构图，角色身体与关键装备完整，动作与场景共同表达角色身份。':'采用半身或四分之三身构图，面部或头部识别结构与核心装备形成主要视觉焦点，裁切避开关节。',
      '画面只有一个主要角色；用明暗、色彩和层次将角色与环境分开，缩略观看时仍能识别主体。特效支持动作与主题，不遮住脸、头部识别结构或关键装备。',
      o.cardScene?`场景与气氛：${o.cardScene}`:'使用与已确认角色背景相符的简洁环境或氛围，不加入未经确认的新剧情和其他主体。',
      o.cardSafe?`预留排版安全区：顶部约${o.safeTop}%、底部约${o.safeBottom}%减少高对比细节，关键识别点避开这些区域；以连续的环境或色块自然过渡，不画空白框、标题框或占位文字。`:'采用全幅插画，不预留标题或描述区域。',
      '光照、透视与材质保持统一；动作、表情可以具有叙事性，但不改变角色身份、轮廓特征或已确认装备。',
      '避免：直接生成卡框、数值、名称、文字、水印、UI；避免高密度背景抢占焦点、特效淹没主体和身份漂移。'];
    checks=['主角与识别点在缩略观看时仍清楚，场景和特效不抢主体',o.cardSafe?`顶部${o.safeTop}%／底部${o.safeBottom}%无关键识别点，便于叠加信息`:'全幅插画构图成立，没有多余占位区域','无生成的卡框、文字、数值或UI，角色身份与画风一致'];
  }
  if(type==='portrait'){const pose=POSE_PRESETS[o.posePreset];summary[0]=pose.name;rules.push('姿态要求：'+pose.rule);if(o.poseDetail)rules.push('本次动作细节：'+o.poseDetail);checks.push(pose.check);if(o.posePreset==='seated')rules.push('坐具仅在动作细节明确指定时允许，优先于通用背景限制；不得自行新增场景。');}
  if(type==='card'){summary[0]=CARD_MODES[o.cardMode].name;rules.push(CARD_MODES[o.cardMode].rule);checks.push(o.cardMode==='skill'?'技能方向与受力一致，特效不遮挡关键结构':'画面情境符合已确认身份，无未经确认的主要角色');}
  return {type,name:TYPES[type].name,w,h,purpose,summary,rules,checks,options:o,viewHead:s.viewHead!==false};
}
function outputRule(s=state){return productionSpec(s).rules.join('\n');}
function baseRefsForRole(role,refs=state.refs){return refs.filter(r=>(!r.scope||r.scope==='all'||r.scope===role.id)&&(Array.isArray(role.referenceChoices)?role.referenceChoices.some(c=>c.id===r.id):!r.libraryOnly&&!(role.excludedRefs||[]).includes(r.id))).map(r=>{const c=(role.referenceChoices||[]).find(c=>c.id===r.id);return {...r,...(c?.inherit?{}:c)};});}
function taskRefs(j,b=active()){const refs=(b?.refs||[]).filter(r=>!Array.isArray(j.referenceIds)||j.referenceIds.includes(r.id)).map(r=>({...r,...(j.referenceBindings||[]).find(c=>c.id===r.id)}));if(j.referenceAsset&&asset(j.referenceAsset))refs.push({id:'revision-'+j.id,asset:j.referenceAsset,role:'角色',scope:j.roleId,note:'本轮返修原图：只修改本轮指定区域，其余细节保留；不是另一角色',source:'项目内父任务 '+(j.parent||'')});return refs;}
function referenceText(refs){return refs.map((r,i)=>`参考图${i+1}：${asset(r.asset)?.name||'图片'}；仅参考${r.role}${r.note?'（'+r.note+'）':''}`).join('\n');}
function baseExpand(role,s=state){
  const dict={角色:role.name||'未命名角色',特征:[role.feature,role.proposal?'原创建议：'+role.proposal:''].filter(Boolean).join('；')||'未指定',
    姿态:poseText(role,s),
    画风:role.seriesStyle||s.style||(refsForRole(role,state.refs,s).some(r=>r.role==='画风')?'遵循此任务绑定的画风参考图':'根据角色设定与文字要求确定绘画表现，保持一致的线条、色彩和材质'),背景:state.brief||'未指定',类型要求:outputRule(s)};
  const core=state.template.replace(/\{([^{}]+)\}/g,(m,k)=>dict[k]??m),refs=refsForRole(role);
  return core+(designText(role)?'\n\n角色设计约束：'+designText(role):'')+(refs.length?'\n\n参考图使用范围：\n'+referenceText(refs)+'\n画风参考只取线条、配色、材质与光照，不复制其角色身份；角色参考保留身份与造型；构图参考只取布局；姿态参考只取动作与受力，不复制身份；材质参考只取表面质感。':'');
}
function baseProductionIssues(roles=selectedRoles()){
  const out=[];
  if(!state.brief.trim())out.push({step:'background',text:'填写整体制作需求'});
  if(!roles.length)out.push({step:'background-results',text:'选择至少一个角色加入本批任务'});
  if(new Set(roles.map(r=>r.name.trim())).size!==roles.length)out.push({step:'background-results',text:'为重复名称的角色设置不同名字'});
  if(roles.some(r=>!r.feature.trim()))out.push({step:'background-results',text:'补充每个角色的识别特征'});
  if(templateErrors())out.push({step:'template',text:templateErrors()});
  return out;
}
function layoutPreview(spec){
  if(spec.type==='views')return `<div class="turnaround-layout ${spec.viewHead?'':'three-only'}" aria-label="三视图布局示意">${spec.viewHead?'<div>头部特写<small>1/3</small></div>':''}<div>正面</div><div>侧面</div><div>背面</div></div>`;
  const o=spec.options;
  return `<div class="output-layout ${spec.type==='portrait'?'portrait-layout '+o.portraitBG:'card-layout'}" style="aspect-ratio:${spec.w}/${spec.h}" aria-label="${spec.name}布局示意">${spec.type==='card'&&o.cardSafe?`<div class="safe-zone top" style="height:${o.safeTop}%">顶部避让 ${o.safeTop}%</div><div class="safe-zone bottom" style="height:${o.safeBottom}%">底部避让 ${o.safeBottom}%</div>`:''}<div class="layout-subject">${spec.type==='portrait'?POSE_PRESETS[o.posePreset].name:o.cardCrop==='full'?'全身叙事':'半身聚焦'}<small>${spec.type==='portrait'?'保留完整轮廓':'角色与环境分层'}</small></div></div>`;
}
function baseTemplatePanel(){
  const spec=productionSpec(state),o=spec.options,roles=(Array.isArray(state.directionIds)?selectedRoles():characterRoles()).filter(r=>r.name.trim()),role=roles.find(r=>r.id===previewRoleId)||roles[0],issues=productionIssues(role?[role]:[]);
  return panelHead('提示词模板','选择用途，自动带入角色、画风和参考图。')+`
  <div class="spec-role-line">${roles.length===1?`<strong>${esc(role.name)}</strong>`:`<span>${roles.length} 个已选角色 · 每个角色先试 1 张</span><details><summary>只试一个角色（可选）</summary><label class="field"><span>试稿角色</span><select data-preview-role>${roles.map(r=>`<option value="${r.id}" ${role?.id===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select></label><button data-action="make-one-pilot" ${generationBusy?'disabled':''}>生成这个角色的试稿 · 1 张</button></details>`}</div>
  <div class="spec-content-header"><h3 class="spec-section-heading">制作内容</h3>
  <div class="type-tabs">${Object.entries(TYPES).map(([k,v])=>`<button data-action="type" data-type="${k}" class="${state.type===k?'active':''}">${v.name}</button>`).join('')}</div>
  </div><div class="spec-main-options">${presetControls(spec)}
  ${spec.type==='views'?`<label class="check-option"><input type="checkbox" data-view-head ${spec.viewHead?'checked':''}>包含头部特写</label>`:spec.type==='portrait'?`<label class="field"><span>背景</span><select data-option="portraitBG"><option value="white" ${o.portraitBG==='white'?'selected':''}>纯白 · 方便后续抠图</option><option value="gray" ${o.portraitBG==='gray'?'selected':''}>浅灰 · 方便检查亮色边缘</option></select></label>`:`<div class="form-pair"><label class="field"><span>角色构图</span><select data-option="cardCrop"><option value="half" ${o.cardCrop==='half'?'selected':''}>半身聚焦</option><option value="full" ${o.cardCrop==='full'?'selected':''}>全身叙事</option></select></label><label class="check-option"><input type="checkbox" data-option="cardSafe" ${o.cardSafe?'checked':''}>预留信息区</label></div>`}

  </div>
  <details class="spec-layout-details"><summary>布局示意与细节</summary><div class="preset-overview">${layoutPreview(spec)}<div><h3>${spec.name}模板</h3><p>${spec.purpose}</p><p class="small muted">${spec.w} × ${spec.h}<br>${spec.summary.join(' · ')}</p><span class="small muted">布局示意，非出图结果</span></div></div></details>
  ${promptReferences(role)}
  <label class="field"><span>画风描述（可选）</span><textarea class="compact-input" data-state="style" maxlength="2000" placeholder="例如：水墨晕染、低饱和配色、平涂插画；留空按角色设定生成">${esc(state.style)}</textarea></label>

  <div class="row"><h3>完整提示词</h3><span class="space"></span><button class="text-action" data-action="copy-prompt" ${role?'':'disabled'}>${icon('copy')}复制</button></div>
  <pre class="prompt-preview" data-live-prompt>${role?esc(expand(role,state)):'先在设计背景中确认角色，提示词会自动填入。'}</pre>
  <p class="small muted">${role?refsForRole(role).length:0} 张参考图随该角色任务保存；点击生成时按编号发送实际图片。</p>
  <details><summary>调整模板与输出设置</summary>
  ${spec.type!=='views'?`<label class="field"><span>画幅比例</span><select data-option="ratio">${['2:3','3:4','1:1'].map(x=>`<option ${x===o.ratio?'selected':''}>${x}</option>`).join('')}</select></label>`:''}
  ${spec.type==='card'?`<label class="field"><span>场景与气氛（可选）</span><textarea class="compact-input" data-option="cardScene" maxlength="500" placeholder="留空时使用与角色背景相符的简洁环境">${esc(o.cardScene)}</textarea></label>${o.cardSafe?`<div class="form-pair"><label class="field"><span>顶部避让 %</span><input type="number" min="0" max="30" data-option="safeTop" value="${o.safeTop}"></label><label class="field"><span>底部避让 %</span><input type="number" min="0" max="30" data-option="safeBottom" value="${o.safeBottom}"></label></div><p class="small muted">10%／20%是本模板的初始值，请按实际卡框调整。不会生成示意中的分区线和文字。</p>`:''}`:''}
  ${spec.type==='portrait'?`<label class="field"><span>当前姿态细节（可选）</span><textarea class="compact-input" data-option="poseDetail" maxlength="400" placeholder="例如：坐在石凳上，双手自然搭膝；留空使用模板默认动作">${esc(o.poseDetail)}</textarea></label>`:''}
  <label class="field"><span>共用模板 · 花括号内为自动变量</span><textarea class="long-text" data-state="template" maxlength="8000">${esc(state.template)}</textarea></label>
  <p class="small muted">必需：{角色}、{特征}、{画风}、{类型要求}。可选：{姿态}、{背景}。</p>
  ${spec.type==='views'?'<p class="small muted">三视图独立使用中立姿态，不套用立绘动作。</p>':spec.type==='portrait'&&o.posePreset!=='follow'?'<p class="small muted">当前预设优先于原角色动作，避免同时要求站立和坐下；切回「沿用角色设定」即可恢复原动作。</p>':roles.map(r=>`<label class="field"><span>${esc(r.name)} · 姿态（可选）</span><input data-role="${r.id}" data-key="pose" maxlength="200" value="${esc(r.pose)}" placeholder="留空时优先保持角色可读性"></label>`).join('')}
  </details><details><summary>本模板的审核条件</summary><ul class="criteria-list">${spec.checks.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></details>
  ${issues.length?`<div class="preflight"><p>创建前还需要</p>${issues.map(x=>`<button class="text-action" data-action="${x.step}">${esc(x.text)} ${icon('arrow')}</button>`).join('')}</div>`:''}
  <div class="panel-footer"><button class="primary" data-action="make-batch">创建 ${selectedRoles().length*state.copies} 个任务 ${icon('arrow')}</button></div>`;
}
function baseRefsPanel(){return panelHead('参考图','明确参考什么，以及给哪个角色使用。')+`
  <button class="primary" data-action="upload-refs">${icon('upload')}上传参考图</button>
  ${state.refs.map(r=>{const a=asset(r.asset),scope=r.scope||'all',orphan=scope!=='all'&&!state.roles.some(x=>x.id===scope);return `<div class="reference-row"><img src="${esc(a?.src)}" alt="${esc(a?.name)}"><div><strong>${esc(a?.name)}</strong><div class="reference-selects"><select data-ref="${r.id}" aria-label="${esc(a?.name)}的参考用途">${['画风','角色','构图','姿态','材质'].map(x=>`<option ${x===r.role?'selected':''}>${x}</option>`).join('')}</select><select data-ref-scope="${r.id}" aria-label="${esc(a?.name)}用于谁"><option value="all" ${scope==='all'?'selected':''}>全组共用</option>${orphan?`<option value="${esc(scope)}" selected>角色已移除，请重选</option>`:''}${state.roles.filter(x=>x.name.trim()).map(x=>`<option value="${x.id}" ${scope===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div>${ib('remove-ref','移除参考 '+a?.name,'trash',`data-id="${r.id}"`)}</div><details class="reference-note"><summary>取用范围与来源</summary><label class="field"><span>来源链接或作者（可选）</span><input data-ref-source="${r.id}" maxlength="500" value="${esc(r.source||'')}" placeholder="保留来源，便于后续核对"></label><label class="field"><span>只取用什么？</span><input data-ref-note="${r.id}" maxlength="300" value="${esc(r.note||'')}" placeholder="如：只取金属材质，不复制服装造型"></label></details>`;}).join('')}
  ${referenceWarnings()}
  <label class="field"><span>统一画风</span><textarea data-state="style" maxlength="2000" placeholder="例如：东方幻想，清晰线描，平涂为主，低饱和配色">${esc(state.style)}</textarea></label>
  <details><summary>查找参考图</summary><label class="field"><span>角色／关键词／画风</span><input id="ref-query" value="${esc((state.roles.find(r=>r.name)?.name||'')+' '+(state.style||''))}" placeholder="例如：唐代 武官 甲胄"></label><button data-action="search-refs">打开图片搜索</button><p class="small muted">前往外部网站查找，选好后上传。当前不会自动采集图片。</p></details>
  <div class="panel-footer"><button class="primary" data-action="next" data-index="2">继续：提示词模板 ${icon('arrow')}</button></div>`;}
function baseMakeBatch(){
  const issues=productionIssues();if(issues.length){toast(issues[0].text);if(issues[0].step==='background-results')backgroundView='results';openPanel(issues[0].step==='background-results'?'background':issues[0].step,issues[0].step==='refs'?1:issues[0].step==='template'?2:0);return;}
  const roles=selectedRoles(),existing=active();
  if(existing&&existing.signature===signature()){openPanel('batch',3);toast('这组要求已有批次，可直接使用。');return;}
  if(state.batches.length>=8){toast('最多8个批次，请导出备份后新建项目。');return;}
  if(roles.some(r=>expand(r).length>50000)){toast('提示词过长，请精简模板。');return;}
  snapshot();const spec=productionSpec();const b={id:uid(),signature:signature(),typeName:spec.name,type:spec.type,spec:structuredClone(spec),refs:structuredClone(state.refs),brief:state.brief,style:state.style,created:new Date().toISOString(),jobs:[]};
  for(const r of roles)for(let i=0;i<state.copies;i++){const taskState=variantState(i),taskSpec=productionSpec(taskState),variant=state.type==='portrait'&&spec.options.variationMode==='poses'?selectedPose(taskState).name:(state.copies>1?'同条件 '+(i+1):'');b.jobs.push({id:uid(),name:r.name+(variant?' · '+variant:''),variant,roleName:r.name,roleId:r.id,roleFeature:[r.feature,r.proposal,designText(r)].filter(Boolean).join('；'),prompt:expand(r,taskState),w:taskSpec.w,h:taskSpec.h,referenceIds:refsForRole(r).map(x=>x.id),checks:[...taskSpec.checks],manual:{},reviewNote:'',asset:null,adopted:false,ai:'',parent:null});}
  state.batches.push(b);state.activeBatch=b.id;changed();openPanel('batch',3);
}
function baseBatchPanel(){const b=active();if(!b)return panelHead('批量任务','确认模板后，按角色展开任务。')+'<button class="primary" data-action="template">选择输出模板</button>';
  return panelHead('批量任务',`${b.typeName} · ${b.jobs.length} 个任务 · ${b.jobs.filter(j=>j.asset).length} 张结果`)+`
  <div class="row"><span class="tag warn">生图 API 待接入</span><button class="text-action" data-action="export-prompts">${icon('download')}导出任务</button></div>
  ${b.signature!==signature()?'<p class="notice">上游要求已改变，当前批次仍保留原要求。</p><button data-action="make-batch">按新要求创建批次</button>':''}
  <label class="field"><span>批次</span><select data-batch>${state.batches.map((x,i)=>`<option value="${x.id}" ${x.id===b.id?'selected':''}>批次 ${i+1} · ${x.typeName} · ${x.jobs.length} 个任务</option>`).join('')}</select></label>
  ${b.jobs.map(j=>`<article class="job"><div class="row"><strong>${esc(j.name)}</strong><span class="space"></span>${ib('import-result','导入 '+j.name+' 的结果','upload',`data-id="${j.id}"`)}</div><p class="small muted">${j.w} × ${j.h} · ${taskRefs(j,b).length} 张参考 · ${j.parent?'返修任务':b.typeName}</p>${j.asset?`${resultImageButton(j.asset,j.name)}<p class="small muted">${esc(asset(j.asset)?.origin)}</p>`:'<p class="small muted" style="margin-top:12px">待生成或导入结果</p>'}<details><summary>本任务的提示词与参考</summary><pre class="prompt-preview">${esc(j.prompt)}</pre>${taskRefs(j,b).map(r=>`<p class="small">${esc(asset(r.asset)?.name)} · ${esc(r.role)}${r.note?' · '+esc(r.note):''}</p>`).join('')}${j.referenceAsset?`<p class="small muted">返修原图</p>${resultImageButton(j.referenceAsset,'返修原图','result-image-button thumb-button')}`:''}</details></article>`).join('')}
  <div class="panel-footer"><button class="primary" data-action="next" data-index="4">继续：审核与返修 ${icon('arrow')}</button></div>`;
}
function manualIssues(j){return (j.checks||[]).filter((c,i)=>j.manual?.[i]==='issue');}
function baseReviewPanel(){const b=active(),jobs=resultJobs(),shown=jobs.filter(j=>reviewFilter==='selected'?j.adopted:reviewFilter==='issues'?specIssues(j).length||duplicateJobs(j).length||manualIssues(j).length||openIssues(j).length:reviewFilter==='unchecked'?!j.adopted: true);
  return panelHead('审核与返修','按任务原始要求检查，AI 提示与人工结论分开记录。')+(!jobs.length?'<div class="empty"><span>先为任务导入结果</span><button data-action="batch">前往批量任务</button></div>':`
  <div class="row"><button data-action="audit" ${busy?'disabled':''}>${icon('spark')}${busy?'分析中…':'AI 初筛下一组'}</button><button data-action="compare-results">并排对照</button><button class="text-action" data-action="export-review">导出记录</button></div><p class="small muted">每次分析最多6张未分析结果；疑点需人工复核。</p>
  <label class="field"><span>筛选结果</span><select data-review-filter>${[['all','全部结果'],['unchecked','未选定'],['issues','已有问题记录'],['selected','已选定']].map(([v,l])=>`<option value="${v}" ${v===reviewFilter?'selected':''}>${l}</option>`).join('')}</select></label>
  ${shown.map(j=>{const a=asset(j.asset),issues=specIssues(j),dups=duplicateJobs(j);return `<article class="job"><div class="row"><strong>${esc(j.name)}</strong><span class="tag ${j.adopted?'good':''}">${j.adopted?'已选用':j.rejected?'已舍弃':'待筛选'}</span></div>${resultImageButton(j.asset,j.name)}<p class="small muted">${a?.w} × ${a?.h} · ${esc(a?.origin)}</p>${issues.map(x=>`<p class="job-flag">${esc(x)}</p>`).join('')}${!issues.length?'<p class="small">文件尺寸与比例符合任务规格</p>':''}${dups.length?`<p class="job-flag">与 ${dups.map(x=>esc(x.name)).join('、')} 使用完全相同的图片</p>`:''}
  <details><summary>人工检查 · ${j.checks?.length||0} 项${manualIssues(j).length?' · '+manualIssues(j).length+' 项需返修':''}</summary>${(j.checks||[]).map((c,i)=>`<label class="criterion"><span>${esc(c)}</span><select data-check-job="${j.id}" data-check-index="${i}" aria-label="${esc(j.name+'：'+c)}">${[['unchecked','未复核'],['pass','符合'],['issue','需返修']].map(([v,l])=>`<option value="${v}" ${(j.manual?.[i]||'unchecked')===v?'selected':''}>${l}</option>`).join('')}</select></label>`).join('')}<label class="field"><span>补充问题</span><textarea class="compact-input" data-review-note="${j.id}" maxlength="1000" placeholder="描述问题位置与期望变化">${esc(j.reviewNote||'')}</textarea></label></details>
  <p class="small muted">${j.ai?'AI 初筛：'+esc(j.ai):'AI 尚未分析结构、风格与造型相似性。'}</p>
  <div class="row"><button class="${j.adopted?'':'primary'} small" data-action="adopt" data-id="${j.id}">${j.adopted?'取消选定':'人工选定'}</button><button class="small" data-action="revision" data-id="${j.id}">返修</button><button class="text-action" data-action="reject-result" data-id="${j.id}">${j.rejected?'恢复候选':'舍弃'}</button></div></article>`;}).join('')||'<p class="notice">此筛选下暂无结果。</p>'}`);
}
function tasksText(){const b=active();return b?`# ${state.title}\n批次：${b.created}\n类型：${b.typeName}\n画风：${b.style}\n\n`+b.jobs.map(j=>`## ${j.name}\n尺寸：${j.w}×${j.h}\n${referenceText(taskRefs(j,b))}\n\n${j.prompt}\n\n审核条件：\n${(j.checks||[]).join('\n')}\n`).join('\n'):'';}
function reviewText(){return tasksText()+'\n审核记录\n'+resultJobs().map(j=>`${j.name}：${j.adopted?'人工选定':'未选定'}\n文件规格：${specIssues(j).join('；')||'符合尺寸比例'}\n人工复核：${(j.checks||[]).map((c,i)=>c+'：'+({pass:'符合',issue:'需返修'}[j.manual?.[i]]||'未复核')).join('；')}\n补充：${j.reviewNote||'无'}\nAI：${j.ai||'未分析'}\n图片来源：${asset(j.asset)?.origin}`).join('\n\n');}
async function audit(){
  if(!apiReady){openPanel('settings');toast('连接 DeepSeek 后可分析真实图片。');return;}
  const b=active(),pending=resultJobs().filter(j=>!j.ai),jobs=[],referenceMap=new Map();
  if(!pending.length){toast('当前结果已分析完；替换图片后可重新分析。');return;}if(busy)return;
  for(const j of pending){const refs=taskRefs(j,b),ids=new Set([...referenceMap.keys(),...refs.map(r=>r.id)]);if(ids.size>6)continue;jobs.push(j);refs.forEach(r=>referenceMap.set(r.id,r));if(jobs.length===6)break;}
  if(!jobs.length){toast('单个任务绑定的参考超过6张。请精简参考并创建新批次，避免遗漏参考审核。');return;}
  const sent=new Map(jobs.map(j=>[j.id,j.asset])),linked=[...referenceMap.values()];
  busy=true;renderPanel();
  try{const data=await api('audit',{brief:b.brief,style:b.style,images:await Promise.all(jobs.map(async j=>({id:j.id,name:j.name,prompt:j.prompt,checks:j.checks||[],reference_ids:taskRefs(j,b).filter(r=>linked.some(x=>x.id===r.id)).map(r=>r.id),src:await visionSource(asset(j.asset)?.src)}))),references:await Promise.all(linked.map(async r=>({id:r.id,role:r.role,note:r.note||'',src:await visionSource(asset(r.asset)?.src)})))});
    if(!state.batches.includes(b))return;snapshot();let count=0;
    for(const item of data.findings||[]){const j=b.jobs.find(x=>x.id===item.id);if(j&&j.asset===sent.get(j.id)){j.ai=String(item.note||'').slice(0,2000);if(j.ai)count++;}}
    scheduleSave();toast(count?`已记录 ${count} 张图的 AI 疑点，请人工复核。`:'没有返回匹配的结果，请重试。');
  }catch(e){toast(e.name==='AbortError'?'请求超时，请重试。':e.message);}finally{busy=false;render();}
}
function restoreProductionState(s,raw){
  s.options=normalizeOptions(raw.options);
  s.roles=s.roles.map(r=>{const x=(raw.roles||[]).find(x=>x.id===r.id)||{};return {...r,...designData(x),enabled:x.enabled!==false,excludedRefs:(Array.isArray(x.excludedRefs)?x.excludedRefs:[]).filter(id=>s.refs.some(ref=>ref.id===id))};});
  const clean=(v,n)=>typeof v==='string'?v.slice(0,n):'';
  const restoreRefs=(rows,original)=>rows.map(r=>{const x=(Array.isArray(original)?original:[]).find(x=>x.id===r.id)||{};return {...r,scope:typeof x.scope==='string'&&/^[\w-]{1,100}$/.test(x.scope)?x.scope:'all',note:clean(x.note,300),source:clean(x.source,500),libraryOnly:x.libraryOnly===true};});
  s.refs=restoreRefs(s.refs,raw.refs);
  const restoreBindings=(rows,refs)=>(Array.isArray(rows)?rows:[]).filter(x=>x&&refs.some(r=>r.id===x.id)).slice(0,24).map(x=>({id:x.id,role:REFERENCE_USES.includes(x.role)?x.role:'画风',priority:x.priority==='primary'?'primary':'normal',note:clean(x.note,300),avoid:clean(x.avoid,300)})).filter((x,i,rows)=>rows.findIndex(y=>y.id===x.id)===i);
  for(const role of s.roles){const original=(raw.roles||[]).find(r=>r.id===role.id);if(Array.isArray(original?.referenceChoices))role.referenceChoices=restoreBindings(original.referenceChoices,s.refs).map(c=>original.referenceChoices.find(x=>x.id===c.id)?.inherit?{id:c.id,inherit:true}:c);}

  for(const b of s.batches){const original=raw.batches.find(x=>x.id===b.id)||{};b.type=['portrait','views','card'].includes(original.type)?original.type:({立绘:'portrait',三视图:'views',卡牌:'card'})[b.typeName]||'portrait';b.typeName=TYPES[b.type].name;b.refs=restoreRefs(b.refs,original.refs);
    b.spec=original.spec&&typeof original.spec==='object'?{type:b.type,name:b.typeName,w:Number(original.spec.w)||1024,h:Number(original.spec.h)||1536,purpose:clean(original.spec.purpose,500),summary:(Array.isArray(original.spec.summary)?original.spec.summary:[]).slice(0,5).map(x=>clean(x,100)),rules:(Array.isArray(original.spec.rules)?original.spec.rules:[]).slice(0,20).map(x=>clean(x,1200)),options:normalizeOptions(original.spec.options),viewHead:original.spec.viewHead!==false,checks:(Array.isArray(original.spec.checks)?original.spec.checks:[]).slice(0,12).map(x=>clean(x,300))}:null;
    for(const j of b.jobs){const x=(original.jobs||[]).find(x=>x.id===j.id)||{};
      if(Array.isArray(x.referenceBindings))j.referenceBindings=restoreBindings(x.referenceBindings,b.refs);
      j.variant=clean(x.variant,100);j.roleId=clean(x.roleId,100);j.roleFeature=clean(x.roleFeature,1200);
      j.referenceIds=Array.isArray(x.referenceIds)?[...new Set(x.referenceIds.filter(id=>b.refs.some(r=>r.id===id)))]:b.refs.map(r=>r.id);
      j.checks=(Array.isArray(x.checks)?x.checks:b.spec?.checks||[]).slice(0,12).map(x=>clean(x,300));j.manual={};
      j.checks.forEach((_,i)=>{if(['pass','issue'].includes(x.manual?.[i]))j.manual[i]=x.manual[i];});
      j.reviewNote=clean(x.reviewNote,1000);j.w=[1024,1152,1536,2048].includes(x.w)?x.w:j.w;
    }
  }
  return s;
}
function updatePromptPreview(){
  const contrast=document.querySelector('.contrast');if(contrast){const expanded=contrast.open;contrast.outerHTML=contrastTable();document.querySelector('.contrast').open=expanded;}
  const preview=document.querySelector('[data-live-prompt]'),role=state.roles.find(r=>r.id===previewRoleId)||state.roles.find(r=>r.name.trim());
  if(preview)preview.textContent=role?expand(role,previewState()):'先在设计背景中确认角色，提示词会自动填入。';
  const overview=document.querySelector('.preset-overview');
  if(overview&&panel==='template'){const spec=productionSpec(state);overview.innerHTML=layoutPreview(spec)+`<div><h3>${spec.name}模板</h3><p>${spec.purpose}</p><p class="small muted">${spec.w} × ${spec.h}<br>${spec.summary.join(' · ')}</p><span class="small muted">布局示意，非出图结果</span></div>`;}
}
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.option){state.options=normalizeOptions({...normalizeOptions(state.options),[t.dataset.option]:t.type==='checkbox'?t.checked:t.value});scheduleSave();updatePromptPreview();}
  if(t.dataset.refSource){const r=state.refs.find(r=>r.id===t.dataset.refSource);if(r){r.source=t.value;scheduleSave();}}
  if(t.dataset.refNote){const r=state.refs.find(r=>r.id===t.dataset.refNote);if(r){r.note=t.value;scheduleSave();}}
  if(t.dataset.reviewNote){const j=active()?.jobs.find(j=>j.id===t.dataset.reviewNote);if(j){j.reviewNote=t.value;scheduleSave();}}
  if(t.dataset.state||t.dataset.role)queueMicrotask(updatePromptPreview);
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.option&&(t.tagName==='SELECT'||t.type==='checkbox')){state.options=normalizeOptions({...normalizeOptions(state.options),[t.dataset.option]:t.type==='checkbox'?t.checked:t.value});changed();}
  if(t.hasAttribute('data-preview-role')){previewRoleId=t.value;renderPanel();}
  if(t.dataset.refScope){snapshot();const r=state.refs.find(r=>r.id===t.dataset.refScope);if(r)r.scope=t.value;changed();}
  if(t.hasAttribute('data-review-filter')){reviewFilter=t.value;renderPanel();}
  if(t.dataset.checkJob){const j=active()?.jobs.find(j=>j.id===t.dataset.checkJob);if(j){j.manual=j.manual||{};j.manual[t.dataset.checkIndex]=t.value;const summary=t.closest('details')?.querySelector('summary');if(summary)summary.textContent='人工检查 · '+j.checks.length+' 项'+(manualIssues(j).length?' · '+manualIssues(j).length+' 项需返修':'');const tag=t.closest('article')?.querySelector('.tag');if(tag){tag.textContent=j.adopted?'已选用':j.rejected?'已舍弃':'待筛选';tag.classList.toggle('good',j.adopted);}scheduleSave();renderHeader();renderNodes();}}
});
document.addEventListener('click',async e=>{
  const btn=e.target.closest('[data-action]');if(!btn)return;
  if(btn.dataset.action==='copy-prompt'){const r=state.roles.find(r=>r.id===previewRoleId)||state.roles.find(r=>r.name.trim());if(!r)return;try{await navigator.clipboard.writeText(expand(r,previewState()));toast('提示词已复制。');}catch{toast('无法访问剪贴板，请选中提示词手动复制。');}}
});
