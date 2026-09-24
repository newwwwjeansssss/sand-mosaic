// Basic authoring operations; never mutate runtime simulation or original levels.
import {fillPool,encodeSand,entityNames,duplicateEntity} from './editor-logic.js';

export const shapePresets={
  '单格':[{x:0,y:0}],
  '横条 2':[{x:0,y:0},{x:1,y:0}],
  '横条 3':[{x:0,y:0},{x:1,y:0},{x:2,y:0}],
  '方形':[{x:0,y:0},{x:1,y:0},{x:0,y:1},{x:1,y:1}],
  'L 形':[{x:0,y:0},{x:0,y:1},{x:1,y:0}],
  'T 形':[{x:0,y:1},{x:1,y:1},{x:2,y:1},{x:1,y:0}],
};
const integer=(value,min,max,label)=>{if(!Number.isInteger(value)||value<min||value>max)throw Error(label+'须为 '+min+'–'+max+' 的整数');return value;};

export function createBasicLevel({id,config,assets,name='',width=6,height=7,time=180,colorCount=3,blank=false}){
  integer(width,4,32,'棋盘宽');integer(height,5,32,'棋盘高');integer(time,1,3600,'限时');integer(colorCount,1,3,'颜色数');
  const r=integer(config.defaults.resolution,1,32,'沙粒分辨率');
  const all=assets.categories.flatMap(c=>c.items),colors=all.filter(a=>a.type==='color').slice(0,colorCount);
  if(colors.length!==colorCount)throw Error('颜色资源不足');
  const d={gridSize:{x:width,y:height},containers:[],pits:[],linkedPits:[],gluedGroups:[],wall:{ShapeCells:[]},pipes:[],grinders:[],garages:[],platformBlockers:[],dispensers:[],coloredGrids:[]};
  if(!blank)colors.forEach((a,i)=>{
    const pool={Anchor:{x:i+1,y:height-2},ShapeCells:[{x:0,y:0}],ResolutionPerCell:r,GrainRuns:[],GrainFills:[],GlassBlockers:[],RockBlockers:[]};
    fillPool(pool,[{color:a.colorIndex,count:r*r}]);d.containers.push(pool);
    const pit=structuredClone(all.find(a=>a.kind==='pits')?.defaults||{});
    Object.assign(pit,{Id:i,StartPosition:{x:i+1,y:1},ShapeCells:[{x:0,y:0}],Color:a.colorIndex,Capacity:r*r,LockAxis:0,FrozenCount:0,TableClothCount:0,Lock:{Type:0,Count:0},Key:{Type:0},HammerCount:0,ClockSeconds:0});d.pits.push(pit);
  });
  d.lastId=d.pits.length;
  return {id,m_Name:name.trim()||'基础关卡 '+id,m_time:time,m_loopTime:0,m_reward:{Amount:0},m_creationData:d};
}

