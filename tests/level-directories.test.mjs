import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as discovery from '../levellist.js';
const require=createRequire(import.meta.url);globalThis.Sand=require('../sand.js');globalThis.SandBoard=require('../board.js');
const {EditorStore}=await import('../static/js/editor-store.js');
const config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url))),assets=JSON.parse(fs.readFileSync(new URL('../asset.json',import.meta.url)));
test('directory scan keeps distinct physical paths and ignores non-level files',async()=>{
 assert.equal(typeof discovery.scanLevelFiles,'function');
 const records=await discovery.scanLevelFiles(async dir=>({entries:[{name:dir==='level'?'level-58.json':dir==='our-level'?'level-578.json':'level-628.json',type:'file'},{name:'asset',type:'directory'},{name:'notes.json',type:'file'}]}));
 assert.deepEqual(records.map(r=>r.path),['level/level-58.json','our-level/level-578.json','competitor2-level/level-628.json']);
});
test('new and copied levels save and delete only inside our-level',async()=>{
 const data=JSON.parse(fs.readFileSync(new URL(fs.existsSync(new URL('../our-level/level-578.json',import.meta.url))?'../our-level/level-578.json':'../level/level-578.json',import.meta.url)));
 const writes=[],deletes=[],mkdir=[];const files={writeText:async p=>writes.push(p),remove:async p=>deletes.push(p),mkdir:async p=>mkdir.push(p)};
 const store=new EditorStore({config,assets,levels:[{path:'our-level/level-578.json',name:'level-578.json',data}],files});
 store.addLevel();assert.equal(store.current.path,'our-level/level-579.json');store.undo();
 store.duplicateLevel();assert.equal(store.current.path,'our-level/level-579.json');await store.save();
 assert.deepEqual(writes,['our-level/level-579.json']);assert.ok(mkdir.includes('our-level'));
 store.deleteLevel();await store.save();assert.deepEqual(deletes,['our-level/level-579.json']);
});
