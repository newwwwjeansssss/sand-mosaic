import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';const require=createRequire(import.meta.url);globalThis.Sand=require('./sand.js');globalThis.SandBoard=require('./board.js');
const html=fs.readFileSync('index.html','utf8'),ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1])),elements=new Map(),events=new Map();let timer,frame;
const classList=()=>({values:new Set(),toggle(k,v){if(v===undefined)v=!this.values.has(k);v?this.values.add(k):this.values.delete(k);},contains(k){return this.values.has(k);}});
function node(tag='div'){return {tagName:tag,value:'',textContent:'',style:{},classList:classList(),dataset:{},children:[],files:[],disabled:false,hidden:false,append(...v){this.children.push(...v);},replaceChildren(...v){this.children=[...v];},setAttribute(){},getBoundingClientRect(){return {left:0,top:0,width:800,height:900};},setPointerCapture(){},showModal(){this.open=true;},close(){this.open=false;}};}
const context=c=>new Proxy({canvas:c},{get:(o,k)=>k in o?o[k]:()=>{}});
for(const id of ids){const n=node();if(id==='game-canvas'){n.width=300;n.height=150;n.getContext=()=>context(n);n.parentElement=node();}elements.set('#'+id,n);}
for(const c of ['.library','.level-list','.canvas-area'])elements.set(c,node());
elements.get('#level-order').value='main';const tabs=['global','level','element'].map(k=>({...node(),dataset:{tab:k}})),panels=['global','level','element'].map(k=>({...node(),dataset:{panel:k}})),tools=['select','move','place','erase','sand','sand-erase'].map(k=>({...node(),dataset:{tool:k}}));
globalThis.document={body:node(),hidden:false,querySelector:s=>{assert.ok(elements.has(s),'Missing HTML selector '+s);return elements.get(s);},querySelectorAll:s=>s==='.tab'?tabs:s==='.tab-panel'?panels:s==='[data-tool]'?tools:s==='.inspector input,.inspector textarea'?['#config-json','#level-json','#element-json'].map(s=>elements.get(s)):[],createElement:tag=>{const n=node(tag);if(tag==='canvas')n.getContext=()=>context(n);return n;},addEventListener(){}};
globalThis.window={addEventListener:(k,f)=>events.set(k,f)};globalThis.requestAnimationFrame=f=>frame=f;globalThis.setTimeout=f=>{timer=f;return 1;};globalThis.clearTimeout=()=>{};globalThis.confirm=()=>true;
globalThis.fetch=async path=>({ok:true,json:async()=>({entries:fs.readdirSync('level').map(name=>({name,type:'file'}))}),text:async()=>fs.readFileSync(path,'utf8')});
await import('./static/js/editor.js');await timer();await new Promise(setImmediate); // normal browser bootstrap
assert.match(elements.get('#status-mode').textContent,/只读/);assert.ok(elements.get('#edit-toggle').disabled);assert.ok(elements.get('#save-button').disabled);assert.match(elements.get('#level-count').textContent,/577/);assert.equal(elements.get('.level-list').children.length,24);
await elements.get('#play-button').onclick();frame(1000);assert.match(elements.get('#play-countdown').textContent,/秒/);
let writes=0;window.pywebview={api:{files:{read_text:async p=>({ok:true,data:{content:fs.readFileSync(p,'utf8')}}),list_dir:async()=>({ok:true,data:{entries:fs.readdirSync('level').map(name=>({name,type:'file'}))}}),write_text:async()=>{writes++;return {ok:true,data:{}};}}}};
await events.get('pywebviewready')();assert.match(elements.get('#status-mode').textContent,/WebView/);assert.equal(elements.get('#edit-toggle').disabled,false);await elements.get('#edit-toggle').onclick();assert.ok(elements.get('.canvas-area').classList.contains('editing'));const value=elements.get('#name-field');value.value='UI测试名字';await value.onchange({target:value});assert.equal(writes,0);await elements.get('#save-button').onclick();assert.equal(writes,1);
assert.ok(!elements.get('#save-state').textContent.includes('失败'));console.log('PASS: DOM selectors, 24 Canvas cards, 577-level discovery, browser read-only, playable preview, late WebView bridge, edit tools enabled, changes stay in memory, save writes only touched file. Real browser not exercised.');
// Exercise generated forms, not just the empty inspector.
const descendants=n=>[n,...n.children.flatMap(descendants)],byText=(root,text)=>descendants(root).find(n=>n.textContent===text);
const selector=elements.get('#entity-list');selector.value='containers:0';await selector.onchange({target:selector});
assert.equal(elements.get('#save-state').textContent,'所有更改已保存');
let properties=elements.get('#visual-properties');assert.ok(byText(properties,'沙量配置'));assert.ok(byText(properties,'玻璃 · 0'));
byText(properties,'预览填充').onclick();assert.equal(byText(properties,'应用预览').disabled,false);byText(properties,'应用预览').onclick();
assert.match(elements.get('#save-state').textContent,/未保存/);await elements.get('#undo-button').onclick();
const presets=JSON.parse(fs.readFileSync('asset.json','utf8')).categories.flatMap(c=>c.items).filter(a=>a.type==='preset');
const level=JSON.parse(elements.get('#level-json').value);
let nextId=500;
for(const preset of presets){const def=structuredClone(preset.defaults);if('Id' in def)def.Id=nextId++;if(preset.kind==='wall')level.m_creationData.wall=def;else level.m_creationData[preset.kind]=[def];}
const json=elements.get('#level-json');json.value=JSON.stringify(level);json.oninput();await elements.get('#apply-level').onclick();
for(const preset of presets){selector.value=preset.kind+':0';await selector.onchange({target:selector});assert.match(elements.get('#save-state').textContent,/未保存/,'form failed for '+preset.kind);assert.ok(elements.get('#visual-properties').children.length>1);}
selector.value='platformBlockers:0';await selector.onchange({target:selector});byText(elements.get('#visual-properties'),'＋ 添加隐藏盒子').onclick();
assert.equal(JSON.parse(elements.get('#element-json').value).HiddenPits.length,1);
selector.value='pipes:0';await selector.onchange({target:selector});byText(elements.get('#visual-properties'),'＋ 添加供沙顺序').onclick();
assert.equal(JSON.parse(elements.get('#element-json').value).GrainRows.length,2);
assert.equal(writes,1,'visual editing must not write files');
console.log('PASS: every preset property form renders; sand preview/apply/undo; nested hidden boxes and pipe supply rows; all edits stay in memory.');

await events.get('pywebviewready')();
await elements.get('#add-level').onclick();
assert.equal(elements.get('#basic-level-dialog').open,true,'new level opens a clear configuration dialog');
for(const [key,value] of Object.entries({'basic-name':'可视化新关','basic-width':'6','basic-height':'7','basic-time':'120','basic-colors':'2','basic-template':'sample'}))elements.get('#'+key).value=value;
await elements.get('#basic-form').onsubmit({preventDefault(){}});
assert.equal(elements.get('#basic-level-dialog').open,false);
assert.equal(JSON.parse(elements.get('#level-json').value).m_creationData.pits.length,2);
assert.equal(elements.get('#name-field').value,'可视化新关');
selector.value='pits:0';await selector.onchange({target:selector});
assert.ok(byText(elements.get('#visual-properties'),'旋转 90°'));
assert.ok(byText(elements.get('#visual-properties'),'按每格计算容量'));
assert.equal(writes,1,'creation only stages in memory');
await elements.get('#save-button').onclick();assert.equal(writes,2,'saving writes only the newly created level');
console.log('PASS: basic level dialog creates balanced editable layout; shape controls; new level saved alone.');
