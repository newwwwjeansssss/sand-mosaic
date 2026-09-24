import {collectionLabel,collectionOf,sequenceOf,filterLevels,counterpart,nextLevel} from './level-collections.js';
import {createComparison} from './level-comparison.js';
import {assertLayoutChange,layoutIssues,paintWall,paintSandArea,duplicateBasicEntity} from '../../phase1-logic.js';
import {bindBasicLevelDialog} from './basic-level-dialog.js';
import * as Game from '../../gamelogic.js';
import {EditorStore} from './editor-store.js';
import {LocalFiles} from './local-files.js';
import {scanLevelFiles} from '../../levellist.js';
import {activateInspectorTab} from './navigation.js';
import {createVisualEditor} from './visual-editor.js';
import {entityNames,reshapeObject,deleteWithReferences} from '../../editor-logic.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let store,files=null,catalog={order:[]},mode='preview',tool='select',page=0,session=null,paused=false,drag=null,grid=true,last=0,bootVersion=0,originalAsset=null;
const drafts=new Set();let lastFiltered=[];
let comparisonReference='competitor';
let sandLabels=true,returnMode='preview',zoom=1;
const toolHints={wall:'拖动连续画墙；一次笔画可撤销', 'wall-erase':'拖动只擦除经过的墙格', 'sand-rectangle':'先选颜色，再在一个沙池内拖出填沙区域',select:'点击对象，在右侧修改属性与形状',move:'拖动对象，松手后吸附到棋盘格',place:'选择左侧实体预设，然后点击画布放置',erase:'点击要删除的对象；有关联对象时一并提示',sand:'选择左侧颜色，在沙池内拖动绘制；一次笔画可整体撤销','sand-erase':'在沙池内拖动擦除沙粒',rectangle:'选择沙池、盒子或墙体预设，拖出矩形区域'};
const visual=createVisualEditor({state:()=>({store,editable:!!files&&mode==='edit'&&!store?.saving}),error:fail,update:fn=>{
  if(mode!=='edit'||!files)throw Error('请先进入本地编辑模式');flush();stop();store.updateLevel(l=>{const object=Game.selectedObject(l,store.selected);if(!object)throw Error('请先选择对象');fn(object);},{checkLayout:true});
}});
function removeSelected(selection){if(!selection)return;const object=Game.selectedObject(store.current.data,selection),label=entityNames[selection.kind];let note='';
  if(selection.kind==='containers')note='关联此沙池的管道也会删除。';if(selection.kind==='pits')note='关联层级会删除，胶合组会更新。';
  if(object&&confirm('删除'+label+'？'+note+'可撤销。'))store.updateLevel(l=>{deleteWithReferences(l,selection);store.selected=null;});
}
const setStatus=t=>$('#save-state').textContent=t;
function fail(e){setStatus((e.code?e.code+': ':'')+e.message);}
function safe(fn){return async(...args)=>{try{await fn(...args);}catch(e){fail(e);}};}
const parse=t=>JSON.parse(t.replace(/^\uFEFF/,''));
async function read(path,local){if(local)return (await local.readText(path)).content;const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw Error(path+' 读取失败，请使用 Start.command（Mac）或 start.exe（Windows）打开编辑器');return r.text();}
async function boot(local){const version=++bootVersion;try{
  const [config,assets,order,listing]=await Promise.all([read('config.json',local).then(parse),read('asset.json',local).then(parse),read('levels/catalog.json',local).then(parse),local?scanLevelFiles(dir=>local.list(dir)).then(entries=>({entries})):fetch('/api/levels',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('关卡目录扫描不可用，请使用 Start.command（Mac）或 start.exe（Windows）打开编辑器');return r.json();})]);
  const errors=[...Game.validateConfig(config),...Game.validateAssets(assets)];if(errors.length)throw Error(errors.join('；'));
  const names=listing.entries,records=[];
  // Bounded batches keep the local bridge responsive with hundreds of files.
  for(let i=0;i<names.length;i+=16){const batch=await Promise.all(names.slice(i,i+16).map(async entry=>({path:entry.path,name:entry.name,data:parse(await read(entry.path,local))})));records.push(...batch);}
  if(version!==bootVersion)return;if(!records.length)throw Error('level/ 没有关卡 JSON');
  const ids=new Set();for(const r of records){if(ids.has(r.data.id))throw Error('重复关卡 ID '+r.data.id);ids.add(r.data.id);}
  files=local;catalog=order;store=new EditorStore({config,assets,levels:records,files});store.currentLevelId=records.some(r=>r.data.id===order.order[0])?order.order[0]:records[0].data.id;const ours=filterLevels(records,catalog,'ours')[0];if(ours)store.currentLevelId=ours.data.id;$('#level-collection').value=ours?'ours':'competitor';store.subscribe(()=>{if(collectionOf(store.current.data,catalog)!==$('#level-collection').value)revealCurrent();render();});drafts.clear();session=null;mode='preview';page=0;render();tab('level');
}catch(e){if(version===bootVersion)fail(e);}}
function tab(name){activateInspectorTab(name);}
function listOrder(){return filterLevels(store.levels,catalog,$('#level-collection').value||'ours',$('#level-search').value,$('#level-order').value);}
function revealCurrent(){const kind=collectionOf(store.current.data,catalog);$('#level-collection').value=kind;$('#level-search').value='';const list=listOrder();page=Math.max(0,Math.floor(list.findIndex(r=>r===store.current)/(store.config.ui?.pageSize||24)));}
const comparisonOptions={state:()=>({store,catalog}),reference:()=>comparisonReference,onReference:kind=>{comparisonReference=kind;},onSelect:r=>{flush();stop();store.currentLevelId=r.data.id;store.selected=null;revealCurrent();render();tab('level');}};let comparison;
$('#compare-levels').onclick=safe(()=>{flush();comparison??=createComparison(comparisonOptions);comparison.open();});
$('#jump-counterpart').onclick=safe(()=>{flush();const r=counterpart(store.current.data,store.levels,catalog,comparisonReference);if(!r)return;stop();store.currentLevelId=r.data.id;store.selected=null;revealCurrent();render();tab('level');});
$('#level-collection').onchange=safe(()=>{const target=$('#level-collection').value;flush();$('#level-collection').value=target;stop();$('#level-search').value='';page=0;const first=listOrder()[0];if(first){store.currentLevelId=first.data.id;store.selected=null;}render();tab('level');});
function renderLevels(){lastFiltered=listOrder();const size=store.config.ui?.pageSize||24,count=Math.max(1,Math.ceil(lastFiltered.length/size));page=Math.max(0,Math.min(page,count-1));$('#level-count').textContent=store.levels.length+' 个关卡 · 当前筛选 '+lastFiltered.length;$('#page-info').textContent=(page+1)+'/'+count;$('#prev-page').disabled=page===0;$('#next-page').disabled=page>=count-1;$('.level-list').replaceChildren();
  for(const r of lastFiltered.slice(page*size,(page+1)*size)){const card=document.createElement('div');card.className='level-card'+(r===store.current?' active':'');card.tabIndex=0;card.setAttribute('role','button');const canvas=document.createElement('canvas');canvas.width=store.config.thumbnail.width;canvas.height=store.config.thumbnail.height;const text=document.createElement('span');text.className='level-info';const title=document.createElement('strong');title.textContent=(sequenceOf(r.data,catalog)?'第 '+sequenceOf(r.data,catalog)+' 关':'ID '+r.data.id)+(JSON.stringify(r.data)!==store.baseline.get(r.path)?' · 未保存':'');const sub=document.createElement('small');sub.textContent=r.data.m_Name;const main=catalog.order.indexOf(r.data.id);const position=document.createElement('small');position.textContent=collectionLabel(collectionOf(r.data,catalog))+' · ID '+r.data.id;text.append(title,sub,position);card.append(canvas,text);$('.level-list').append(card);try{Game.drawLevel(canvas.getContext('2d'),r.data,{assets:store.assets,grid:false,sandLabels:false});}catch(e){canvas.title=e.message;}
    card.onclick=safe(()=>{flush();stop();store.select(r.data.id);tab('level');});card.onkeydown=e=>{if(e.key==='Enter')card.click();};
  }
}
function renderAssets(){const q=$('#asset-search').value.toLowerCase();$('.library').replaceChildren();for(const c of Game.assetsForLevel(store.current.data,store.assets).categories){const section=document.createElement('section');section.className='category';const heading=document.createElement('strong');heading.textContent=c.name;section.append(heading);const group=document.createElement('div');group.className='asset-grid';for(const a of c.items){const category=$('#asset-category').value;if(category!=='all'&&category&&!(category==='basic'?a.type==='color'||['containers','pits','wall'].includes(a.kind):category==='color'?a.type==='color':category==='mechanics'?a.type==='preset'&&!['containers','pits'].includes(a.kind):a.kind===category))continue;if(q&&!(a.id+a.name).toLowerCase().includes(q))continue;const b=document.createElement('button');b.className='asset'+(store.selectedAssetId===a.id?' selected':'');const visual=document.createElement('div');visual.className='asset-visual';visual.style.background=a.color||'#384c66';if(a.image){const img=document.createElement('img');img.alt=a.name;img.src=store.images.has(a.image)?'data:image/png;base64,'+store.images.get(a.image):a.image;visual.append(img);}else visual.textContent=a.type==='color'?'●':'◇';const name=document.createElement('div');name.className='asset-name';name.textContent=a.name;b.append(visual,name);b.onclick=()=>{store.selectedAssetId=a.id;renderAssets();if(mode==='edit'){tool=a.type==='color'?'sand':'place';renderToolState();}};b.ondblclick=()=>openAsset(a);group.append(b);}section.append(group);$('.library').append(section);}}
function validate(){const e=[...Game.validateLevel(store.current.data,store.assets),...layoutIssues(store.current.data)],warnings=Game.levelWarnings(store.current.data);$('#validation-result').textContent=[...(e.length?e:['结构与资源校验通过（不等于已人工通关）']),...warnings.map(w=>'提示：'+w)].join('\n');return e;}
function renderPanels(){const r=store.current;if(!r)return;$('#config-json').value=JSON.stringify(store.config,null,2);$('#level-json').value=JSON.stringify(r.data,null,2);$('#level-name').textContent=collectionLabel(collectionOf(r.data,catalog))+' · '+(sequenceOf(r.data,catalog)?'第 '+sequenceOf(r.data,catalog)+' 关':'ID '+r.data.id);$('#level-design-note').textContent=r.data.editorMeta?.intent||'';$('#jump-counterpart').disabled=!counterpart(r.data,store.levels,catalog,comparisonReference);$('#compare-levels').disabled=!store.levels.some(r=>r.data.editorMeta?.collection==='ours');$('#level-file').textContent=r.path;$('#name-field').value=r.data.m_Name;$('#time-field').value=r.data.m_time;$('#loop-field').value=r.data.m_loopTime;$('#width-field').value=r.data.m_creationData.gridSize.x;$('#height-field').value=r.data.m_creationData.gridSize.y;const score=Game.calculateDifficulty(r.data,store.assets,store.config);$('#difficulty-score').textContent='难度：'+(score.score??'—')+' · '+score.label;
  $('#entity-list').replaceChildren();const blank=document.createElement('option');blank.value='';blank.textContent='选择实体…';$('#entity-list').append(blank);for(const kind of Game.kinds){const values=kind==='wall'?(r.data.m_creationData.wall?[r.data.m_creationData.wall]:[]):r.data.m_creationData[kind]||[];values.forEach((v,i)=>{const option=document.createElement('option');option.value=kind+':'+i;option.textContent=entityNames[kind]+' '+(i+1)+(v.Id!==undefined?' #'+v.Id:'');$('#entity-list').append(option);});}$('#entity-list').value=store.selected?store.selected.kind+':'+store.selected.index:'';$('#element-json').value=JSON.stringify(Game.selectedObject(r.data,store.selected),null,2)||'';validate();visual.render();}
