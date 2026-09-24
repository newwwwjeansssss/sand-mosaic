import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);globalThis.Sand=require('../sand.js');globalThis.SandBoard=require('../board.js');
const Ops=await import('../editor-logic.js'),Game=await import('../gamelogic.js'),{EditorStore}=await import('../static/js/editor-store.js');
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url))),assets=JSON.parse(fs.readFileSync(new URL('../asset.json',import.meta.url)));
const empty=()=>Game.createEmptyLevel({id:9000,config,assets});
const pool=()=>({Anchor:{x:0,y:0},ShapeCells:[{x:0,y:0},{x:1,y:0}],ResolutionPerCell:18,GrainRuns:[],GrainFills:[],GlassBlockers:[],RockBlockers:[]});
test('exact mixed fill conserves every color and preview is deterministic',()=>{
  const a=pool(),b=pool(),amounts=[{color:0,count:212},{color:3,count:179},{color:15,count:100}];
  Ops.fillPool(a,amounts,'mixed');Ops.fillPool(b,amounts,'mixed');assert.deepEqual(a,b);
  assert.equal(Ops.poolStats(a).total,491);assert.deepEqual([...Ops.poolStats(a).colors].sort((a,b)=>a[0]-b[0]),[[0,212],[3,179],[15,100]]);
  assert.equal(Ops.poolStats(a).maximum,648);assert.throws(()=>Ops.fillPool(a,[{color:0,count:649}]),/超出/);assert.equal(Ops.poolStats(a).total,491);
});
test('shape resize preserves overlapping sand and requires explicit loss handling',()=>{
  const a=pool();Ops.fillPool(a,[{color:2,count:648}]);const original=structuredClone(a);
  assert.throws(()=>Ops.reshapeObject(a,[{x:0,y:0}]),/324/);assert.deepEqual(a,original);
  assert.equal(Ops.reshapeObject(a,[{x:0,y:0}],{allowLoss:true}),324);assert.equal(Ops.poolStats(a).total,324);
  Ops.reshapeObject(a,[{x:0,y:0},{x:0,y:1}]);assert.equal(Ops.poolStats(a).total,324);assert.equal(Ops.poolStats(a).maximum,648);
  assert.throws(()=>Ops.reshapeObject(a,[]),/至少/);
});
test('generated sand respects blockers and encoding retains sparse shapes',()=>{
  const a=pool();a.ShapeCells=[{x:0,y:0},{x:2,y:0}];a.GlassBlockers=[{Anchor:{x:0,y:0},ShapeCells:[{x:0,y:0}],Count:1}];
  assert.equal(Ops.poolStats(a).available,324);Ops.fillPool(a,[{color:1,count:324}]);const g=Sand.decode(a);
  for(let i=0;i<g.cells.length;i++)if(g.blocked[i])assert.ok(g.cells[i]<0);
  assert.equal(g.count,324);assert.throws(()=>Ops.reshapeObject(a,[{x:2,y:0}],{allowLoss:true}),/玻璃/);
});
test('deleting pools removes associated pipes and fixes subsequent indices',()=>{
  const l=empty();l.m_creationData.containers=[pool(),pool(),pool()];l.m_creationData.pipes=[{ContainerIndex:0},{ContainerIndex:1},{ContainerIndex:2}];
  Ops.deleteWithReferences(l,{kind:'containers',index:1});assert.deepEqual(l.m_creationData.pipes.map(p=>p.ContainerIndex),[0,1]);
});
test('duplicating boxes creates independent IDs and matching layers',()=>{
  const l=empty();l.m_creationData.linkedPits=[{Id:1,MainPitId:0,Color:1,Capacity:50,Order:0}];
  const selection=Ops.duplicateEntity(l,{kind:'pits',index:0}),copy=Game.selectedObject(l,selection);
  assert.equal(copy.Id,2);assert.equal(l.m_creationData.linkedPits[1].MainPitId,2);assert.equal(l.m_creationData.linkedPits[1].Id,3);
  Ops.deleteWithReferences(l,selection);assert.equal(l.m_creationData.linkedPits.length,1);
});
test('budget includes pipes, linked, hidden and queued targets',()=>{
  const l=empty(),d=l.m_creationData;d.pipes=[{ContainerIndex:0,Width:2,GrainRows:[{Color:1,RowCount:10}]}];d.linkedPits=[{Id:2,MainPitId:0,Color:1,Capacity:4}];d.platformBlockers=[{HiddenPits:[{Id:3,Color:1,Capacity:6}]}];d.dispensers=[{QueuedPits:[{Id:4,Color:1,Capacity:8}]}];
  const row=Ops.editIssues(l).balance.find(r=>r.color===1);assert.deepEqual(row,{color:1,supply:20,required:18,difference:2});
});
test('copy, edit, undo/redo and save/reopen preserve unknown fields and exact sand',async()=>{
  const level=empty();level.custom={keep:'unchanged'};const writes=new Map(),store=new EditorStore({config,assets,levels:[{data:level,path:'level/level-9000.json',name:'level-9000.json'}],files:{mkdir:async()=>{},writeText:async(path,text)=>writes.set(path,text)}});
  store.duplicateLevel();assert.equal(store.current.data.id,9001);store.updateLevel(l=>Ops.fillPool(l.m_creationData.containers[0],[{color:2,count:103}]));
  store.undo();assert.equal(Ops.poolStats(store.current.data.m_creationData.containers[0]).total,324);store.redo();await store.save();
  const reopened=JSON.parse(writes.get('our-level/level-9001.json'));assert.equal(Ops.poolStats(reopened.m_creationData.containers[0]).total,103);assert.deepEqual(reopened.custom,{keep:'unchanged'});assert.equal(writes.size,1);
});
