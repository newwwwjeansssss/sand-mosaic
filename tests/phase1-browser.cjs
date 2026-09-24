const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/inke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const origin=process.env.EDITOR_TEST_URL||'http://127.0.0.1:8769';
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],dialogs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 const level=async()=>JSON.parse(await page.locator('#level-json').inputValue());
 async function select(value){await page.locator('[data-tab="element"]').click();await page.locator('#entity-list').selectOption(value);}
 async function create(colors=1){await page.locator('#add-level').click();await page.locator('#basic-name').fill('基础关卡流程测试');await page.locator('#basic-colors').selectOption(String(colors));await page.locator('#basic-create').click();await page.locator('#basic-level-dialog').waitFor({state:'hidden'});}
 async function coord(x,y){const b=await page.locator('#game-canvas').boundingBox(),l=await level(),g=l.m_creationData.gridSize;return page.locator('#game-canvas').evaluate((c,{b,g,x,y})=>{const s=Math.min(c.width/(g.x+1),c.height/(g.y+1)),ox=(c.width-g.x*s)/2,oy=(c.height-g.y*s)/2;return {x:b.x+(ox+(x+.5)*s)*b.width/c.width,y:b.y+(oy+(g.y-y-.5)*s)*b.height/c.height};},{b,g,x,y});}
 async function drag(x,y,toX,toY){const a=await coord(x,y),b=await coord(toX,toY);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();}
 try{
  await page.goto(origin+'/tests/editor-preview.html');await page.locator('#status-mode').filter({hasText:'WebView'}).waitFor();
  await create();assert.equal((await level()).m_creationData.pits.length,1);
  await select('containers:0');await page.getByLabel('矩形宽度',{exact:true}).fill('2');await page.getByRole('button',{name:'设为矩形',exact:true}).click();
  await page.getByLabel('颜色 0填充数量',{exact:true}).fill('648');await page.getByRole('button',{name:'预览填充',exact:true}).click();await page.getByRole('button',{name:'应用预览',exact:true}).click();
  await page.getByLabel('矩形宽度',{exact:true}).fill('1');await page.getByRole('button',{name:'设为矩形',exact:true}).click();
  assert.ok(dialogs.some(s=>s.includes('324')),'shrinking a filled pool must ask before discarding 324 grains');
  assert.equal((await level()).m_creationData.containers[0].ShapeCells.length,2,'dismissing loss prompt preserves shape');
  await page.locator('#undo-button').click();await page.locator('#undo-button').click(); // original 1-cell pool
  const originalSand=await level();
  await page.locator('.asset').filter({has:page.locator('.asset-name',{hasText:'颜色 2'})}).click();await page.locator('[data-tool="sand-rectangle"]').click();await drag(1,5,1.35,5.35);
  assert.notDeepEqual((await level()).m_creationData.containers[0].GrainRuns,originalSand.m_creationData.containers[0].GrainRuns);await page.locator('#undo-button').click();assert.deepEqual(await level(),originalSand);
  await select('pits:0');await page.locator('#copy-element').click();assert.equal((await level()).m_creationData.pits.length,2);assert.ok(!(await page.locator('#validation-result').innerText()).includes('重叠'));await page.locator('#undo-button').click();
  await page.locator('[data-tool="wall"]').click();await drag(0,0,2,0);assert.equal((await level()).m_creationData.wall.ShapeCells.length,3);
  await page.locator('[data-tool="wall-erase"]').click();await drag(1,0,1,0);assert.deepEqual((await level()).m_creationData.wall.ShapeCells,[{x:0,y:0},{x:2,y:0}]);
  await page.locator('#undo-button').click();assert.equal((await level()).m_creationData.wall.ShapeCells.length,3);await page.locator('#undo-button').click();assert.equal((await level()).m_creationData.wall.ShapeCells.length,0);
  await page.locator('[data-tool="move"]').click();const before=await level();await drag(1,1,1,5);assert.deepEqual(await level(),before);assert.match(await page.locator('#save-state').innerText(),/重叠/);
  await page.locator('#play-button').click();await drag(1,1,1,4);await page.locator('#result-title').filter({hasText:'关卡完成'}).waitFor({timeout:15000});
  await page.locator('#stop-button').click();assert.deepEqual(await level(),before);assert.equal(await page.locator('#edit-status').innerText(),'编辑模式');
  await page.evaluate(()=>{const write=window.pywebview.api.files.write_text;window.phase1Writes=[];window.pywebview.api.files.write_text=async(...args)=>{window.phase1Writes.push(args);return write(...args);};});
  await page.locator('#save-button').click();await page.locator('#save-state').filter({hasText:'所有更改已保存'}).waitFor();const writes=await page.evaluate(()=>window.phase1Writes);assert.equal(writes.length,1);assert.equal(writes[0][2],false);assert.deepEqual(JSON.parse(writes[0][1]),before);
  await select('pits:0');await page.screenshot({path:'phase1-properties.png',fullPage:true});
  await page.setViewportSize({width:1180,height:860});await page.screenshot({path:'phase1-compact.png',fullPage:true});
  assert.deepEqual(errors,[]);
  const readonly=await browser.newPage();await readonly.goto(origin);await readonly.locator('#status-mode').filter({hasText:'只读'}).waitFor();assert.ok(await readonly.locator('#add-level').isDisabled());assert.ok(await readonly.locator('#save-button').isDisabled());
  await readonly.locator('#level-collection').selectOption('competitor');await readonly.locator('#level-search').fill('396');await readonly.locator('.level-card').first().click();await readonly.locator('#play-button').click();assert.ok(await readonly.locator('#stop-button').isVisible(),'legacy duplicate shape remains previewable');
  console.log('PASS: real Chrome basic creation, loss cancellation, rectangle sand fill, free-position duplication, continuous wall painting/erasing, gesture undo, overlap rollback, simulated victory, edit restoration, save payload, read-only and legacy preview; zero page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