function render(){if(!store)return;const currentCollection=collectionOf(store.current.data,catalog);if(currentCollection==='competitor2'||currentCollection==='competitor2other')comparisonReference='competitor2';else if(currentCollection==='competitor'||currentCollection==='other')comparisonReference='competitor';const activeColors=Game.allAssets(Game.assetsForLevel(store.current.data,store.assets));if(!activeColors.some(a=>a.id===store.selectedAssetId))store.selectedAssetId=activeColors[0]?.id;document.body.classList.toggle('read-only',!files);$('.canvas-area').classList.toggle('editing',mode==='edit'&&!!files);renderLevels();renderAssets();renderPanels();const readonly=!files||store.saving;for(const id of ['config-json','level-json','element-json','name-field','time-field','loop-field','width-field','height-field'])$('#'+id).disabled=readonly;for(const id of ['save-button','add-level','edit-toggle','add-asset','apply-config','apply-level','apply-element','delete-element','delete-level','copy-level','copy-element'])$('#'+id).disabled=readonly;$('#undo-button').disabled=readonly||!store.history.length;$('#redo-button').disabled=readonly||!store.future.length;
  $('#status-mode').textContent=files?'WebView 本地编辑模式':'普通浏览器 · 只读预览 / 可试玩';setStatus(store.saving?'正在保存…':store.dirty?'有未保存的修改':files?'所有更改已保存':'只读演示 · 双击 Start.command（Mac）或 start.exe（Windows）可编辑');$('#canvas-title').textContent=store.current.data.m_Name+' · ID '+store.current.data.id;$('#edit-toggle').textContent=mode==='edit'?'退出编辑':'进入编辑';$('#edit-status').textContent=mode==='edit'?'编辑模式':session?'试玩模式':'预览模式';$$('[data-tool]').forEach(e=>e.classList.toggle('active',e.dataset.tool===tool));}
