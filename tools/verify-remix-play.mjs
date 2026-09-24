import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Board=require('../board.js'),root=new URL('../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const config=read('config.json'),manifest=read('our-levels-manifest.json'),directions=[[0,1],[1,0],[-1,0],[0,-1]],fork=b=>Object.assign(Object.create(Board.prototype),structuredClone(b));
function paths(b,p,index){const q=[{x:p.x,y:p.y,path:[]}],seen=new Set([p.x+','+p.y]);for(let i=0;i<q.length;i++)for(const [dx,dy] of directions){const x=q[i].x+dx,y=q[i].y+dy,key=x+','+y;if(seen.has(key)||!b.canPlace(p,x,y))continue;seen.add(key);q.push({x,y,path:[...q[i].path,{index,x,y}]});}return q;}
function touches(p,pos,g){return p.ShapeCells.some(c=>g.definition.ShapeCells.some(v=>Math.abs(pos.x+c.x-g.definition.Anchor.x-v.x)+Math.abs(pos.y+c.y-g.definition.Anchor.y-v.y)===1));}
function solve(level,budgetMs=6000){
 const deadline=Date.now()+budgetMs;let b=new Board(level,config.rules),replay=[],relocations=0;
 for(let turn=0;turn<160&&!b.won&&!b.failed;turn++){
  if(Date.now()>deadline)return null;const candidates=[];
  for(const [index,p] of b.pits.entries())if(b.movable(p)){
   const pools=b.grids.filter((g,i)=>g.cells.some(c=>c===p.color)||b.layout.pipes.some(pipe=>pipe.ContainerIndex===i&&pipe.GrainRows.some(row=>row.Color===p.color)));
   const options=paths(b,p,index).filter(pos=>pools.some(g=>touches(p,pos,g))).sort((a,c)=>a.path.length-c.path.length).slice(0,5);
   candidates.push(...options.map(pos=>({index,pos,priority:pos.path.length-(p.Key.Type?4:0)})));
  }
  candidates.sort((a,c)=>a.priority-c.priority);let best=null,partial=null;
  for(const c of candidates){
   if(Date.now()>deadline)return null;const t=fork(b),q=t.pits[c.index],oldLayer=q.layer,used=[];let valid=true;
   for(const move of c.pos.path){if(!t.move(q,move.x,move.y)){valid=false;break;}used.push(move);t.advance(.1);if(q.done||q.layer!==oldLayer||t.won)break;}
   if(!valid||!t.started)continue;let ticks=0,stale=0,last=t.collected;
   while(ticks<180&&!t.won&&!t.failed&&!q.done&&q.layer===oldLayer){t.advance(.1);ticks++;stale=t.collected===last?stale+1:0;last=t.collected;if(stale>=8)break;}
   if(q.done||q.layer!==oldLayer||t.won){best={board:t,used,ticks};break;}
   const gain=t.collected-b.collected;if(gain>0&&(!partial||gain/(used.length+1)>partial.gain/(partial.used.length+1)))partial={board:t,used,ticks,gain};
  }
  best??=partial;if(best){b=best.board;replay.push(...best.used,{wait:best.ticks/10});continue;}
  if(++relocations>16)return null;const movable=b.pits.map((p,index)=>({p,index})).filter(({p})=>b.movable(p));let moved=false;
  for(let k=0;k<movable.length;k++){const {p,index}=movable[(k+turn)%movable.length],options=paths(b,p,index).filter(pos=>pos.path.length>0);if(!options.length)continue;const pos=options[(turn*13)%options.length];for(const m of pos.path){if(!b.move(p,m.x,m.y))break;replay.push(m);b.advance(.1);if(p.done||b.won)break;}moved=true;break;}if(!moved)return null;
 }
 return b.won?{replay,moves:replay.filter(s=>s.index!==undefined).length,remaining:b.remaining}:null;
}
const sequences=[1,2,3,5,17,20,27,30,49,12,15,18,21,36],results=[];
for(const sequence of sequences){const e=manifest.levels.find(e=>e.sequence===sequence),level=read('our-level/level-'+e.id+'.json'),proof=solve(level);
 if(proof){const fresh=new Board(level,config.rules);for(const step of proof.replay){if(step.index!==undefined){const p=fresh.pits[step.index];assert.ok(fresh.move(p,step.x,step.y));assert.equal(p.x,step.x);assert.equal(p.y,step.y);fresh.advance(.1);}else for(let i=0;i<Math.round(step.wait*10);i++)fresh.advance(.1);}assert.ok(fresh.won);}
 const record={sequence,id:e.id,sha256:e.sha256,status:proof?'won':'no-proof-within-search-budget',...(proof||{})};results.push(record);console.log(JSON.stringify({sequence,status:record.status,moves:proof?.moves}));
}
fs.writeFileSync(new URL('docs/our-levels-v3-playtests.json',root),JSON.stringify({scope:'Bounded heuristic search plus strict fresh-board replay for successful samples. No proof within budget does not establish a deadlock. Move counts are witness upper bounds, not shortest paths.',results},null,2));

