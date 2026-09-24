import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);globalThis.Sand=require('./sand.js');globalThis.SandBoard=require('./board.js');
const {validateLevel}=await import('./gamelogic.js');const {layoutIssues}=await import('./phase1-logic.js');const {editIssues}=await import('./editor-logic.js');
const root=new URL('./',import.meta.url),source=new URL('ColorSand-1.1.9/ColorSand-1.1.9/',root),read=p=>JSON.parse(fs.readFileSync(p));
const report=read(new URL('conversion-report.json',source)),catalog=read(new URL('Levels/catalog.json',source)),assets=read(new URL('asset.json',root));
const manifestPath=new URL('competitor2-import.json',root);assert.ok(!fs.existsSync(manifestPath),'Already imported: use manifest to avoid importing duplicates');
const existing=['level','our-level'].flatMap(dir=>fs.readdirSync(new URL(dir+'/',root)).filter(f=>/^level-\d+\.json$/.test(f)).map(f=>read(new URL(dir+'/'+f,root)).id));let nextId=Math.max(0,...existing)+1;
const palette=catalog.colors.map(c=>c.a===0?null:'#'+[c.r,c.g,c.b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join(''));
const planned=[],quarantined=[];for(const entry of report.levels){const original=read(new URL(entry.file,source)),level=structuredClone(original),main=catalog.order.includes(entry.id);level.id=nextId;
 const note=entry.notes.length?'适配提示：'+entry.notes.join('；'):'无额外转换提示。';
 level.editorMeta={collection:main?'competitor2':'competitor2other',sequence:entry.id,sourceId:entry.id,sourceName:entry.sourceName,sourceFile:entry.file,sourcePackage:report.package,sourceVersion:report.version,paletteName:'ColorSand 1.1.9',palette,compatibilityNotes:entry.notes,playthroughVerified:false,intent:'竞品2 · ColorSand 1.1.9 · '+(main?'主线第 '+entry.id+' 关':'额外资源 '+entry.sourceName)+'。按当前编辑器规则模拟，未验证原版行为等价或逐关通关。'+note};
 const errors=[...validateLevel(level,assets),...layoutIssues(level)],balance=editIssues(level).balance.filter(row=>row.difference!==0);if(balance.length)errors.push('沙量与容量不匹配');
 if(errors.length){quarantined.push({sourceId:entry.id,sourceName:entry.sourceName,sourceFile:entry.file,path:'competitor2-level/quarantine/source-'+entry.id+'.json',errors,balance,content:fs.readFileSync(new URL(entry.file,source))});continue;}
 const payload={...level};delete payload.editorMeta;payload.id=original.id;assert.deepEqual(payload,original,'Original fields changed');
 planned.push({id:nextId++,sourceId:entry.id,sourceName:entry.sourceName,sourceFile:entry.file,collection:level.editorMeta.collection,path:'competitor2-level/level-'+level.id+'.json',notes:entry.notes,level});}
assert.equal(planned.filter(e=>e.collection==='competitor2').length,470);assert.equal(planned.length,493);assert.deepEqual(quarantined.map(e=>e.sourceId),[471,495,496,497]);
for(const entry of [...planned,...quarantined])assert.ok(!fs.existsSync(new URL(entry.path,root)),'Refuse overwrite '+entry.path);
fs.mkdirSync(new URL('competitor2-level/quarantine/',root),{recursive:true});const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
for(const e of planned){const data=JSON.stringify(e.level,null,2);fs.writeFileSync(new URL(e.path,root),data);e.sha256=hash(data);delete e.level;}
for(const e of quarantined){fs.writeFileSync(new URL(e.path,root),e.content);e.sha256=hash(e.content);delete e.content;}
fs.writeFileSync(manifestPath,JSON.stringify({version:1,importedAt:new Date().toISOString(),sourcePackage:report.package,sourceVersion:report.version,mainlineCount:470,extraCount:23,quarantinedCount:4,palette,scope:'Layout/data compatibility and sand balance. Simulation uses current editor rules; not proof of original behavior or playthrough.',levels:planned,quarantined},null,2));
console.log(JSON.stringify({imported:planned.length,mainline:470,extras:23,quarantined:quarantined.map(e=>e.sourceId),idRange:[planned[0].id,planned.at(-1).id]}));