function renderToolState(){
  $('#editor-guide').hidden=mode!=='edit';$('#tool-hint').textContent=toolHints[tool]||'';
  $$('[data-tool]').forEach(e=>{e.classList.toggle('active',e.dataset.tool===tool);e.disabled=mode!=='edit'||!files;});
  $('#copy-element').disabled=$('#delete-element').disabled=mode!=='edit'||!files||!store?.selected||store?.saving;
  $('#sand-label-toggle').classList.toggle('active',sandLabels);$('#grid-toggle').classList.toggle('active',grid);
}
function syncPlayButton(){
  $('#play-button').textContent=!session?'开始试玩':session.won||session.failed?'重新试玩':paused?'继续试玩':'暂停';
  $('#stop-button').hidden=!session;
  $('#validate-button').hidden=mode!=='edit';
}
function stop(){if(session&&mode==='play')mode=returnMode;$('#play-hud').hidden=true;session=null;drag=null;paused=false;$('#play-result').hidden=true;}
function start(){flush();validate();const errors=Game.validateLevel(store.current.data,store.assets);if(errors.length)throw Error('请先修正关卡：'+errors.slice(0,3).join('；'));assertLayoutChange(store.baseline.has(store.current.path)?JSON.parse(store.baseline.get(store.current.path)):null,store.current.data);if(!session)returnMode=mode==='edit'?'edit':'preview';session=Game.createSession(store.current.data,store.config);mode='play';paused=false;last=performance.now();$('#play-result').hidden=true;render();}
function flush(){if(!store||!drafts.size)return;const pending=[...drafts].map(key=>({key,text:$('#'+key+'-json').value}));const values=pending.map(v=>({...v,value:parse(v.text)}));for(const {key,value,text} of values){drafts.delete(key);try{if(key==='config')store.updateConfig(value);if(key==='level')store.updateLevel(l=>{for(const k of Object.keys(l))delete l[k];Object.assign(l,value);});if(key==='element'){if(!store.selected)throw Error('请先选择实体');store.updateLevel(l=>Game.setObject(l,store.selected,value));}}catch(e){drafts.add(key);$('#'+key+'-json').value=text;throw e;}}}
function fitCanvas(canvas, size) {
  const frame = canvas.parentElement, viewport = frame.parentElement;
  if (!viewport) return;
  const style = getComputedStyle(viewport);
  const width = viewport.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  if (width <= 0 || height <= 0) return;
  viewport.style.overflow=zoom>1?'auto':'hidden';viewport.style.justifyContent=zoom>1?'flex-start':'center';
  const scale = Math.min(width / size.width, height / size.height) * 0.9 * zoom;
  const w = Math.floor(size.width * scale) + 'px', h = Math.floor(size.height * scale) + 'px';
  if (frame.style.width !== w) frame.style.width = w;
  if (frame.style.height !== h) frame.style.height = h;
}
function draw(now){try{if(store?.current){const canvas=$('#game-canvas'),c=store.config.canvas;if(canvas.width!==c.width)canvas.width=c.width;if(canvas.height!==c.height)canvas.height=c.height;canvas.parentElement.style.aspectRatio=c.width+'/'+c.height;fitCanvas(canvas,c);const dt=last?Math.min(.1,(now-last)/1000):0;last=now;if(session&&!paused)session.advance(dt);Game.drawLevel(canvas.getContext('2d'),drag?.level||store.current.data,{assets:store.assets,session,selected:mode==='edit'?store.selected:null,grid,sandLabels});drawGesture(canvas);$('#play-hud').hidden=!session;$('#play-countdown').textContent=session?(paused?'暂停 · ':'')+Math.ceil(session.remaining)+' 秒':'';$('#play-stats').textContent=session?session.pits.filter(p=>!p.done).length+' 个盒子 · 收集 '+session.collected+' 粒':'';if(session&&(session.won||session.failed)){const end=Game.getEndActions(session.won?'won':'failed',!!nextLevel(store.current.data,store.levels,catalog));$('#result-title').textContent=session.won?'关卡完成':'时间到';$('#result-message').textContent='试玩不改变编辑数据';$('#retry-level').disabled=!end.retry;$('#next-level').disabled=!end.next;$('#play-result').hidden=false;drag=null;}}}catch(e){stop();$('#validation-result').textContent='绘制 / 运行失败：'+e.message;}syncPlayButton();renderToolState();requestAnimationFrame(draw);}
function point(event){const c=$('#game-canvas'),r=c.getBoundingClientRect();return {x:(event.clientX-r.left)*c.width/r.width,y:(event.clientY-r.top)*c.height/r.height};}
function down(event){if(!store||event.button!==0||drag)return;flush();const canvas=$('#game-canvas'),p=point(event),layout=Game.getBoardLayout(store.current.data,canvas),cell=Game.canvasPointToCell(p.x,p.y,layout);if(!cell)return;
  if(session&&!paused){const pit=session.pits.find(v=>!v.done&&v.ShapeCells.some(c=>c.x+v.x===cell.x&&c.y+v.y===cell.y));if(!session.movable(pit))return;drag={pointer:event.pointerId,pit,px:p.x,py:p.y,x:pit.x,y:pit.y};canvas.setPointerCapture(event.pointerId);return;}
  if(mode!=='edit'||!files)return;const hit=Game.hitEntity(store.current.data,cell),asset=Game.allAssets(store.assets).find(a=>a.id===store.selectedAssetId);
  if(tool==='select'||tool==='move'){store.selected=hit;renderPanels();tab('element');if(hit&&tool==='move'){const obj=Game.selectedObject(store.current.data,hit),anchor=obj.StartPosition||obj.Anchor||(hit.kind==='wall'?obj.ShapeCells[0]:null)||{x:0,y:0};drag={pointer:event.pointerId,selection:hit,offset:{x:cell.x-anchor.x,y:cell.y-anchor.y},point:p};canvas.setPointerCapture(event.pointerId);}}
  if(tool==='place'){store.updateLevel(l=>{store.selected=Game.addEntity(l,asset,cell);},{checkLayout:true});tab('element');}
  if(tool==='erase'&&hit){if(hit.kind==='wall')store.updateLevel(l=>paintWall(l,cell,true));else removeSelected(hit);}
  if(tool==='wall'||tool==='wall-erase'){const level=Game.clone(store.current.data);paintWall(level,cell,tool==='wall-erase');drag={pointer:event.pointerId,level,wall:true,erase:tool==='wall-erase',point:p};canvas.setPointerCapture(event.pointerId);return;}
  if(tool==='sand-rectangle'){if(asset?.type!=='color')throw Error('请先在左侧选取颜色');if(hit?.kind!=='containers')throw Error('请从沙池内开始拖动');store.selected=hit;renderPanels();tab('element');drag={pointer:event.pointerId,sandRectangle:true,selection:hit,startPoint:p,point:p,asset};canvas.setPointerCapture(event.pointerId);return;}
  if(tool==='rectangle'){if(asset?.type!=='preset'||!['containers','pits','wall','coloredGrids','garages','platformBlockers'].includes(asset.kind))throw Error('矩形工具需先选择沙池、盒子、墙体或区域预设');drag={pointer:event.pointerId,rectangle:true,asset,start:cell,end:cell};canvas.setPointerCapture(event.pointerId);}
  if(tool==='sand'||tool==='sand-erase'){
    if(!hit||hit.kind!=='containers')return;store.selected=hit;renderPanels();tab('element');
    const level=Game.clone(store.current.data);Game.paintSand(level,p,canvas,asset,tool==='sand-erase');drag={pointer:event.pointerId,level,asset,erase:tool==='sand-erase',point:p};canvas.setPointerCapture(event.pointerId);
  }
}
function movePointer(event){if(!drag||drag.pointer!==event.pointerId)return;const p=point(event),canvas=$('#game-canvas'),layout=Game.getBoardLayout(store.current.data,canvas),cell=Game.canvasPointToCell(p.x,p.y,layout);
  if(drag.pit&&session&&!paused){session.move(drag.pit,drag.x+(p.x-drag.px)/layout.s,drag.y-(p.y-drag.py)/layout.s);return;}
  if(drag.sandRectangle){drag.point=p;return;}
  if(drag.wall){const from=drag.point,steps=Math.max(1,Math.ceil(Math.hypot(p.x-from.x,p.y-from.y)/(layout.s/2)));for(let i=1;i<=steps;i++){const c=Game.canvasPointToCell(from.x+(p.x-from.x)*i/steps,from.y+(p.y-from.y)*i/steps,layout);if(c)try{paintWall(drag.level,c,drag.erase);drag.error=null;}catch(e){drag.error=e.message;}}drag.point=p;return;}
  if(drag.rectangle){if(cell)drag.end=cell;return;}
  if(drag.level){const from=drag.point,steps=Math.max(1,Math.ceil(Math.hypot(p.x-from.x,p.y-from.y)/Math.max(1,layout.s/32)));for(let i=1;i<=steps;i++)Game.paintSand(drag.level,{x:from.x+(p.x-from.x)*i/steps,y:from.y+(p.y-from.y)*i/steps},canvas,drag.asset,drag.erase);drag.point=p;}
  else if(drag.selection)drag.point=p;
}
function drawGesture(canvas){if(!drag||session)return;const ctx=canvas.getContext('2d'),layout=Game.getBoardLayout(store.current.data,canvas),{s,ox,oy,height}=layout;
  if(drag.sandRectangle){ctx.save();ctx.fillStyle=drag.asset.color+'66';ctx.strokeStyle=drag.asset.color;ctx.lineWidth=2;const a=drag.startPoint,b=drag.point;ctx.fillRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);ctx.restore();return;}
  if(drag.rectangle){const x=Math.min(drag.start.x,drag.end.x),y=Math.min(drag.start.y,drag.end.y),w=Math.abs(drag.end.x-drag.start.x)+1,h=Math.abs(drag.end.y-drag.start.y)+1;ctx.save();ctx.fillStyle='#63d6b433';ctx.strokeStyle='#8df2ce';ctx.lineWidth=2;ctx.fillRect(ox+x*s,oy+(height-y-h)*s,w*s,h*s);ctx.strokeRect(ox+x*s,oy+(height-y-h)*s,w*s,h*s);ctx.restore();}
  if(drag.selection){const cell=Game.canvasPointToCell(drag.point.x,drag.point.y,layout),object=Game.selectedObject(store.current.data,drag.selection);if(cell&&object){const proposed=Game.clone(store.current.data);let color='#8df2ce';try{Game.moveEntity(proposed,drag.selection,{x:cell.x-drag.offset.x,y:cell.y-drag.offset.y});assertLayoutChange(store.current.data,proposed);}catch{color='#ff7979';}globalThis.Sand.outline(ctx,drag.selection.kind==='wall'?object.ShapeCells.map(c=>({x:c.x-object.ShapeCells[0].x,y:c.y-object.ShapeCells[0].y})):object.ShapeCells||[{x:0,y:0}],{x:cell.x-drag.offset.x,y:cell.y-drag.offset.y},s,ox,oy,height,color);}}
}
function up(event){if(!drag||drag.pointer!==event.pointerId)return;movePointer(event);const current=drag;drag=null;
  if(current.sandRectangle){const layout=Game.getBoardLayout(store.current.data,$('#game-canvas'));store.updateLevel(l=>{const pool=Game.selectedObject(l,current.selection),r=pool.ResolutionPerCell;const toGrain=p=>({x:Math.floor(((p.x-layout.ox)/layout.s-pool.Anchor.x)*r),y:Math.floor((layout.height-(p.y-layout.oy)/layout.s-pool.Anchor.y)*r)});paintSandArea(pool,toGrain(current.startPoint),toGrain(current.point),current.asset.colorIndex);});return;}
  if(current.level){store.updateLevel(l=>{l.m_creationData=current.level.m_creationData;},{checkLayout:true});if(current.error)fail(Error(current.error));return;}
  if(current.rectangle){const x=Math.min(current.start.x,current.end.x),y=Math.min(current.start.y,current.end.y),w=Math.abs(current.end.x-current.start.x)+1,h=Math.abs(current.end.y-current.start.y)+1;
    store.updateLevel(l=>{const cells=Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w)}));
      if(current.asset.kind==='wall'){for(const c of cells)Game.addEntity(l,current.asset,{x:x+c.x,y:y+c.y});store.selected={kind:'wall',index:0};}
      else{store.selected=Game.addEntity(l,current.asset,{x,y});reshapeObject(Game.selectedObject(l,store.selected),cells,{allowLoss:true});}
    },{checkLayout:true});tab('element');return;
  }
  if(current.selection){const p=point(event),cell=Game.canvasPointToCell(p.x,p.y,Game.getBoardLayout(store.current.data,$('#game-canvas')));if(cell)store.updateLevel(l=>Game.moveEntity(l,current.selection,{x:cell.x-current.offset.x,y:cell.y-current.offset.y}),{checkLayout:true});}
}
function openAsset(asset){originalAsset=asset?.id||null;$('#asset-json').value=JSON.stringify(asset||{id:'new-preset',name:'新盒子预设',type:'preset',kind:'pits',color:'#65c7b2',image:'',difficultyWeight:1,defaults:Game.allAssets(store.assets).find(a=>a.kind==='pits')?.defaults||{}},null,2);$('#asset-image').value='';$('#asset-error').textContent='';const isolatedColor=!!store.current.data.editorMeta?.palette&&asset?.type==='color';$('#asset-json').disabled=!files||isolatedColor;$('#asset-image').disabled=!files||isolatedColor;$('#asset-confirm').disabled=!files||isolatedColor;$('#delete-asset').disabled=!files||!asset||isolatedColor;if(isolatedColor)$('#asset-error').textContent='此关卡使用独立配色，不修改共享颜色资源。';$('#asset-dialog').showModal();}
$('#asset-form').onsubmit=async e=>{e.preventDefault();try{const value=parse($('#asset-json').value),file=$('#asset-image').files[0];let bytes=null;if(file){if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)||file.size>8*1024*1024)throw Error('请选择不超过 8MB 的 PNG/JPEG/WebP/GIF');bytes=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(file);});const ext=file.type==='image/jpeg'?'jpg':file.type.split('/')[1];value.image='level/asset/'+crypto.randomUUID()+'.'+ext;}store.updateAsset(originalAsset,value,bytes);$('#asset-dialog').close();}catch(e){$('#asset-error').textContent=e.message;}};
$('#close-asset').onclick=()=>$('#asset-dialog').close();$('#delete-asset').onclick=safe(()=>{if(confirm('删除这个未被引用的资源？点击保存后写入。')){store.deleteAsset(originalAsset);$('#asset-dialog').close();}});$('#add-asset').onclick=()=>openAsset(null);
for(const key of ['config','level','element']){$('#'+key+'-json').oninput=()=>drafts.add(key);$('#apply-'+key).onclick=safe(()=>{stop();flush();});}
for(const [id,fn] of Object.entries({'name-field':(l,v)=>l.m_Name=v,'time-field':(l,v)=>l.m_time=+v,'loop-field':(l,v)=>l.m_loopTime=+v,'width-field':(l,v)=>l.m_creationData.gridSize.x=+v,'height-field':(l,v)=>l.m_creationData.gridSize.y=+v}))$('#'+id).onchange=safe(e=>{const v=e.target.value;flush();stop();store.updateLevel(l=>fn(l,v),{checkLayout:true});});
$('#entity-list').onchange=safe(e=>{const value=e.target.value;flush();const [kind,index]=value.split(':');store.selected=value?{kind,index:+index}:null;renderPanels();});$('#delete-element').onclick=safe(()=>{if(mode!=='edit')throw Error('请先进入编辑模式');flush();removeSelected(store.selected);});
$('#game-canvas').onpointerdown=safe(down);$('#game-canvas').onpointermove=safe(movePointer);$('#game-canvas').onpointerup=safe(up);$('#game-canvas').onpointercancel=()=>drag=null;$('#game-canvas').onlostpointercapture=()=>drag=null;
$('#save-button').onclick=safe(async()=>{stop();flush();await store.save();});$('#refresh-button').onclick=()=>{if((store?.dirty||drafts.size)&&!confirm('放弃未保存修改并刷新？'))return;location.reload();};$('#undo-button').onclick=safe(()=>{flush();stop();store.undo();});$('#redo-button').onclick=safe(()=>{flush();stop();store.redo();});$('#add-level').onclick=safe(()=>{flush();stop();mode='edit';store.addLevel();$('#level-search').value='';$('#level-order').value='id';revealCurrent();render();tab('level');});$('#delete-level').onclick=safe(()=>{flush();if(confirm('删除当前工作关卡？保存后删除 level/ 文件，原始 levels/ 不受影响。')){stop();store.deleteLevel();}});
$('#edit-toggle').onclick=safe(()=>{flush();stop();mode=mode==='edit'?'preview':'edit';render();});$('#play-button').onclick=safe(()=>{if(!session||session.won||session.failed){start();}else{paused=!paused;drag=null;last=performance.now();}syncPlayButton();});$('#stop-button').onclick=()=>{stop();mode=returnMode;render();};$('#retry-level').onclick=safe(start);$('#next-level').onclick=safe(()=>{const next=nextLevel(store.current.data,store.levels,catalog);if(!next)return;stop();store.currentLevelId=next.data.id;store.selected=null;revealCurrent();render();start();});$('#validate-button').onclick=safe(()=>{flush();validate();});
$$('.tab').forEach(t=>t.onclick=safe(()=>{flush();tab(t.dataset.tab);}));$$('[data-tool]').forEach(b=>b.onclick=()=>{tool=b.dataset.tool;renderToolState();});$('#grid-toggle').onclick=()=>grid=!grid;$('#sand-label-toggle').onclick=()=>sandLabels=!sandLabels;$('#canvas-zoom').onchange=e=>zoom=Number(e.target.value)||1;
$('#copy-level').onclick=safe(()=>{flush();stop();store.duplicateLevel();$('#level-search').value='';$('#level-order').value='id';revealCurrent();mode='edit';render();tab('level');});
$('#copy-element').onclick=safe(()=>{if(mode!=='edit')throw Error('请先进入编辑模式');flush();if(store.selected)store.updateLevel(l=>{store.selected=duplicateBasicEntity(l,store.selected);});});
$('#level-search').oninput=()=>{page=0;renderLevels();};$('#level-order').onchange=()=>{page=0;renderLevels();};$('#asset-search').oninput=renderAssets;$('#asset-category').onchange=renderAssets;$('#prev-page').onclick=()=>{page--;renderLevels();};$('#next-page').onclick=()=>{page++;renderLevels();};
window.addEventListener('beforeunload',e=>{if(store?.dirty||drafts.size){e.preventDefault();e.returnValue='';}});window.addEventListener('keydown',safe(async e=>{
  const typing=['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();stop();flush();await store.save();return;}
  if(typing||mode!=='edit'||!files)return;
  if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();flush();stop();if(e.key.toLowerCase()==='y'||e.shiftKey)store.redo();else store.undo();}
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();flush();removeSelected(store.selected);}
  if(e.key==='Escape'){drag=null;tool='select';renderToolState();}
}));document.addEventListener('visibilitychange',()=>{if(document.hidden)paused=true;});
bindBasicLevelDialog({editable:()=>!!files&&!store?.saving,error:fail,create:options=>{flush();stop();store.addLevel(options);mode='edit';tool='select';zoom=1;$('#canvas-zoom').value='1';$('#level-search').value='';$('#level-order').value='id';revealCurrent();render();tab('level');}});
// On a cached reload, the native bridge may be ready before this module runs.
function bootLocal(){if(files)return;boot(new LocalFiles());}
window.addEventListener('pywebviewready',bootLocal,{once:true});
if(window.pywebview?.api?.files)bootLocal();
setTimeout(()=>{if(!bootVersion)boot(window.pywebview?.api?.files?new LocalFiles():null);},500);requestAnimationFrame(draw);

