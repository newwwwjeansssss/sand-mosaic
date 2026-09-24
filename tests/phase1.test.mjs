import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
globalThis.Sand=require('../sand.js');globalThis.SandBoard=require('../board.js');
const P=await import('../phase1-logic.js').catch(()=>({}));
const Game=await import('../gamelogic.js'),Ops=await import('../editor-logic.js');
const {EditorStore}=await import('../static/js/editor-store.js');
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url))),assets=JSON.parse(fs.readFileSync(new URL('../asset.json',import.meta.url)));
const basic=(extra={})=>P.createBasicLevel({id:9000,config,assets,name:'基础测试',width:6,height:7,time:180,colorCount:3,...extra});
test('basic generator creates balanced playable levels at different board sizes',()=>{
  assert.equal(typeof P.createBasicLevel,'function');
  for(const size of [[4,5],[6,7],[12,12]])for(const colorCount of [1,2,3]){
    const l=basic({width:size[0],height:size[1],colorCount});assert.deepEqual(Game.validateLevel(l,assets),[]);assert.deepEqual(P.layoutIssues(l),[]);
    assert.ok(Ops.editIssues(l).balance.every(r=>r.difference===0));
    const session=Game.createSession(l,config);for(const p of session.pits){session.move(p,p.x,size[1]-3);for(let n=0;n<500&&!p.done;n++)session.advance(.02);assert.ok(p.done);}
    assert.ok(session.won);assert.equal(l.m_creationData.pits[0].StartPosition.y,1);
  }
});
test('blank generation has no entities and invalid dimensions fail without mutation',()=>{
  assert.equal(typeof P.createBasicLevel,'function');assert.equal(basic({blank:true}).m_creationData.pits.length,0);
  for(const extra of [{width:3},{height:4},{width:NaN},{time:0},{colorCount:4}])assert.throws(()=>basic(extra));
});
test('wall strokes erase only selected cells and reject occupied positions',()=>{
  assert.equal(typeof P.paintWall,'function');const l=basic();P.paintWall(l,{x:0,y:0});P.paintWall(l,{x:1,y:0});P.paintWall(l,{x:0,y:0},true);
  assert.deepEqual(l.m_creationData.wall.ShapeCells,[{x:1,y:0}]);const original=structuredClone(l);
  assert.throws(()=>P.paintWall(l,{x:1,y:1}),/重叠/);assert.deepEqual(l,original);
});
test('layout checks allow garage covering boxes but reject base overlap and bounds',()=>{
  assert.equal(typeof P.layoutIssues,'function');const l=basic();l.m_creationData.garages=[{Anchor:{x:1,y:1},ShapeCells:[{x:0,y:0}]}];assert.deepEqual(P.layoutIssues(l),[]);
  l.m_creationData.pits[0].StartPosition.x=100;assert.match(P.layoutIssues(l).join(' '),/超出/);
  l.m_creationData.pits[0].StartPosition={...l.m_creationData.pits[1].StartPosition};assert.match(P.layoutIssues(l).join(' '),/重叠/);
});
test('rotating a pool preserves exact colors and box capacity remains independent',()=>{
  assert.equal(typeof P.transformObject,'function');const l=basic(),pool=l.m_creationData.containers[0];Ops.reshapeObject(pool,[{x:0,y:0},{x:1,y:0},{x:0,y:1}]);Ops.fillPool(pool,[{color:0,count:170},{color:2,count:133}]);
  const before=structuredClone(pool),counts=[...Ops.poolStats(pool).colors].sort();for(let n=0;n<4;n++)P.transformObject(pool,'rotate');assert.deepEqual(pool.ShapeCells,before.ShapeCells);assert.deepEqual([...Ops.poolStats(pool).colors].sort(),counts);
  const p=l.m_creationData.pits[0],capacity=p.Capacity;P.transformObject(p,'mirror');assert.equal(p.Capacity,capacity);
});
test('store supports custom creation, rollback, undo and save/reopen with no original writes',async()=>{
  const original=Game.createEmptyLevel({id:9000,config,assets}),writes=new Map();const store=new EditorStore({config,assets,levels:[{data:original,path:'level/level-9000.json'}],files:{mkdir:async()=>{},writeText:async(p,t)=>writes.set(p,t)}});
  store.addLevel({name:'我的基础关',width:6,height:7,time:120,colorCount:2});assert.equal(store.current.data.m_Name,'我的基础关');assert.equal(store.current.data.m_creationData.pits.length,2);
  const before=structuredClone(store.current.data);assert.throws(()=>store.updateLevel(l=>{l.m_creationData.pits[0].StartPosition.x=-1;},{checkLayout:true}),/超出/);assert.deepEqual(store.current.data,before);
  store.updateLevel(l=>l.m_creationData.pits[0].Capacity++);store.undo();assert.deepEqual(store.current.data,before);store.redo();store.undo();await store.save();
  assert.equal(writes.size,1);assert.deepEqual(JSON.parse(writes.get('our-level/level-9001.json')),before);
});
test('rectangle sand fill is clipped to selected pool and preserves other grains',()=>{
  assert.equal(typeof P.paintSandArea,'function');const l=basic(),p=l.m_creationData.containers[0],r=p.ResolutionPerCell;
  P.paintSandArea(p,{x:0,y:0},{x:r/2-1,y:r-1},2);const stats=Ops.poolStats(p);assert.equal(stats.total,r*r);assert.equal(stats.colors.get(2),r*r/2);
  const other=structuredClone(l.m_creationData.containers[1]);P.paintSandArea(p,{x:-20,y:-20},{x:0,y:0},-1);assert.equal(Ops.poolStats(p).total,r*r-1);assert.deepEqual(l.m_creationData.containers[1],other);
});
test('save refuses newly introduced collisions and leaves dirty data available',async()=>{
  const l=basic(),writes=[];const store=new EditorStore({config,assets,levels:[{data:l,path:'level/level-9000.json'}],files:{writeText:async(...args)=>writes.push(args)}});
  store.updateLevel(v=>v.m_creationData.pits[0].StartPosition={...v.m_creationData.pits[1].StartPosition});await assert.rejects(()=>store.save(),/重叠/);assert.equal(writes.length,0);assert.ok(store.dirty);
});
test('duplicating a basic object finds a free position and leaves full boards untouched',()=>{
  assert.equal(typeof P.duplicateBasicEntity,'function');const l=basic(),selection=P.duplicateBasicEntity(l,{kind:'pits',index:0});assert.equal(l.m_creationData.pits.length,4);assert.deepEqual(P.layoutIssues(l),[]);assert.notEqual(l.m_creationData.pits[selection.index].Id,l.m_creationData.pits[0].Id);
  const full=basic({width:4,height:5,colorCount:1,blank:true});full.m_creationData.pits=[{Id:0,StartPosition:{x:0,y:0},ShapeCells:Array.from({length:20},(_,i)=>({x:i%4,y:Math.floor(i/4)})),Color:0,Capacity:20}];const before=structuredClone(full);assert.throws(()=>P.duplicateBasicEntity(full,{kind:'pits',index:0}),/空间/);assert.deepEqual(full,before);
});
