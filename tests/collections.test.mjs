import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionOf,sequenceOf,filterLevels,counterpart,nextLevel,assignOurMetadata} from '../static/js/level-collections.js';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);globalThis.Sand=require('../sand.js');globalThis.SandBoard=require('../board.js');
const {EditorStore}=await import('../static/js/editor-store.js');
const catalog={order:[58,59]};
const records=[{data:{id:59,m_Name:'竞品二'}},{data:{id:601,m_Name:'原创一',editorMeta:{collection:'ours',sequence:1}}},{data:{id:58,m_Name:'竞品一'}},{data:{id:602,m_Name:'原创二',editorMeta:{collection:'ours',sequence:2}}},{data:{id:1,m_Name:'额外文件'}}];
test('independent collections follow their own display order and search sequence',()=>{
 assert.deepEqual(filterLevels(records,catalog,'ours').map(r=>r.data.id),[601,602]);
 assert.deepEqual(filterLevels(records,catalog,'competitor').map(r=>r.data.id),[58,59]);
 assert.deepEqual(filterLevels(records,catalog,'other').map(r=>r.data.id),[1]);
 assert.equal(filterLevels(records,catalog,'competitor','2')[0].data.id,59);
 assert.equal(sequenceOf(records[2].data,catalog),1);
});
test('comparison and next level do not mix collections or wrap at the end',()=>{
 assert.equal(counterpart(records[1].data,records,catalog).data.id,58);
 assert.equal(nextLevel(records[1].data,records,catalog).data.id,602);
 assert.equal(nextLevel(records[3].data,records,catalog),null);
 assert.equal(counterpart(records[4].data,records,catalog),null);
});
test('new and copied levels receive unique sequence and no stale proof',()=>{
 const data={id:603,editorMeta:{collection:'ours',sequence:1,verification:'passed',replay:'old'}};
 assignOurMetadata(data,records);
 assert.equal(collectionOf(data,catalog),'ours');assert.equal(data.editorMeta.sequence,3);
 assert.equal(data.editorMeta.verification,undefined);assert.equal(data.editorMeta.replay,undefined);
});
test('undo creation and deletion keep a useful selection within our collection',()=>{
 const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url))),assets=JSON.parse(fs.readFileSync(new URL('../asset.json',import.meta.url)));
 const store=new EditorStore({config,assets,levels:records.map(r=>({...r,path:'level/level-'+r.data.id+'.json'})),files:{}});store.select(602);
 store.addLevel();const newId=store.currentLevelId;assert.equal(store.current.data.editorMeta.sequence,3);
 store.undo();assert.equal(store.currentLevelId,602);store.redo();assert.equal(store.currentLevelId,newId);
 store.deleteLevel();assert.equal(store.current.data.editorMeta.collection,'ours');store.undo();assert.equal(store.currentLevelId,newId);
});