export function layoutIssues(level){
  const d=level.m_creationData,issues=[],owners=new Map();
  if(!Number.isInteger(d.gridSize?.x)||!Number.isInteger(d.gridSize?.y)||d.gridSize.x<1||d.gridSize.y<1||d.gridSize.x>100||d.gridSize.y>100)return ['棋盘宽高须为 1–100 的整数'];
  for(const kind of ['containers','pits','wall']){
    const objects=kind==='wall'?[d.wall]:d[kind]||[];
    objects.forEach((o,index)=>{if(!o)return;const a=o.Anchor||o.StartPosition||{x:0,y:0},label=entityNames[kind]+' '+(o.Id!==undefined?'#'+o.Id:index+1);
      if(!Number.isInteger(a.x)||!Number.isInteger(a.y)){issues.push(label+' 位置须为整数');return;}
      if(!o.ShapeCells?.length&&kind!=='wall')issues.push(label+' 形状不能为空');
      const own=new Set();for(const c of o.ShapeCells||[]){const x=c.x+a.x,y=c.y+a.y,key=x+','+y;
        if(!Number.isInteger(c.x)||!Number.isInteger(c.y)){issues.push(label+' 形状须为整数格');continue;}
        if(own.has(key)){issues.push(label+' 形状格重复 '+key);continue;}own.add(key);
        if(x<0||y<0||x>=d.gridSize.x||y>=d.gridSize.y)issues.push(label+' 超出棋盘 ('+key+')');
        if(owners.has(key))issues.push(label+' 与 '+owners.get(key)+' 重叠于 ('+key+')');else owners.set(key,label);
      }
    });
  }return [...new Set(issues)];
}
export function assertLayoutChange(before,after){
  const existing=new Set(before?layoutIssues(before):[]),introduced=layoutIssues(after).filter(s=>!existing.has(s));
  if(introduced.length)throw Error(introduced.slice(0,3).join('；'));
}
export function paintWall(level,cell,erase=false){
  const d=level.m_creationData,old=d.wall||{ShapeCells:[]},key=c=>c.x===cell.x&&c.y===cell.y;
  const next=erase?old.ShapeCells.filter(c=>!key(c)):old.ShapeCells.some(key)?old.ShapeCells:[...old.ShapeCells,{...cell}];
  const proposed={...level,m_creationData:{...d,wall:{...old,ShapeCells:next}}};assertLayoutChange(level,proposed);d.wall=proposed.m_creationData.wall;
}
export function transformObject(object,operation){
  if(!['rotate','mirror','flip'].includes(operation))throw Error('未知形状变换');
  const cells=object.ShapeCells;if(!cells?.length)throw Error('形状不能为空');
  if(object.GlassBlockers?.length||object.RockBlockers?.length)throw Error('含内部机关的沙池请保留原朝向；第二期支持机关联动变换');
  const w=Math.max(...cells.map(c=>c.x))+1,h=Math.max(...cells.map(c=>c.y))+1;
  const map=(x,y,w,h)=>operation==='rotate'?{x:y,y:w-1-x}:operation==='mirror'?{x:w-1-x,y}:{x,y:h-1-y};
  const next={...object,ShapeCells:cells.map(c=>map(c.x,c.y,w,h))};
  if(object.ResolutionPerCell){const old=globalThis.Sand.decode(object);next.GrainRuns=[];next.GrainFills=[];const grid=globalThis.Sand.decode(next);
    for(let y=0;y<old.height;y++)for(let x=0;x<old.width;x++)if(old.cells[y*old.width+x]>=0){const p=map(x,y,old.width,old.height);grid.cells[p.y*grid.width+p.x]=old.cells[y*old.width+x];}encodeSand(next,grid);
  }Object.assign(object,next);
}

export function paintSandArea(pool,from,to,color){
  integer(color,-1,15,'颜色');const g=globalThis.Sand.decode(pool);
  const x0=Math.max(0,Math.floor(Math.min(from.x,to.x))),x1=Math.min(g.width-1,Math.floor(Math.max(from.x,to.x)));
  const y0=Math.max(0,Math.floor(Math.min(from.y,to.y))),y1=Math.min(g.height-1,Math.floor(Math.max(from.y,to.y)));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*g.width+x;if(g.cells[i]!==-2&&!g.blocked[i])g.cells[i]=color;}
  encodeSand(pool,g);
}

export function duplicateBasicEntity(level,selection){
  const draft=structuredClone(level),selected=duplicateEntity(draft,selection);
  if(['pits','containers'].includes(selection.kind)){
    const object=draft.m_creationData[selected.kind][selected.index],anchor=object.StartPosition||object.Anchor,origin={...anchor},g=draft.m_creationData.gridSize;
    const candidates=Array.from({length:g.x*g.y},(_,i)=>({x:i%g.x,y:Math.floor(i/g.x)})).sort((a,b)=>(Math.abs(a.x-origin.x)+Math.abs(a.y-origin.y))-(Math.abs(b.x-origin.x)+Math.abs(b.y-origin.y)));
    let found=false;for(const cell of candidates){Object.assign(anchor,cell);try{assertLayoutChange(level,draft);found=true;break;}catch{}}
    if(!found)throw Error('棋盘没有足够的空闲空间放置副本，请先调整布局');
  }
  level.m_creationData=draft.m_creationData;return selected;
}
