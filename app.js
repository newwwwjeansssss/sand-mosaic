let COLORS=[];
const state={level:1,mode:'main',catalog:null,report:null,board:null,data:null,pits:[],drag:null,version:0,paused:false,last:0,resultShown:false};
const $=s=>document.querySelector(s),canvas=$('#board'),ctx=canvas.getContext('2d');
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',2600);}
function shapeSize(o){return {w:Math.max(...o.ShapeCells.map(c=>c.x))+1,h:Math.max(...o.ShapeCells.map(c=>c.y))+1};}
function cellSize(){const g=state.data.m_creationData.gridSize;return Math.min(canvas.width/(g.x+1),canvas.height/(g.y+1));}
function sequence(){return state.mode==='main'?state.catalog.order:state.mode==='loop'?state.catalog.loop:state.catalog.levels.map(e=>e.id);}
async function json(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('读取失败：'+url);return r.json();}
async function loadLevel(index){
  const version=++state.version;state.drag=null;state.board=null;state.data=null;state.level=index;state.resultShown=false;state.paused=false;$('#pause').textContent='暂停';$('#modal').style.display='none';$('#goal').textContent='正在加载…';
  const id=sequence()[index-1];
  try{
    const data=await json('levels/level_'+id+'.json');if(version!==state.version)return;
    const board=new SandBoard(data,state.catalog.rules,state.mode==='loop'&&data.m_loopTime>0?data.m_loopTime:data.m_time);
    state.data=data;state.board=board;state.pits=board.pits;state.last=performance.now();$('#goal').textContent='拖动盒子贴近同色沙粒';
    const entry=state.report.results.find(e=>e.id===id);$('#issues').textContent=(entry?.warnings||[]).filter(w=>!w.startsWith('不在')).join('；');
    const d=data.m_creationData;$('#grid').textContent=d.gridSize.x+' × '+d.gridSize.y;$('#containerCount').textContent=d.containers.length;
    $('#features').textContent=['linkedPits:多层','gluedGroups:胶合','pipes:管道','garages:车库','grinders:转轴','platformBlockers:隐藏平台','dispensers:出盒队列','coloredGrids:彩色地格'].filter(t=>d[t.split(':')[0]]?.length).map(t=>t.split(':')[1]).join(' · ')||'基础关卡';
  }catch(e){if(version!==state.version)return;$('#goal').textContent='此关无法启动';$('#issues').textContent=e.message+'。原配置未修改，请切换其他关卡。';ctx.clearRect(0,0,canvas.width,canvas.height);}
  $('#title').textContent=state.mode==='raw'?'文件 ID '+id:(state.mode==='loop'?'循环 ':'第 ')+index+' 关';$('#sourceId').textContent=id;
  document.querySelectorAll('.level-list button').forEach(b=>b.classList.toggle('active',+b.dataset.index===index));
}
function renderList(){const seq=sequence(),filter=$('#search').value.trim();$('#levelList').replaceChildren();seq.forEach((id,i)=>{
  if(filter&&!String(i+1).includes(filter)&&!String(id).includes(filter))return;const b=document.createElement('button');b.dataset.index=i+1;b.textContent=state.mode==='raw'?id:i+1;b.title='原始文件 ID '+id;b.onclick=()=>loadLevel(i+1);b.classList.toggle('active',i+1===state.level);$('#levelList').appendChild(b);
});$('#levelTotal').textContent=seq.length+' 项';}
function renderInfo(){const b=state.board;if(!b)return;$('#remain').textContent=b.pits.filter(p=>!p.done).length+(b.pending()?'+待出现':'');$('#pitCount').textContent=b.pits.length;$('#time').textContent=Math.ceil(b.remaining)+'s';$('#timebar').style.width=Math.min(100,b.remaining/b.timeLimit*100)+'%';$('#legend').textContent='已收集 '+b.collected.toLocaleString()+' 粒沙';}
function label(text,x,y,size,color='#ffffff'){ctx.fillStyle=color;ctx.font='bold '+Math.max(9,size)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y);ctx.textBaseline='alphabetic';}
function drawFeatures(b,s,ox,oy,after){
  const d=b.layout,h=d.gridSize.y;
  const rect=(cells,a,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;for(const c of cells||[])ctx.fillRect(ox+(a.x+c.x)*s+2,oy+(h-a.y-c.y-1)*s+2,s-4,s-4);ctx.globalAlpha=1;};
  const tag=(text,a,cells,color)=>{const c=(cells||[])[0]||{x:0,y:0};label(text,ox+(a.x+c.x+.5)*s,oy+(h-a.y-c.y-.5)*s,s*.22,color);};
  if(!after){
    for(const g of d.coloredGrids||[]){rect(g.ShapeCells,g.Anchor,COLORS[g.Color],.4);tag('同色',g.Anchor,g.ShapeCells,'white');}
    for(let i=0;i<b.platforms.length;i++)if(!b.platforms[i]){const p=d.platformBlockers[i];rect(p.ShapeCells,p.Anchor,'#806b54',.7);tag('隐藏',p.Anchor,p.ShapeCells,'white');}
    for(let i=0;i<b.dispensers.length;i++){const a=d.dispensers[i],n=(a.QueuedPits||[]).length-b.dispensers[i];if(n>0)tag('队列 '+n,a.Anchor,null,'#c6d7eb');}return;
  }
  for(const group of b.groups){const members=b.pits.filter(p=>!p.done&&group.MemberPitIds.includes(p.Id));if(members.length<2)continue;ctx.strokeStyle='#e8d6a8';ctx.lineWidth=Math.max(3,s*.09);ctx.setLineDash([s*.1,s*.06]);ctx.beginPath();members.forEach((p,i)=>{const c=p.ShapeCells[0],x=ox+(p.x+c.x+.5)*s,y=oy+(h-p.y-c.y-.5)*s;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.setLineDash([]);}
  for(let i=0;i<b.garages.length;i++)if(b.garages[i]>0){const g=d.garages[i];rect(g.ShapeCells,g.Anchor,'#65758b',.92);tag('车库 '+b.garages[i],g.Anchor,g.ShapeCells,'white');}
  for(let i=0;i<b.grinders.length;i++){const g=d.grinders[i],n=b.grinders[i],cells=[{x:0,y:0}];for(const [dx,dy,amount] of [[0,1,g.Up],[1,0,g.Right],[0,-1,g.Down],[-1,0,g.Left]])for(let k=1;k<=amount-n;k++)cells.push({x:dx*k,y:dy*k});rect(cells,g.Anchor,'#8b6878');tag('✣',g.Anchor,null,'white');}
  for(const grid of b.grids){const def=grid.definition;
    for(let i=0;i<grid.glass.length;i++)if(grid.glass[i]>0){const g=def.GlassBlockers[i],a={x:def.Anchor.x+g.Anchor.x,y:def.Anchor.y+g.Anchor.y};rect(g.ShapeCells,a,'#b9eeff',.5);tag('玻璃 '+grid.glass[i],a,g.ShapeCells,'#143343');}
    for(let i=0;i<grid.rocks.length;i++)if(grid.rocks[i]>0){const rock=def.RockBlockers[i];ctx.strokeStyle='#7c8594';ctx.lineWidth=rock.Width*s;ctx.lineCap='round';ctx.beginPath();rock.Points.forEach((p,n)=>{const x=ox+(def.Anchor.x+p.x+.5)*s,y=oy+(h-def.Anchor.y-p.y-.5)*s;n?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();ctx.lineCap='butt';}
  }
  for(let i=0;i<b.pipes.length;i++){const p=d.pipes[i],grid=b.grids[p.ContainerIndex];if(!grid)continue;const r=grid.resolution,normal=p.EdgeNormalPosition*r,tangent=p.EdgePositionInSimGrid;const x=p.Direction<2?tangent:p.Direction===2?normal:normal+r-1,y=p.Direction<2?(p.Direction===0?normal+r-1:normal):tangent;label('▣ '+b.pipes[i].reduce((a,v)=>a+v,0),ox+(grid.definition.Anchor.x+(x+.5)/r)*s,oy+(h-grid.definition.Anchor.y-(y+.5)/r)*s,s*.18);}
}
function draw(){const b=state.board;if(!b)return;const d=b.layout,g=d.gridSize,s=cellSize(),ox=(canvas.width-g.x*s)/2,oy=(canvas.height-g.y*s)/2;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0b1627';ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<g.y;y++)for(let x=0;x<g.x;x++){ctx.fillStyle=(x+y)%2?'#12243a':'#102035';ctx.fillRect(ox+x*s+1,oy+(g.y-y-1)*s+1,s-2,s-2);}
  for(const c of d.wall?.ShapeCells||[]){ctx.fillStyle='#536175';ctx.fillRect(ox+c.x*s+1,oy+(g.y-c.y-1)*s+1,s-2,s-2);}
  drawFeatures(b,s,ox,oy,false);
  for(const grid of b.grids){const a=grid.definition.Anchor,x=ox+a.x*s,y=oy+(g.y-a.y-grid.height/grid.resolution)*s;ctx.fillStyle='#111e32';for(const c of grid.definition.ShapeCells)ctx.fillRect(ox+(a.x+c.x)*s,oy+(g.y-a.y-c.y-1)*s,s,s);Sand.paint(ctx,grid,COLORS,x,y,s);Sand.outline(ctx,grid.definition.ShapeCells,a,s,ox,oy,g.y,'#ffffff');}
  for(const p of b.pits)if(!p.done)drawPit(p,s,ox,oy,g.y);drawFeatures(b,s,ox,oy,true);
  if(state.paused){ctx.fillStyle='#07101bbb';ctx.fillRect(0,0,canvas.width,canvas.height);label('已暂停',canvas.width/2,canvas.height/2,28);}
}
function frame(now){try{const dt=state.last?Math.min(.25,(now-state.last)/1000):0;state.last=now;const b=state.board;if(b){if(!state.paused)b.advance(dt);draw();renderInfo();if(!state.resultShown&&(b.won||b.failed)){state.resultShown=true;state.drag=null;$('#resultTitle').textContent=b.won?'关卡完成':'时间到';$('#resultText').textContent=b.won?'所有容器均已装满':'可以重试本关';$('#modal').style.display='flex';}}}catch(e){state.paused=true;$('#issues').textContent='运行错误：'+e.message;}requestAnimationFrame(frame);}
function pointer(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};}
canvas.addEventListener('pointerdown',e=>{const b=state.board;if(!b||state.paused||state.drag||b.won||b.failed||e.button!==0)return;const q=pointer(e),g=b.layout.gridSize,s=cellSize(),ox=(canvas.width-g.x*s)/2,oy=(canvas.height-g.y*s)/2;
  for(const p of b.pits){if(p.done)continue;if(!p.ShapeCells.some(c=>q.x>=ox+(p.x+c.x)*s&&q.x<ox+(p.x+c.x+1)*s&&q.y>=oy+(g.y-p.y-c.y-1)*s&&q.y<oy+(g.y-p.y-c.y)*s))continue;
    if(!b.movable(p)){toast('当前容器被冰冻、锁定或车库覆盖');return;}const size=shapeSize(p);state.drag={pit:p,size,dx:q.x-(ox+p.x*s),dy:q.y-(oy+(g.y-p.y-size.h)*s),pointerId:e.pointerId};canvas.setPointerCapture(e.pointerId);return;}
});
canvas.addEventListener('pointermove',e=>{const drag=state.drag,b=state.board;if(!drag||e.pointerId!==drag.pointerId||!b||state.paused)return;const q=pointer(e),g=b.layout.gridSize,s=cellSize(),ox=(canvas.width-g.x*s)/2,oy=(canvas.height-g.y*s)/2;b.move(drag.pit,(q.x-ox-drag.dx)/s,g.y-(q.y-oy-drag.dy)/s-drag.size.h);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(state.drag?.pointerId===e.pointerId)state.drag=null;});
function next(){if(!state.catalog)return;if(state.level<sequence().length)loadLevel(state.level+1);else if(state.mode==='main'){state.mode='loop';$('#mode').value='loop';state.level=1;renderList();loadLevel(1);}else loadLevel(1);}
$('#reset').onclick=()=>loadLevel(state.level);$('#again').onclick=()=>loadLevel(state.level);$('#next').onclick=next;$('#continue').onclick=next;
$('#pause').onclick=()=>{if(!state.board)return;state.paused=!state.paused;state.drag=null;$('#pause').textContent=state.paused?'继续':'暂停';};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.board){state.paused=true;state.drag=null;$('#pause').textContent='继续';}});
$('#mode').onchange=()=>{state.mode=$('#mode').value;state.level=1;renderList();loadLevel(1);};$('#search').oninput=renderList;
async function boot(){try{[state.catalog,state.report]=await Promise.all([json('levels/catalog.json'),json('compatibility-report.json')]);COLORS=state.catalog.colors.map(c=>'rgb('+[c.r,c.g,c.b].map(v=>Math.round(v*255)).join(',')+')');renderList();await loadLevel(1);requestAnimationFrame(frame);}catch(e){$('#issues').textContent=e.message;}}
boot();
