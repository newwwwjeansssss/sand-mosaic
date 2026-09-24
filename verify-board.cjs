const assert=require('node:assert/strict'),fs=require('node:fs'),Board=require('./board.js'),Sand=require('./sand.js');
const cell=(x,y)=>({x,y});
const pit=(Id,x,y,extra={})=>({Id,StartPosition:cell(x,y),ShapeCells:[cell(0,0)],Color:0,Capacity:1,LockAxis:0,FrozenCount:0,TableClothCount:0,...extra});
const level=(extra={})=>({id:999,m_time:60,m_creationData:{gridSize:cell(7,7),containers:[],pits:[],...extra}});
const full=(b,p)=>{p.filled=p.Capacity;b.finish(p);};
const checks=[];
function test(name,fn){fn();checks.push(name);}
test('真实吸沙→守恒→过关，不修改原配置',()=>{
  const def=level({containers:[{Anchor:cell(1,1),ShapeCells:[cell(0,0)],ResolutionPerCell:2,GrainRuns:[],GrainFills:[{ShapeCell:cell(0,0),GrainCellPosition:cell(0,0),Color:0}]}],pits:[pit(1,1,0)]});
  const original=JSON.stringify(def),b=new Board(def);b.started=true;b.advance(.04);assert.ok(b.won);assert.equal(b.collected,1);assert.equal(b.grids[0].count,0);assert.equal(JSON.stringify(def),original);
});
test('多层、钥匙、冰冻、桌布、完成后释放碰撞',()=>{
  const b=new Board(level({pits:[pit(1,0,0,{Key:{Type:2}}),pit(2,2,0,{FrozenCount:1,TableClothCount:1,Lock:{Type:2,Count:1}})],linkedPits:[{MainPitId:1,Order:0,Color:3,Capacity:9,FrozenCount:0,LockAxis:1}]}));
  full(b,b.pits[0]);assert.equal(b.pits[0].done,false);assert.equal(b.pits[0].color,3);assert.equal(b.pits[0].Capacity,9);assert.equal(b.pits[0].filled,0);assert.ok(b.movable(b.pits[1]));assert.equal(b.pits[1].TableClothCount,0);full(b,b.pits[0]);assert.ok(b.pits[0].done);
});
test('胶合整体移动、组内方向锁和组外碰撞',()=>{
  const b=new Board(level({pits:[pit(1,0,0),pit(2,1,0),pit(3,3,0)],gluedGroups:[{MemberPitIds:[1,2]}]}));
  b.move(b.pits[0],6,0);assert.deepEqual(b.pits.slice(0,2).map(p=>p.x),[1,2]);b.pits[1].LockAxis=1;assert.equal(b.move(b.pits[0],1,4),false);
});
test('共享冰冻不改写源定义',()=>{
  const l=level({pits:[pit(1,0,0),pit(2,1,0)],gluedGroups:[{MemberPitIds:[1,2],SharedFrozenCount:2}]});const b=new Board(l);assert.equal(b.pits[0].FrozenCount,2);assert.equal(l.m_creationData.pits[0].FrozenCount,0);
});
test('车库颜色过滤、转轴收缩、彩色地格',()=>{
  const b=new Board(level({pits:[pit(1,0,0),pit(2,2,0)],garages:[{Anchor:cell(2,0),ShapeCells:[cell(0,0)],Health:1,ColorFilter:{HasValue:1,m_value:0}}],grinders:[{Anchor:cell(4,4),Up:1,Right:1,Down:1,Left:1}],coloredGrids:[{Anchor:cell(1,0),ShapeCells:[cell(0,0)],Color:2}]}));
  assert.ok(b.covered(b.pits[1]));assert.equal(b.canPlace(b.pits[0],1,0),false);assert.ok(b.featureBlocks(b.pits[0],4,5));full(b,b.pits[0]);assert.equal(b.covered(b.pits[1]),false);assert.equal(b.featureBlocks(b.pits[1],4,5),false);assert.ok(b.featureBlocks(b.pits[1],4,4));
});
test('隐藏平台清空才揭开；队列出口受阻不出盒',()=>{
  const b=new Board(level({pits:[pit(1,0,0),pit(2,3,0)],platformBlockers:[{Anchor:cell(0,0),ShapeCells:[cell(0,0)],HiddenPits:[pit(4,0,0)]}],dispensers:[{QueuedPits:[pit(3,3,0)]}]}));
  assert.ok(b.pending());assert.equal(b.pits.length,2);b.move(b.pits[0],0,1);b.updateFeatures();assert.ok(b.platforms[0]);assert.ok(b.pits.some(p=>p.Id===4));b.move(b.pits[1],3,1);b.updateFeatures();assert.equal(b.dispensers[0],1);assert.equal(b.pending(),false);
});
test('管道阻塞不丢沙，玻璃和岩石遮挡可解除',()=>{
  const def={Anchor:cell(1,1),ShapeCells:[cell(0,0)],ResolutionPerCell:2,GrainRuns:[],GlassBlockers:[{Anchor:cell(0,0),ShapeCells:[cell(0,0)],Count:1}],RockBlockers:[]};
  const b=new Board(level({containers:[def],pipes:[{ContainerIndex:0,Direction:1,EdgePositionInSimGrid:1,EdgeNormalPosition:0,Width:2,GrainRows:[{Color:3,RowCount:1}]}]}));
  b.feed();assert.equal(b.pipes[0][0],2);Sand.damage(b.grids[0]);b.feed();assert.equal(b.pipes[0][0],0);assert.equal(b.grids[0].count,2);
  const rock=Sand.decode({...def,GlassBlockers:[],RockBlockers:[{Points:[cell(-.25,-.25),cell(.25,.25)],Width:1,Health:1}]});assert.ok(rock.blocked.some(x=>x));Sand.damage(rock);assert.equal(rock.blocked.some(x=>x),false);
});
test('大步拖动不可穿越边界、墙、沙仓、其他容器',()=>{
  for(const obstacle of ['pit','wall','sand']){const d={pits:[pit(1,0,0)]};if(obstacle==='pit')d.pits.push(pit(2,2,0));if(obstacle==='wall')d.wall={ShapeCells:[cell(2,0)]};if(obstacle==='sand')d.containers=[{Anchor:cell(2,0),ShapeCells:[cell(0,0)],ResolutionPerCell:2,GrainRuns:[]}];const b=new Board(level(d));b.move(b.pits[0],99,0);assert.equal(b.pits[0].x,1);b.move(b.pits[0],-99,-99);assert.deepEqual([b.pits[0].x,b.pits[0].y],[0,0]);}
});
test('计时、失败、重开独立状态',()=>{const l=level({pits:[pit(1,0,0)]}),b=new Board(l);b.advance(2);assert.equal(b.remaining,60);b.move(b.pits[0],1,0);b.advance(61);assert.ok(b.failed);assert.equal(b.move(b.pits[0],2,0),false);assert.equal(new Board(l).remaining,60);});
test('旧版 GrainFills 原始 ID163',()=>{const b=new Board(JSON.parse(fs.readFileSync('levels/level_163.json')));assert.equal(b.grids[0].count,1708);});
fs.writeFileSync('verification-results.json',JSON.stringify({passed:checks.length,checks},null,2));console.log(checks.map(s=>'PASS '+s).join('\n'));
