// Pure editing operations. Runtime simulation continues to use board.js / sand.js.
export const entityNames={containers:'沙池',pits:'收沙盒',wall:'墙体',linkedPits:'多层盒子',gluedGroups:'胶合组',pipes:'管道',garages:'车库',grinders:'转轴',platformBlockers:'隐藏平台',dispensers:'出盒队列',coloredGrids:'彩色地格'};
export function visit(value,fn){if(!value||typeof value!=='object')return;fn(value);for(const v of Object.values(value))if(v&&typeof v==='object')visit(v,fn);}
export function nextEntityId(level){let max=-1;visit(level.m_creationData,o=>{if(Number.isInteger(o.Id))max=Math.max(max,o.Id);});return max+1;}
export function encodeSand(def,grid){
  const runs=[],r=grid.resolution;
  for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;){
    const color=grid.cells[y*grid.width+x];if(color<0){x++;continue;}
    const start=x;while(x<grid.width&&grid.cells[y*grid.width+x]===color&&Math.floor(x/r)===Math.floor(start/r)&&x-start<32)x++;
    const cx=Math.floor(start/r),cy=Math.floor(y/r);if(cx>63||cy>63)throw Error('沙池形状超出沙粒编码范围（64 格）');
    runs.push((cx|(cy<<6)|((y%r)<<12)|((start%r)<<17)|((x-start-1)<<22)|(color<<27))>>>0);
  }
  def.GrainRuns=runs;def.GrainFills=[];
}
export function poolStats(def){const g=globalThis.Sand.decode(def),counts=new Map();let available=0;for(let i=0;i<g.cells.length;i++){const c=g.cells[i];if(c!==-2&&!g.blocked[i])available++;if(c>=0)counts.set(c,(counts.get(c)||0)+1);}return {total:[...counts.values()].reduce((a,b)=>a+b,0),maximum:new Set(def.ShapeCells.map(c=>c.x+','+c.y)).size*g.resolution**2,available,colors:counts};}
export function fillPool(def,amounts,arrangement='layers'){
  const g=globalThis.Sand.decode(def),slots=[];
  for(let i=0;i<g.cells.length;i++)if(g.cells[i]!==-2){g.cells[i]=-1;if(!g.blocked[i])slots.push(i);}
  const entries=amounts.map(a=>({color:Number(a.color),count:Number(a.count)}));
  if(entries.some(a=>!Number.isInteger(a.count)||a.count<0||!Number.isInteger(a.color)||a.color<0||a.color>15))throw Error('颜色数量必须是非负整数');
  const total=entries.reduce((n,a)=>n+a.count,0);if(total>slots.length)throw Error('超出可填充数量 '+(total-slots.length)+' 粒（可填 '+slots.length+' 粒）');
  const grains=[];for(const a of entries)for(let i=0;i<a.count;i++)grains.push(a.color);
  // Fixed seed makes preview and application identical.
  if(arrangement==='mixed'){let seed=7141;for(let i=grains.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[grains[i],grains[j]]=[grains[j],grains[i]];}}
  grains.forEach((color,i)=>g.cells[slots[i]]=color);encodeSand(def,g);return total;
}
export function reshapeObject(object,cells,{allowLoss=false}={}){
  const unique=[...new Map(cells.map(c=>[c.x+','+c.y,{x:c.x,y:c.y}])).values()];
  if(!unique.length)throw Error('至少保留一个形状格');
  if(unique.some(c=>!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.y<0||c.x>63||c.y>63))throw Error('形状坐标须为 0–63 的整数');
  if(!object.ResolutionPerCell){object.ShapeCells=unique;return 0;}
  const old=globalThis.Sand.decode(object),r=old.resolution,keep=new Set(unique.map(c=>c.x+','+c.y));let lost=0;
  for(let y=0;y<old.height;y++)for(let x=0;x<old.width;x++)if(old.cells[y*old.width+x]>=0&&!keep.has(Math.floor(x/r)+','+Math.floor(y/r)))lost++;
  if(lost&&!allowLoss)throw Error('此操作将移除 '+lost+' 粒沙子');
  for(const blocker of object.GlassBlockers||[])if(blocker.ShapeCells.some(c=>!keep.has((c.x+blocker.Anchor.x)+','+(c.y+blocker.Anchor.y))))throw Error('请先移动或删除超出新形状的玻璃');
  for(const blocker of object.RockBlockers||[])if(blocker.Points.some(c=>!keep.has(c.x+','+c.y)))throw Error('请先移动或删除超出新形状的岩石');
  const next={...object,ShapeCells:unique,GrainRuns:[],GrainFills:[]},grid=globalThis.Sand.decode(next);
  for(let y=0;y<Math.min(old.height,grid.height);y++)for(let x=0;x<Math.min(old.width,grid.width);x++)if(grid.cells[y*grid.width+x]!==-2&&old.cells[y*old.width+x]>=0)grid.cells[y*grid.width+x]=old.cells[y*old.width+x];
  encodeSand(next,grid);Object.assign(object,next);return lost;
}
export function editIssues(level){
  const d=level.m_creationData,issues=[],ids=new Set(),owners=new Map(),required=new Map(),supply=new Map();
  visit(d,o=>{if(Number.isInteger(o.Id)){if(ids.has(o.Id))issues.push('重复实体编号 #'+o.Id);ids.add(o.Id);}if(o.Capacity!==undefined&&o.Color!==undefined)required.set(o.Color,(required.get(o.Color)||0)+o.Capacity);});
  const topIds=new Set((d.pits||[]).map(o=>o.Id));
  for(const kind of ['containers','pits','wall','garages','coloredGrids','platformBlockers']){
    const items=kind==='wall'?[d.wall]:(d[kind]||[]);
    items.forEach((o,i)=>{if(!o)return;const a=o.Anchor||o.StartPosition||{x:0,y:0};for(const c of o.ShapeCells||[]){const x=a.x+c.x,y=a.y+c.y,key=x+','+y,label=entityNames[kind]+' '+(i+1);
      if(x<0||y<0||x>=d.gridSize.x||y>=d.gridSize.y)issues.push(label+' 超出棋盘');
      if(['containers','pits','wall'].includes(kind)){if(owners.has(key))issues.push(label+' 与 '+owners.get(key)+' 重叠于 ('+key+')');else owners.set(key,label);}
    }});
  }
  for(const p of d.containers||[])try{for(const [color,n] of poolStats(p).colors)supply.set(color,(supply.get(color)||0)+n);}catch(e){issues.push('沙粒数据：'+e.message);}
  for(const [i,p] of (d.pipes||[]).entries()){
    const container=d.containers?.[p.ContainerIndex];if(!container)issues.push('管道 '+(i+1)+' 未关联有效沙池');
    if(!Number.isInteger(p.Width)||p.Width<=0)issues.push('管道 '+(i+1)+' 宽度无效');
    for(const row of p.GrainRows||[])supply.set(row.Color,(supply.get(row.Color)||0)+row.RowCount*p.Width);
  }
  for(const layer of d.linkedPits||[])if(!topIds.has(layer.MainPitId))issues.push('多层盒子关联失效 #'+layer.MainPitId);
  for(const group of d.gluedGroups||[])for(const id of group.MemberPitIds||[])if(!topIds.has(id))issues.push('胶合组关联失效 #'+id);
  return {issues:[...new Set(issues)],balance:[...new Set([...supply.keys(),...required.keys()])].sort((a,b)=>a-b).map(color=>({color,supply:supply.get(color)||0,required:required.get(color)||0,difference:(supply.get(color)||0)-(required.get(color)||0)}))};
}
export function deleteWithReferences(level,selection){
  const d=level.m_creationData,object=selection.kind==='wall'?d.wall:d[selection.kind][selection.index];
  if(selection.kind==='wall'){d.wall={...d.wall,ShapeCells:[]};return;}
  if(selection.kind==='containers')d.pipes=(d.pipes||[]).filter(p=>p.ContainerIndex!==selection.index).map(p=>({...p,ContainerIndex:p.ContainerIndex>selection.index?p.ContainerIndex-1:p.ContainerIndex}));
  if(selection.kind==='pits'){
    d.linkedPits=(d.linkedPits||[]).filter(p=>p.MainPitId!==object.Id);
    d.gluedGroups=(d.gluedGroups||[]).map(g=>({...g,MemberPitIds:g.MemberPitIds.filter(id=>id!==object.Id)})).filter(g=>g.MemberPitIds.length>1);
  }
  d[selection.kind].splice(selection.index,1);
}
export function duplicateEntity(level,selection){
  const d=level.m_creationData;if(selection.kind==='wall')throw Error('墙体请使用形状工具扩展');
  const source=d[selection.kind][selection.index],copy=structuredClone(source),mapping=new Map();let next=nextEntityId(level);
  visit(copy,o=>{if(Number.isInteger(o.Id)){mapping.set(o.Id,next);o.Id=next++;}});
  visit(copy,o=>{if(mapping.has(o.MainPitId))o.MainPitId=mapping.get(o.MainPitId);if(o.MemberPitIds)o.MemberPitIds=o.MemberPitIds.map(id=>mapping.get(id)??id);});
  const a=copy.Anchor||copy.StartPosition;if(a){a.x++;}
  d[selection.kind].push(copy);const selected={kind:selection.kind,index:d[selection.kind].length-1};
  if(selection.kind==='pits')for(const layer of [...(d.linkedPits||[])])if(layer.MainPitId===source.Id)d.linkedPits.push({...structuredClone(layer),Id:next++,MainPitId:copy.Id});
  if(selection.kind==='containers')for(const pipe of [...(d.pipes||[])])if(pipe.ContainerIndex===selection.index)d.pipes.push({...structuredClone(pipe),ContainerIndex:selected.index});
  return selected;
}
