import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.Sand=require('../sand.js');globalThis.SandBoard=require('../board.js');
const {createEmptyLevel,validateLevel,calculateDifficulty,palette}=await import('../gamelogic.js');
const {encodeSand,editIssues}=await import('../editor-logic.js');
const {layoutIssues}=await import('../phase1-logic.js');
const Board=globalThis.SandBoard,Sand=globalThis.Sand;
const root=new URL('../',import.meta.url),read=rel=>JSON.parse(fs.readFileSync(new URL(rel,root)));
const assets=read('asset.json'),config=read('config.json'),catalog=read('levels/catalog.json'),imported=read('competitor2-import.json');
const selection1=[1,2,3,4,7,8,9,12,16,18,19,22,25,26,27,28,33,34,35,36,37,40,43,45,50];
const selection2=[2,3,4,5,6,7,8,13,15,16,17,21,23,24,26,27,31,33,35,37,40,41,43,46,50];
const colors=['#ff6542','#f6c445','#64d98b','#24c6c8','#438bea','#956de2','#ed73b5','#b7d85b','#de9d58','#8edbd0','#8e95ed','#f1919f','#ddd5bb'];
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
function walk(v,fn){if(!v||typeof v!=='object')return;fn(v);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x,fn);}
function recolor(level,map){walk(level.m_creationData,o=>{
 if(typeof o.Color==='number'){assert.ok(map[o.Color]!==undefined);o.Color=map[o.Color];}
 if(typeof o.ColorFilter?.m_value==='number')o.ColorFilter.m_value=map[o.ColorFilter.m_value];
 if(Array.isArray(o.GrainRuns))o.GrainRuns=o.GrainRuns.map(v=>(((v>>>0)&0x07ffffff)|(map[(v>>>27)&15]<<27))>>>0);
});}
function mapColors(source,sequence){
 const original=palette(assets,source),used=editIssues(source).balance.filter(r=>r.supply||r.required).map(r=>r.color);
 const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
 let best=null;for(let k=1;k<13;k++){const shift=1+(k+sequence-1)%12,map=Object.fromEntries(Array.from({length:13},(_,i)=>[i,(i+shift)%13]));
  const minDistance=Math.min(...used.map(c=>{const a=rgb(original[c]),b=rgb(colors[map[c]]);return Math.sqrt(a.reduce((s,v,i)=>s+(v-b[i])**2,0));}));
  if(!best||minDistance>best.minDistance)best={map,minDistance};
 }return best;
}
function mirrorObject(object,boardWidth,anchorKey){
 const cells=object.ShapeCells;if(!cells?.length)return;
 assert.equal(Math.min(...cells.map(c=>c.x)),0,'Expected normalized local shape');
 const max=Math.max(...cells.map(c=>c.x));object[anchorKey].x=boardWidth-1-object[anchorKey].x-max;
 for(const c of cells)c.x=max-c.x;
}
function mirror(level){
 const d=level.m_creationData,W=d.gridSize.x;
 for(const kind of ['garages','grinders','platformBlockers','dispensers','coloredGrids'])assert.equal(d[kind]?.length||0,0,'Unsupported mirrored feature '+kind);
 assert.equal(d.pipes.length,0,'Pipe lesson retains its original geometry');
 for(const p of d.pits)mirrorObject(p,W,'StartPosition');
 for(const c of d.wall?.ShapeCells||[])c.x=W-1-c.x;
 for(const pool of d.containers){
  const grid=Sand.decode(pool),width=grid.width/grid.resolution;
  mirrorObject(pool,W,'Anchor');
  for(const glass of pool.GlassBlockers||[])mirrorObject(glass,width,'Anchor');
  for(const rock of pool.RockBlockers||[])for(const p of rock.Points)p.x=width-1-p.x;
  const mirrored=Sand.decode({...pool,GrainRuns:[],GrainFills:[]});
  assert.equal(mirrored.width,grid.width);assert.equal(mirrored.height,grid.height);
  for(let y=0;y<grid.height;y++)for(let x=0;x<grid.width;x++)mirrored.cells[y*grid.width+grid.width-1-x]=grid.cells[y*grid.width+x];
  encodeSand(pool,mirrored);
 }
}
function rowCounts(g,y){const counts={};for(let x=0;x<g.width;x++){const c=g.cells[y*g.width+x];if(c>=0)counts[c]=(counts[c]||0)+1;}return counts;}
function softenPattern(level,sequence){
 let changed=0,total=0,pools=0;
 for(const pool of level.m_creationData.containers){
  const g=Sand.decode(pool),r=g.resolution,w=g.width/r,h=g.height/r;total+=g.count;
  if(w<3||h<3||pool.ShapeCells.length!==w*h||pool.GlassBlockers.length||pool.RockBlockers.length)continue;
  const original=g.cells.slice(),limit=Math.floor(g.count*.035);let moved=0;
  for(let y=r;y<g.height-r;y++){
   const positions=[];for(let x=r;x<g.width-r;x++)if(g.cells[y*g.width+x]>=0)positions.push(y*g.width+x);
   if(positions.length<8)continue;const values=positions.map(i=>g.cells[i]);if(new Set(values).size<2)continue;
   const step=Math.max(1,Math.round(r*.16)),shift=(Math.floor(y/4)+sequence)%2?step:-step;
   const next=values.map((_,i)=>values[(i-shift+values.length)%values.length]),different=next.filter((c,i)=>c!==values[i]).length;
   if(moved+different>limit)continue;
   const before=rowCounts(g,y);positions.forEach((p,i)=>{g.cells[p]=next[i];});assert.deepEqual(rowCounts(g,y),before);moved+=different;
  }
  if(moved){for(let y=0;y<g.height;y++)for(let x=0;x<g.width;x++)if(x<r||x>=g.width-r||y<r||y>=g.height-r)assert.equal(g.cells[y*g.width+x],original[y*g.width+x]);
   encodeSand(pool,g);changed+=moved;pools++;
  }
 }
 return {changedPixels:changed,totalGrains:total,pools,ratio:total?changed/total:0,boundaryBand:'one full cell unchanged',rowColorCountsPreserved:true};
}
function verifyMoves(source,target,reflected){
 const a=new Board(source,config.rules),b=new Board(target,config.rules),W=source.m_creationData.gridSize.x;let checked=0;
 for(const [index,p] of a.pits.entries()){const q=b.pits[index],max=Math.max(...p.ShapeCells.map(c=>c.x));
  for(let y=0;y<a.layout.gridSize.y;y++)for(let x=0;x<W;x++){
   assert.equal(a.canPlace(p,x,y),b.canPlace(q,reflected?W-1-x-max:x,y),'Movement geometry changed '+JSON.stringify({id:p.Id,x,y,targetX:reflected?W-1-x-max:x,sourcePosition:[p.x,p.y],targetPosition:[q.x,q.y],shape:p.ShapeCells,targetShape:q.ShapeCells,groups:source.m_creationData.gluedGroups}));checked++;
  }
 }return checked;
}
function verifyColorDynamics(source,recolored,map){
 const a=new Board(source,config.rules),b=new Board(recolored,config.rules);let successfulMoves=0;
 for(let step=0;step<14;step++){
  const options=[];for(const [index,p] of a.pits.entries())if(a.movable(p))for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]])if(a.canPlace(p,p.x+dx,p.y+dy))options.push({index,id:p.Id,x:p.x+dx,y:p.y+dy});
  const m=options[(step*7)%options.length];if(!m)break;
  const p=a.pits[m.index],q=b.pits[m.index];assert.equal(a.move(p,m.x,m.y),b.move(q,m.x,m.y));successfulMoves++;
  for(let t=0;t<3;t++){a.advance(.1);b.advance(.1);}
  assert.equal(a.collected,b.collected);assert.equal(a.completed,b.completed);assert.equal(a.won,b.won);assert.equal(a.remaining,b.remaining);
  for(let i=0;i<a.grids.length;i++){const x=a.grids[i],y=b.grids[i];for(let j=0;j<x.cells.length;j++)assert.equal(y.cells[j],x.cells[j]>=0?map[x.cells[j]]:x.cells[j]);}
  for(let i=0;i<a.pits.length;i++){const p=a.pits[i],q=b.pits[i];assert.deepEqual([q.x,q.y,q.filled,q.done,q.layer,q.FrozenCount,q.Lock],[p.x,p.y,p.filled,p.done,p.layer,p.FrozenCount,p.Lock]);}
 }return successfulMoves;
}
function features(l){const d=l.m_creationData,out=[];if(d.pits.some(p=>p.FrozenCount))out.push('冰冻');if(d.pits.some(p=>p.LockAxis))out.push('方向限制');if(d.linkedPits.length)out.push('多层盒');if(d.pits.some(p=>p.Lock?.Count))out.push('锁钥匙');if(d.pipes.length)out.push('管道');return out;}
const current=fs.readdirSync(new URL('our-level/',root)).filter(f=>/^level-\d+\.json$/.test(f)).map(f=>({file:'our-level/'+f,data:read('our-level/'+f)}));
const scheduled=[];for(let k=0;k<25;k++){scheduled.push({competitor:1,sourceSequence:selection1[k]},{competitor:2,sourceSequence:selection2[k]});}
const levels=[],entries=[];
for(let i=0;i<scheduled.length;i++){
 const {competitor,sourceSequence}=scheduled[i],sequence=i+1,sourcePath=competitor===1?'level/level-'+catalog.order[sourceSequence-1]+'.json':imported.levels.find(e=>e.collection==='competitor2'&&e.sourceId===sourceSequence).path;
 const source=read(sourcePath),old=current.find(r=>r.data.editorMeta?.sequence===sequence);assert.ok(old,'Missing original authored sequence '+sequence);
 const {map,minDistance}=mapColors(source,sequence);
 const level=Object.assign(createEmptyLevel({id:old.data.id,config,assets}),structuredClone(source));level.id=old.data.id;
 recolor(level,map);const colorProof=verifyColorDynamics(source,level,map);
 const reflected=sequence%5!==0&&source.m_creationData.pipes.length===0;if(reflected)mirror(level);
 const pattern=sequence%3===0?softenPattern(level,sequence):{changedPixels:0,pools:0,ratio:0};
 level.m_Name='我们的 '+String(sequence).padStart(2,'0')+' · '+(['彩湾','折光','回廊','色阶','映沙'][i%5]);
 const mechanics=features(level);
 level.editorMeta={collection:'ours',sequence,version:3,paletteName:'我们的新配色',palette:colors,mechanics,
  sourceReference:{competitor,sequence:sourceSequence,id:source.id,path:sourcePath,sha256:hash(fs.readFileSync(new URL(sourcePath,root)))},
  colorMap:map,transform:reflected?'horizontal-mirror':'original-geometry',patternChanges:pattern,
  compatibilityNotes:source.editorMeta?.compatibilityNotes||[],
  intent:'取自竞品'+competitor+'第'+sourceSequence+'关。沙子、方块、多层及关联机关统一换色；'+(reflected?'布局左右镜像，保留原移动关系。':'保留原布局。')+(pattern.changedPixels?'沙池内部轻微波纹改图，逐行各色数量及一格宽接沙边缘不变。':'')+'限时、容量、机关参数及空格数保留。'+(competitor===2?'沿用竞品2已有适配，未宣称原版物理完全等价。':'')};
 assert.deepEqual(validateLevel(level,assets),[]);assert.deepEqual(layoutIssues(level),[]);
 const originalBudget=editIssues(source).balance,finalBudget=editIssues(level).balance;
 for(const row of originalBudget){const match=finalBudget.find(r=>r.color===map[row.color]);assert.ok(match);assert.deepEqual([match.supply,match.required,match.difference],[row.supply,row.required,row.difference]);}
 const moveChecks=verifyMoves(source,level,reflected),score=calculateDifficulty(level,assets,config).score,sourceScore=calculateDifficulty(source,assets,config).score;assert.equal(score,sourceScore);
 const idle=new Board(level,config.rules),initial=JSON.stringify(idle);for(let t=0;t<300;t++)idle.advance(.1);assert.equal(JSON.stringify(idle),initial);
 const mirrorPositions=source.m_creationData.pits.filter((p,j)=>JSON.stringify(p.StartPosition)!==JSON.stringify(level.m_creationData.pits[j].StartPosition)).length;
 const mirrorShapes=source.m_creationData.pits.filter((p,j)=>JSON.stringify([...p.ShapeCells].sort((a,b)=>a.x-b.x||a.y-b.y))!==JSON.stringify([...level.m_creationData.pits[j].ShapeCells].sort((a,b)=>a.x-b.x||a.y-b.y))).length;
 levels.push({file:old.file,level});entries.push({sequence,id:level.id,sourceCompetitor:competitor,sourceSequence,sourceId:source.id,sourcePath,name:level.m_Name,score,sourceScore,mechanics,reflected,boxesMoved:mirrorPositions,boxShapesMirrored:mirrorShapes,pattern,minimumColorRgbDistance:+minDistance.toFixed(1),checks:{structural:true,layout:true,colorSupplyMapping:true,initialMovePlacements:moveChecks,colorOnlySimulationMoves:colorProof,idle30Seconds:true},playthroughVerified:false,minimumMovesProved:false,sourceCompatibilityNotes:source.editorMeta?.compatibilityNotes||[]});
 console.log(JSON.stringify({sequence,source:competitor+':'+sourceSequence,D:score,mirror:reflected,moved:mirrorPositions,shape:mirrorShapes,pattern:pattern.changedPixels}));
}
assert.equal(entries.filter(e=>e.sourceCompetitor===1).length,25);assert.equal(entries.filter(e=>e.sourceCompetitor===2).length,25);
assert.equal(new Set(entries.map(e=>e.sourceCompetitor+':'+e.sourceSequence)).size,50);
assert.ok(entries.some(e=>e.pattern.changedPixels>0),'No pattern variations generated');
const summary={version:3,baseId:577,date:new Date().toISOString(),method:'25 references from the first 50 of each competitor; bijective recolor, optional horizontal reflection and bounded interior row-preserving pattern edits. No physics edits. Not original creations or shortest-path proofs.',levels:entries};
if(process.argv.includes('--apply')){
 const backup=process.env.REMIX_BACKUP;assert.ok(backup,'REMIX_BACKUP is required');assert.ok(!fs.existsSync(backup),'Backup must be a fresh directory');fs.mkdirSync(backup,{recursive:true});
 for(const file of [...levels.map(e=>e.file),'our-levels-manifest.json','our-levels-verification.json','原创前50关说明.md','docs/原创50关新增要求审计.md','docs/关卡生成验收标准.md']){
  const source=new URL(file,root);if(fs.existsSync(source)){fs.mkdirSync(path.dirname(path.join(backup,file)),{recursive:true});fs.copyFileSync(source,path.join(backup,file));}
 }
 const baseline=[];for(const dir of ['level','competitor2-level'])for(const f of fs.readdirSync(new URL(dir+'/',root)))if(/^level-\d+\.json$/.test(f)){const file=dir+'/'+f;baseline.push({file,sha256:hash(fs.readFileSync(new URL(file,root)))});}
 for(const file of ['gamelogic.js','board.js','sand.js','asset.json','config.json','index.html','static/js/editor.js'])baseline.push({file,sha256:hash(fs.readFileSync(new URL(file,root)))});
 fs.writeFileSync(path.join(backup,'preserved-baseline.json'),JSON.stringify(baseline,null,2));
 for(const {file,level} of levels){const content=JSON.stringify(level,null,2);fs.writeFileSync(new URL(file,root),content);entries.find(e=>e.id===level.id).sha256=hash(content);}
 fs.writeFileSync(new URL('our-levels-manifest.json',root),JSON.stringify(summary,null,2));
 fs.writeFileSync(new URL('our-levels-verification.json',root),JSON.stringify({version:3,scope:summary.method,fullPlaythroughVerified:false,results:entries},null,2));
 fs.writeFileSync(new URL('docs/our-levels-v3-selection.json',root),JSON.stringify(summary,null,2));
 fs.writeFileSync(path.join(backup,'new-summary.json'),JSON.stringify(summary,null,2));
 console.log('APPLIED: 50 authored files replaced; old files backed up at '+backup);
}else console.log('DRY RUN PASSED: '+JSON.stringify({levels:50,mirrored:entries.filter(e=>e.reflected).length,patternEdited:entries.filter(e=>e.pattern.changedPixels).length,boxesMoved:entries.reduce((s,e)=>s+e.boxesMoved,0),shapesMirrored:entries.reduce((s,e)=>s+e.boxShapesMirrored,0)}));

