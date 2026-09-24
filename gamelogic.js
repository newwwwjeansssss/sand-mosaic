// Sand Mosaic adapter. Unity JSON stays intact; metadata lives in EditorStore records.
import {encodeSand} from './editor-logic.js';
export const kinds=['pits','containers','wall','linkedPits','gluedGroups','pipes','garages','grinders','platformBlockers','dispensers','coloredGrids'];
export const clone=v=>structuredClone(v);
export const allAssets=a=>(a.categories||[]).flatMap(c=>c.items||[]);
export function assetsForLevel(level,assets){
 const colors=level?.editorMeta?.palette;if(!Array.isArray(colors))return assets;
 return {...assets,categories:assets.categories.map(category=>({...category,items:category.items.filter(a=>a.type!=='color'||typeof colors[a.colorIndex]==='string').map(a=>a.type==='color'?{...a,color:colors[a.colorIndex]}:a)}))};
}
export const palette=(a,level=null)=>{const p=[];for(const c of allAssets(assetsForLevel(level,a)))if(c.type==='color')p[c.colorIndex]=c.color;return p;};
function walk(v,fn,path=[]){if(!v||typeof v!=='object')return;fn(v,path);for(const [k,x] of Object.entries(v))if(x&&typeof x==='object')walk(x,fn,[...path,k]);}
export function getAssetReferences(level,assetOrId,assets){
  const asset=typeof assetOrId==='object'?assetOrId:allAssets(assets||{}).find(a=>a.id===assetOrId);if(!asset)return false;
  let found=false;walk(level,(o)=>{
    if(asset.type==='color'){
      if(o.Color===asset.colorIndex)found=true;
      if(o.ColorFilter?.HasValue&&o.ColorFilter.m_value===asset.colorIndex)found=true;
      if(o.GrainRuns?.some(v=>((v>>>27)&15)===asset.colorIndex))found=true;
    }else if(o[asset.kind]&&(Array.isArray(o[asset.kind])?o[asset.kind].length:Object.keys(o[asset.kind]).length))found=true;
  });return found;
}
export function createEmptyLevel({id,config,assets}){
  const r=config.defaults.resolution,color=allAssets(assets).find(a=>a.type==='color')?.colorIndex??0;
  const grains=[];for(let y=0;y<r;y++)for(let x=0;x<r;x++)grains.push({ShapeCell:{x:0,y:0},GrainCellPosition:{x,y},Color:color});
  return {id,m_Name:'新建沙画关卡 '+id,m_time:config.defaults.time,m_loopTime:0,m_reward:{Amount:0},m_creationData:{gridSize:{x:config.defaults.boardWidth,y:config.defaults.boardHeight},containers:[{Anchor:{x:1,y:3},ShapeCells:[{x:0,y:0}],ResolutionPerCell:r,GrainRuns:[],GrainFills:grains,GlassBlockers:[],RockBlockers:[]}],pits:[{Id:0,StartPosition:{x:1,y:1},ShapeCells:[{x:0,y:0}],Color:color,Capacity:r*r,LockAxis:0,FrozenCount:0,TableClothCount:0,Lock:{Type:0,Count:0},Key:{Type:0},HammerCount:0,ClockSeconds:0}],linkedPits:[],gluedGroups:[],pipes:[],garages:[],grinders:[],platformBlockers:[],dispensers:[],coloredGrids:[],wall:{ShapeCells:[]}}};
}
export function validateConfig(c){const e=[];for(const size of [c.canvas,c.thumbnail])if(!size||!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<64||size.height<64||size.width>4096||size.height>4096)e.push('Canvas / 缩略图尺寸须为 64–4096 的整数');if(!c.defaults||c.defaults.boardWidth<3||c.defaults.boardHeight<5||!Number.isInteger(c.defaults.boardWidth)||!Number.isInteger(c.defaults.boardHeight)||c.defaults.time<=0||!Number.isInteger(c.defaults.resolution)||c.defaults.resolution<1||c.defaults.resolution>32)e.push('默认棋盘至少 3×5，时间 >0，沙粒分辨率 1–32');for(const [k,v] of Object.entries(c.rules||{}))if(!Number.isFinite(v)||v<0)e.push('无效规则 '+k);return e;}
export function validateAssets(a){const errors=[],ids=new Set(),colors=new Set();for(const item of allAssets(a)){if(!/^[a-zA-Z0-9_-]+$/.test(item.id)||ids.has(item.id))errors.push('资源 ID 无效或重复');ids.add(item.id);if(item.image&&!/^level\/asset\/[a-zA-Z0-9_.-]+$/.test(item.image))errors.push('图片路径须位于 level/asset/');if(item.type==='color'){if(!Number.isInteger(item.colorIndex)||item.colorIndex<0||item.colorIndex>15||colors.has(item.colorIndex))errors.push('colorIndex 须唯一且在 0–15');colors.add(item.colorIndex);if(!/^#[0-9a-f]{6}$/i.test(item.color))errors.push('颜色须为 #RRGGBB');}else if(item.type!=='preset'||!kinds.includes(item.kind)||!item.defaults)errors.push('预设类型或默认参数无效');}return errors;}
export function validateLevel(l,a){
  const e=[],d=l?.m_creationData;if(!Number.isInteger(l?.id)||l.id<=0)e.push('关卡 ID 必须为正整数');if(!d)return [...e,'缺少 m_creationData'];
  if(!Number.isInteger(d.gridSize?.x)||!Number.isInteger(d.gridSize?.y)||d.gridSize.x<=0||d.gridSize.y<=0||d.gridSize.x>100||d.gridSize.y>100)e.push('棋盘尺寸须为 1–100 整数');
  if(!Number.isFinite(l.m_time)||l.m_time<=0)e.push('m_time 必须 >0');if(!Number.isFinite(l.m_loopTime)||l.m_loopTime<0)e.push('m_loopTime 必须 ≥0');
  if(l.editorMeta?.palette!==undefined&&(!Array.isArray(l.editorMeta.palette)||l.editorMeta.palette.length>16||l.editorMeta.palette.some(v=>v!==null&&(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v)))))e.push('独立配色须为最多16项的十六进制颜色或空值');
  const colors=new Set(allAssets(assetsForLevel(l,a)).filter(v=>v.type==='color').map(v=>v.colorIndex));
  walk(d,(o,path)=>{
    if(o.Color!==undefined&&!colors.has(o.Color))e.push(path.join('.')+' 的颜色无资源映射');
    if(o.GrainRuns?.some(v=>!colors.has((v>>>27)&15)))e.push('GrainRuns 中有未注册颜色');
    if(o.ShapeCells){for(const c of o.ShapeCells)if(!Number.isInteger(c.x)||!Number.isInteger(c.y))e.push('ShapeCells 坐标须为整数');}
    if(o.Capacity!==undefined&&(!Number.isInteger(o.Capacity)||o.Capacity<=0))e.push('Capacity 必须为正整数');
    for(const key of ['FrozenCount','TableClothCount','HammerCount','ClockSeconds','Health','Count'])if(o[key]!==undefined&&(!Number.isFinite(o[key])||o[key]<0))e.push(key+' 必须非负');
  });
  if(!e.length)try{const b=new globalThis.SandBoard(l);if(!b.pits.length&&!b.pending())e.push('没有容器目标');}catch(error){e.push(error.message);}
  return [...new Set(e)];
}
export function levelWarnings(level){const warnings=[];walk(level,(o,path)=>{if(o.ShapeCells){const s=new Set();for(const c of o.ShapeCells){const key=c.x+','+c.y;if(s.has(key))warnings.push(path.join('.')+' 有重复占格 '+key+'（保留原数据）');s.add(key);}}});
  try{const available={},required={};for(const c of level.m_creationData.containers||[])for(const color of globalThis.Sand.decode(c).cells)if(color>=0)available[color]=(available[color]||0)+1;for(const p of level.m_creationData.pipes||[])for(const row of p.GrainRows||[])available[row.Color]=(available[row.Color]||0)+row.RowCount*p.Width;walk(level,o=>{if(o.Capacity!==undefined&&o.Color!==undefined)required[o.Color]=(required[o.Color]||0)+o.Capacity;});for(const [color,n] of Object.entries(required))if((available[color]||0)<n)warnings.push('颜色 '+color+' 沙量 '+(available[color]||0)+' < 总容量 '+n);}catch(e){warnings.push(e.message);}return [...new Set(warnings)];}
export function getBoardLayout(level,canvas){const g=level.m_creationData.gridSize,s=Math.min(canvas.width/(g.x+1),canvas.height/(g.y+1));return {s,ox:(canvas.width-g.x*s)/2,oy:(canvas.height-g.y*s)/2,width:g.x,height:g.y};}
export function canvasPointToCell(x,y,layout){const gx=Math.floor((x-layout.ox)/layout.s),gy=layout.height-1-Math.floor((y-layout.oy)/layout.s);return gx>=0&&gy>=0&&gx<layout.width&&gy<layout.height?{x:gx,y:gy}:null;}
export function getEndActions(status,hasNext){return {retry:true,next:hasNext,status};}
export function createSession(level,config){return new globalThis.SandBoard(clone(level),config.rules);}
export function hitEntity(level,cell){for(const kind of ['pits','containers','garages','grinders','platformBlockers','dispensers','coloredGrids','wall']){const items=kind==='wall'?[level.m_creationData.wall]:level.m_creationData[kind]||[];for(let i=items.length-1;i>=0;i--){const v=items[i];if(!v)continue;const a=v.StartPosition||v.Anchor||{x:0,y:0};if((v.ShapeCells||[{x:0,y:0}]).some(c=>c.x+a.x===cell.x&&c.y+a.y===cell.y))return {kind,index:i};}}return null;}
export function selectedObject(l,sel){return !sel?null:sel.kind==='wall'?l.m_creationData.wall:l.m_creationData[sel.kind]?.[sel.index];}
export function setObject(l,sel,v){if(sel.kind==='wall')l.m_creationData.wall=v;else l.m_creationData[sel.kind][sel.index]=v;}
export function eraseEntity(l,sel){if(sel.kind==='wall')l.m_creationData.wall={ShapeCells:[]};else l.m_creationData[sel.kind].splice(sel.index,1);}
export function moveEntity(l,sel,cell){const v=selectedObject(l,sel);if(v.StartPosition)v.StartPosition=clone(cell);else if(v.Anchor)v.Anchor=clone(cell);else if(sel.kind==='wall'){const base=v.ShapeCells[0];v.ShapeCells=v.ShapeCells.map(c=>({x:c.x+cell.x-base.x,y:c.y+cell.y-base.y}));}else throw Error('此实体没有画布位置，请编辑属性');}
export function addEntity(l,asset,cell){if(asset.type!=='preset')throw Error('请先选择实体预设');const v=clone(asset.defaults),d=l.m_creationData;const colors=l.editorMeta?.palette;if(Array.isArray(colors)&&v.Color!==undefined&&!colors[v.Color])v.Color=colors.findIndex(c=>typeof c==='string');if('Id' in v){let max=-1;walk(d,o=>{if(Number.isInteger(o.Id))max=Math.max(max,o.Id);});v.Id=max+1;}
  if(v.StartPosition)v.StartPosition=clone(cell);if(v.Anchor)v.Anchor=clone(cell);if(asset.kind==='wall'){d.wall??={ShapeCells:[]};if(!d.wall.ShapeCells.some(c=>c.x===cell.x&&c.y===cell.y))d.wall.ShapeCells.push(clone(cell));return {kind:'wall',index:0};}
  d[asset.kind]??=[];d[asset.kind].push(v);return {kind:asset.kind,index:d[asset.kind].length-1};
}
export function paintSand(l,point,canvas,asset,erase=false){const layout=getBoardLayout(l,canvas),d=l.m_creationData;if(!erase&&asset?.type!=='color')throw Error('沙粒画笔需要选择颜色资源');
  const cell=canvasPointToCell(point.x,point.y,layout);if(!cell)return false;
  for(const def of d.containers||[]){if(!def.ShapeCells.some(c=>c.x+def.Anchor.x===cell.x&&c.y+def.Anchor.y===cell.y))continue;const g=globalThis.Sand.decode(def),r=g.resolution;
    const x=Math.floor(((point.x-layout.ox)/layout.s-def.Anchor.x)*r),y=Math.floor((layout.height-(point.y-layout.oy)/layout.s-def.Anchor.y)*r);
    if(x<0||y<0||x>=g.width||y>=g.height||g.cells[y*g.width+x]===-2)return false;g.cells[y*g.width+x]=erase?-1:asset.colorIndex;
    encodeSand(def,g);caches.delete(l);return true;
  }return false;
}
const caches=new WeakMap();
export function getSandSummary(level,session=null){
  const grids=session?session.grids:(level.m_creationData.containers||[]).map(c=>globalThis.Sand.decode(c));
  return grids.map((g,index)=>{
    const counts=new Map();
    for(const color of g.cells)if(color>=0)counts.set(color,(counts.get(color)||0)+1);
    const colors=[...counts].sort((a,b)=>a[0]-b[0]).map(([color,count])=>({color,count}));
    return {index,anchor:g.definition.Anchor,total:colors.reduce((sum,c)=>sum+c.count,0),colors};
  });
}
const sandLabelAreas=new WeakMap();
// Find an interior rectangle so labels stay inside concave sand pools too.
function sandLabelArea(def){
  if(sandLabelAreas.has(def))return sandLabelAreas.get(def);
  const cells=def.ShapeCells,occupied=new Set(cells.map(c=>c.x+','+c.y));let best=null;
  for(const cell of cells){
    let width=Infinity;
    for(let y=cell.y;occupied.has(cell.x+','+y);y++){
      let run=0;while(occupied.has((cell.x+run)+','+y))run++;
      width=Math.min(width,run);const height=y-cell.y+1;
      if(!best||width*height>best.width*best.height)best={x:cell.x,y:cell.y,width,height};
    }
  }
  sandLabelAreas.set(def,best);return best;
}
function drawSandLabels(ctx,grains,p,{s,ox,oy,height}){
  for(const g of grains){
    const area=sandLabelArea(g.definition);if(!area)continue;
    const counts=new Map();for(const color of g.cells)if(color>=0)counts.set(color,(counts.get(color)||0)+1);
    const entries=[...counts].sort((a,b)=>a[0]-b[0]),total=entries.reduce((n,e)=>n+e[1],0);
    const width=area.width*s-8,heightAvailable=area.height*s-8;
    const columns=Math.max(1,Math.min(entries.length,Math.floor(width/100))),rows=Math.ceil(entries.length/columns);
    const font=Math.max(1,Math.min(16,s*.25,heightAvailable/((rows+1)*1.6),width/(columns*7)));
    const line=font*1.6,panelHeight=line*(rows+1),a=g.definition.Anchor;
    const x=ox+(a.x+area.x)*s+4,y=oy+(height-a.y-area.y-area.height/2)*s-panelHeight/2;
    ctx.save();
    ctx.font='bold '+font+'px system-ui';ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle='#fff';
    ctx.fillText('共 '+total+' 粒',x+width/2,y+line/2,width-4);
    ctx.textAlign='left';
    entries.forEach(([color,count],i)=>{
      const cx=x+(i%columns)*width/columns+font*.4,cy=y+(Math.floor(i/columns)+1.5)*line;
      ctx.fillStyle=p[color]||'#777';ctx.fillRect(cx,cy-font*.4,font*.8,font*.8);
      ctx.strokeStyle='#ffffff99';ctx.lineWidth=1;ctx.strokeRect(cx,cy-font*.4,font*.8,font*.8);
      ctx.fillStyle='#fff';ctx.fillText(String(count),cx+font*1.2,cy,width/columns-font*1.7);
    });
    ctx.restore();
  }
}
export function drawLevel(ctx,level,{assets,session=null,selected=null,grid=true,sandLabels=true}={}){
  const canvas=ctx.canvas,l=getBoardLayout(level,canvas),{s,ox,oy,height:h}=l,p=palette(assets,level),d=level.m_creationData;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0c1526';ctx.fillRect(0,0,canvas.width,canvas.height);
  const box=(cells,a,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const c of cells||[])ctx.fillRect(ox+(a.x+c.x)*s+1,oy+(h-a.y-c.y-1)*s+1,s-2,s-2);ctx.globalAlpha=1;};
  const tag=(text,a,color='#fff')=>{ctx.font='bold '+Math.max(8,s*.2)+'px system-ui';ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,ox+(a.x+.5)*s,oy+(h-a.y-.45)*s);};
  if(grid){ctx.strokeStyle='#223047';ctx.lineWidth=1;for(let y=0;y<h;y++)for(let x=0;x<l.width;x++)ctx.strokeRect(ox+x*s,oy+y*s,s,s);}
  box(d.wall?.ShapeCells,{x:0,y:0},'#6d7989');
  let grains;if(session)grains=session.grids;else{grains=caches.get(level);if(!grains){try{grains=(d.containers||[]).map(c=>globalThis.Sand.decode(c));caches.set(level,grains);}catch{grains=[];}}}
  for(const c of d.coloredGrids||[])box(c.ShapeCells,c.Anchor,p[c.Color]||'#777',.4);
  for(const g of grains){const a=g.definition.Anchor;ctx.fillStyle='#111e32';for(const c of g.definition.ShapeCells)ctx.fillRect(ox+(a.x+c.x)*s,oy+(h-a.y-c.y-1)*s,s,s);globalThis.Sand.paint(ctx,g,p,ox+a.x*s,oy+(h-a.y-g.height/g.resolution)*s,s);globalThis.Sand.outline(ctx,g.definition.ShapeCells,a,s,ox,oy,h,'#ffffff');}
  const pits=session?session.pits:(d.pits||[]).map(a=>({...a,x:a.StartPosition.x,y:a.StartPosition.y,color:a.Color,filled:0}));
  for(const a of pits){if(a.done)continue;const ratio=(a.filled||0)/Math.max(1,a.Capacity);
    const amounts=globalThis.Sand.fillAmounts(a.ShapeCells,ratio);
    for(const [i,c] of a.ShapeCells.entries()){const x=ox+(a.x+c.x)*s,y=oy+(h-a.y-c.y-1)*s;ctx.fillStyle='#111e32';ctx.fillRect(x,y,s,s);ctx.fillStyle=p[a.color]||'#777';ctx.globalAlpha=.25;ctx.fillRect(x,y,s,s);ctx.globalAlpha=.7;ctx.fillRect(x,y+s*(1-amounts[i]),s,s*amounts[i]);ctx.globalAlpha=1;}
    globalThis.Sand.outline(ctx,a.ShapeCells,a,s,ox,oy,h,'#000000');
    const c=a.ShapeCells[0];if(c){tag(String(a.Capacity-(a.filled||0)),{x:a.x+c.x,y:a.y+c.y});const marker=a.FrozenCount>0?'冰'+a.FrozenCount:a.Lock?.Count>0?'锁'+a.Lock.Count:a.TableClothCount>0?'布'+a.TableClothCount:a.Key?.Type>0?'钥'+a.Key.Type:a.LockAxis===1?'↔':a.LockAxis===2?'↕':'';if(marker)tag(marker,{x:a.x+c.x,y:a.y+c.y+.28},'#c5eaff');}
  }
  for(const kind of ['garages','platformBlockers','dispensers','grinders'])for(let i=0;i<(d[kind]||[]).length;i++){const a=d[kind][i];if(session&&(kind==='garages'&&session.garages[i]<=0||kind==='platformBlockers'&&session.platforms[i]))continue;let cells=a.ShapeCells||[{x:0,y:0}];if(kind==='grinders'){cells=[{x:0,y:0}];for(const [x,y,key] of [[0,1,'Up'],[1,0,'Right'],[0,-1,'Down'],[-1,0,'Left']])for(let n=1;n<=a[key]-(session?.grinders[i]||0);n++)cells.push({x:x*n,y:y*n});}box(cells,a.Anchor,kind==='grinders'?'#b6798b':'#81909f',.7);tag(({garages:'车库',platformBlockers:'隐藏',dispensers:'队列',grinders:'✣'})[kind],a.Anchor);}
  for(const g of grains){for(let i=0;i<g.glass.length;i++)if(g.glass[i]>0){const a=g.definition.GlassBlockers[i],anchor={x:g.definition.Anchor.x+a.Anchor.x,y:g.definition.Anchor.y+a.Anchor.y};box(a.ShapeCells,anchor,'#afeafa',.5);tag('玻璃'+g.glass[i],anchor);}for(let i=0;i<g.rocks.length;i++)if(g.rocks[i]>0){const r=g.definition.RockBlockers[i];ctx.strokeStyle='#999';ctx.lineWidth=r.Width*s;ctx.beginPath();r.Points.forEach((c,n)=>{const x=ox+(g.definition.Anchor.x+c.x+.5)*s,y=oy+(h-g.definition.Anchor.y-c.y-.5)*s;n?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
  if(sandLabels)drawSandLabels(ctx,grains,p,l);
  if(selected){const o=selectedObject(level,selected);if(o){const a=o.StartPosition||o.Anchor||{x:0,y:0};globalThis.Sand.outline(ctx,o.ShapeCells||[{x:0,y:0}],a,s,ox,oy,h,'#ffd35a',Math.max(2,s*.035));}}
}
export function calculateDifficulty(level,assets,config){
  try{
    const d=level.m_creationData,pits=[...(d.pits||[]),...(d.platformBlockers||[]).flatMap(v=>v.HiddenPits||[]),...(d.dispensers||[]).flatMap(v=>v.QueuedPits||[])],layers=[...(d.linkedPits||[]),...(d.platformBlockers||[]).flatMap(v=>v.HiddenLinkedPits||[]),...(d.dispensers||[]).flatMap(v=>v.QueuedLinkedPits||[])],all=[...pits,...layers],groups=[...(d.gluedGroups||[]),...(d.platformBlockers||[]).flatMap(v=>v.HiddenGluedGroups||[])];
    if(level.m_time<=0||!all.length)return {score:null,label:'配置异常'};
    const sum=(a,f)=>a.reduce((n,v)=>n+f(v),0),b=new globalThis.SandBoard(level,config.rules),blocked=new Set(),occupied=new Set();
    for(const c of d.wall?.ShapeCells||[])blocked.add(c.x+','+c.y);for(const g of d.containers||[])for(const c of g.ShapeCells)blocked.add((g.Anchor.x+c.x)+','+(g.Anchor.y+c.y));
    for(const p of b.pits){for(const c of p.ShapeCells){const key=(p.x+c.x)+','+(p.y+c.y);if(!blocked.has(key))occupied.add(key);}p.FrozenCount=0;p.Lock.Count=0;p.LockAxis=0;}
    const density=Math.min(1,occupied.size/Math.max(1,d.gridSize.x*d.gridSize.y-blocked.size)),stuck=sum(b.pits,p=>[[1,0],[-1,0],[0,1],[0,-1]].every(([x,y])=>!b.canPlace(p,p.x+x,p.y+y))?1:0)/Math.max(1,b.pits.length);
    const work=all.length+sum(all,p=>p.Capacity)/config.difficulty.medianCapacity,color=new Set(all.map(p=>p.Color)).size+sum(layers,p=>pits.find(v=>v.Id===p.MainPitId)?.Color!==p.Color?1:0)/all.length;
    const F=sum(all,p=>p.FrozenCount||0)+sum(groups,p=>p.SharedFrozenCount||0),K=sum(all,p=>p.Lock?.Count||0)+sum(groups,p=>p.SharedLock?.Count||0),B=sum(all,p=>p.TableClothCount||0)+sum(groups,p=>p.SharedTableClothCount||0),A=sum(all,p=>p.LockAxis?1:0),J=sum(groups,p=>Math.max(0,p.MemberPitIds.length-1));
    const O=sum(d.containers||[],p=>sum(p.GlassBlockers||[],v=>v.Count)+sum(p.RockBlockers||[],v=>v.Health))+sum(d.garages||[],v=>v.Health)+sum(d.grinders||[],v=>Math.max(v.Up,v.Down,v.Left,v.Right)),H=sum(d.platformBlockers||[],p=>(p.HiddenPits||[]).length),Q=sum(d.dispensers||[],p=>(p.QueuedPits||[]).length),P=sum(d.pipes||[],p=>(p.GrainRows||[]).filter((v,i,a)=>i&&v.Color!==a[i-1].Color).length),Z=(d.coloredGrids||[]).length;
    const raw={space:.7*density+.3*stuck,work,color,mechanics:F+1.5*K+B+.5*A+1.5*J+O+.8*H+.8*Q+.25*P+.5*Z,time:work/(level.m_time/60)};
    let score=1;const factors={};for(const [k,v] of Object.entries(raw)){const a=config.difficulty.distributions[k],mid=x=>a.filter(y=>y<x).length+a.filter(y=>y===x).length/2,lo=mid(a[0]),hi=mid(a.at(-1)),r=hi===lo?0:Math.max(0,Math.min(1,(mid(v)-lo)/(hi-lo)));factors[k]=r;score+=9*config.difficulty.weights[k]*r;}return {score:+score.toFixed(2),label:'配置估算 / 10',factors};
  }catch(error){return {score:null,label:error.message};}
}
