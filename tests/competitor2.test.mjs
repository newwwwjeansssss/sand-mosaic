import {test} from 'node:test';
import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
import * as Collections from '../static/js/level-collections.js';import * as Game from '../gamelogic.js';import * as Discovery from '../levellist.js';
const require=createRequire(import.meta.url);globalThis.Sand=require('../sand.js');globalThis.SandBoard=require('../board.js');
const assets=JSON.parse(fs.readFileSync(new URL('../asset.json',import.meta.url))),config=JSON.parse(fs.readFileSync(new URL('../config.json',import.meta.url)));
const source=new URL('../ColorSand-1.1.9/ColorSand-1.1.9/',import.meta.url);
const original=JSON.parse(fs.readFileSync(new URL('Levels/1-50/level_1.json',source)));
const custom=[null,...Array.from({length:12},(_,i)=>'#'+(0x123450+i).toString(16))];
test('competitor2 keeps independent sequence, next level, and counterpart',()=>{
 const cat={order:[58]},levels=[{data:{id:58}},{data:{id:578,editorMeta:{collection:'ours',sequence:1}}},{data:{id:628,editorMeta:{collection:'competitor2',sequence:1}}},{data:{id:629,editorMeta:{collection:'competitor2',sequence:2}}},{data:{id:1100,editorMeta:{collection:'competitor2other',sequence:472}}}];
 assert.equal(Collections.collectionOf(levels[2].data,cat),'competitor2');assert.equal(Collections.sequenceOf(levels[2].data,cat),1);assert.equal(Collections.nextLevel(levels[2].data,levels,cat).data.id,629);assert.equal(Collections.nextLevel(levels[3].data,levels,cat),null);assert.equal(Collections.counterpart(levels[2].data,levels,cat).data.id,578);assert.equal(Collections.counterpart(levels[1].data,levels,cat,'competitor2').data.id,628);assert.equal(Collections.counterpart(levels[4].data,levels,cat),null);
});
test('per-level palette displays original colors without mutating shared assets or grain data',()=>{
 const l=structuredClone(original),saved=JSON.stringify(assets),grains=JSON.stringify(l.m_creationData);l.editorMeta={palette:custom,paletteName:'ColorSand'};
 assert.equal(Game.palette(assets,l)[1],custom[1]);assert.equal(typeof Game.assetsForLevel,'function');assert.equal(Game.allAssets(Game.assetsForLevel(l,assets)).find(a=>a.colorIndex===1).color,custom[1]);assert.ok(!Game.allAssets(Game.assetsForLevel(l,assets)).some(a=>a.type==='color'&&a.colorIndex===0));assert.deepEqual(Game.validateLevel(l,assets),[]);assert.equal(JSON.stringify(assets),saved);assert.equal(JSON.stringify(l.m_creationData),grains);
 const bad=structuredClone(l);bad.m_creationData.pits[0].Color=0;assert.ok(Game.validateLevel(bad,assets).length);
 const preset=Game.allAssets(assets).find(a=>a.kind==='pits');const sel=Game.addEntity(l,preset,{x:0,y:0});assert.equal(Game.selectedObject(l,sel).Color,1);
});
test('copy to authored list retains palette but discards competitor metadata',async()=>{
 const {EditorStore}=await import('../static/js/editor-store.js');const l=structuredClone(original);l.id=628;l.editorMeta={collection:'competitor2',sequence:1,palette:custom,paletteName:'ColorSand',sourceId:1};const written=new Map();const store=new EditorStore({config,assets,levels:[{data:l,path:'competitor2-level/level-628.json'}],files:{mkdir:async()=>{},writeText:async(p,t)=>written.set(p,t)}});store.duplicateLevel();assert.equal(store.current.path,'our-level/level-629.json');assert.equal(store.current.data.editorMeta.collection,'ours');assert.deepEqual(store.current.data.editorMeta.palette,custom);assert.equal(store.current.data.editorMeta.sourceId,undefined);await store.save();assert.deepEqual(JSON.parse(written.get('our-level/level-629.json')).editorMeta.palette,custom);
});
test('discovery includes independent competitor2 folder',()=>assert.ok(Discovery.LEVEL_DIRECTORIES.includes('competitor2-level')));
