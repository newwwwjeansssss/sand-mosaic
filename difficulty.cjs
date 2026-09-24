// Offline heuristic; does not write Unity level configuration.
const fs=require('node:fs'),assert=require('node:assert/strict'),Board=require('./board.js');
const catalog=JSON.parse(fs.readFileSync('levels/catalog.json'));
const audit=JSON.parse(fs.readFileSync('compatibility-report.json'));
const sum=(arr,fn)=>arr.reduce((n,v)=>n+fn(v),0),median=a=>{a=[...a].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
function entities(d){return {pits:[...(d.pits||[]),...(d.platformBlockers||[]).flatMap(p=>p.HiddenPits||[]),...(d.dispensers||[]).flatMap(p=>p.QueuedPits||[])],layers:[...(d.linkedPits||[]),...(d.platformBlockers||[]).flatMap(p=>p.HiddenLinkedPits||[]),...(d.dispensers||[]).flatMap(p=>p.QueuedLinkedPits||[])],groups:[...(d.gluedGroups||[]),...(d.platformBlockers||[]).flatMap(p=>p.HiddenGluedGroups||[])]};}
const levels=catalog.levels.map(e=>JSON.parse(fs.readFileSync('levels/level_'+e.id+'.json')));
const mainIDs=new Set(catalog.order);
const cap0=median(levels.filter(l=>mainIDs.has(l.id)).flatMap(l=>{const e=entities(l.m_creationData);return [...e.pits,...e.layers].map(p=>p.Capacity).filter(n=>n>0);}));
function extract(l){
  const d=l.m_creationData,e=entities(d),all=[...e.pits,...e.layers],a=audit.results.find(a=>a.id===l.id);
  const issues=[...a.errors,...a.warnings.filter(w=>!w.startsWith('不在'))];
  if(issues.length)return {id:l.id,valid:false,issues,mainline:catalog.order.indexOf(l.id)+1||null};
  const b=new Board(l,catalog.rules),g=d.gridSize;
  const blocked=new Set();const add=(cells,a={x:0,y:0})=>{for(const c of cells||[]){const x=c.x+a.x,y=c.y+a.y;if(x>=0&&y>=0&&x<g.x&&y<g.y)blocked.add(x+','+y);}};
  add(d.wall?.ShapeCells);for(const c of d.containers||[])add(c.ShapeCells,c.Anchor);
  const floor=g.x*g.y-blocked.size,occupied=new Set();
  for(const p of b.pits)for(const c of p.ShapeCells){const key=(p.x+c.x)+','+(p.y+c.y);if(!blocked.has(key))occupied.add(key);}
  const occupancy=Math.min(1,occupied.size/Math.max(1,floor));
  // Geometric mobility only: temporarily remove counters/axes on a fresh runtime.
  for(const p of b.pits){p.FrozenCount=0;p.Lock.Count=0;p.LockAxis=0;}
  const stuck=sum(b.pits,p=>[[1,0],[-1,0],[0,1],[0,-1]].every(([x,y])=>!b.canPlace(p,p.x+x,p.y+y))?1:0)/Math.max(1,b.pits.length);
  const N=all.length,G=sum(all,p=>p.Capacity),colors=new Set(all.map(p=>p.Color)).size;
  const mixedLayers=sum(e.layers,p=>{const parent=e.pits.find(a=>a.Id===p.MainPitId);return parent&&parent.Color!==p.Color?1:0;});
  const F=sum(all,p=>p.FrozenCount||0)+sum(e.groups,p=>p.SharedFrozenCount||0);
  const K=sum(all,p=>p.Lock?.Count||0)+sum(e.groups,p=>p.SharedLock?.Count||0);
  const B=sum(all,p=>p.TableClothCount||0)+sum(e.groups,p=>p.SharedTableClothCount||0);
  const A=sum(all,p=>p.LockAxis?1:0),J=sum(e.groups,p=>Math.max(0,p.MemberPitIds.length-1));
  const O=sum(d.containers||[],c=>sum(c.GlassBlockers||[],v=>v.Count)+sum(c.RockBlockers||[],v=>v.Health))+sum(d.garages||[],v=>v.Health)+sum(d.grinders||[],v=>Math.max(v.Up,v.Right,v.Down,v.Left));
  const H=sum(d.platformBlockers||[],p=>(p.HiddenPits||[]).length),Q=sum(d.dispensers||[],p=>(p.QueuedPits||[]).length);
  const P=sum(d.pipes||[],p=>(p.GrainRows||[]).filter((row,i,rows)=>i>0&&row.Color!==rows[i-1].Color).length),Z=(d.coloredGrids||[]).length;
  const work=N+G/cap0,space=.7*occupancy+.3*stuck,color=colors+mixedLayers/Math.max(1,N);
  const mechanics=F+1.5*K+B+.5*A+1.5*J+O+.8*H+.8*Q+.25*P+.5*Z;
  return {id:l.id,valid:true,mainline:catalog.order.indexOf(l.id)+1||null,time:l.m_time,loopTime:l.m_loopTime,fields:{N,G,colors,mixedLayers,occupancy,stuck,F,K,B,A,J,O,H,Q,P,Z},raw:{space,work,color,mechanics,time:work/(l.m_time/60)}};
}
const result=levels.map(extract),reference=result.filter(r=>r.valid&&mainIDs.has(r.id));
const keys=['space','work','color','mechanics','time'],weights={space:.3,work:.2,color:.15,mechanics:.2,time:.15};
// ECDF midrank, rescaled so reference minima/maxima map to 0/1, ties equal.
const distributions=Object.fromEntries(keys.map(k=>[k,reference.map(r=>r.raw[k]).sort((a,b)=>a-b)]));
function rank(x,arr){const mid=v=>{const lo=arr.filter(a=>a<v).length,eq=arr.filter(a=>a===v).length;return lo+eq/2;};const low=mid(arr[0]),high=mid(arr[arr.length-1]);return high===low?0:Math.max(0,Math.min(1,(mid(x)-low)/(high-low)));}
function score(raw){const normalized=Object.fromEntries(keys.map(k=>[k,rank(raw[k],distributions[k])]));const contributions=Object.fromEntries(keys.map(k=>[k,9*weights[k]*normalized[k]]));const coefficient=1+sum(keys,k=>contributions[k]);return {coefficient:+coefficient.toFixed(2),normalized,contributions};}
for(const r of result)if(r.valid){Object.assign(r,score(r.raw));const t=r.loopTime>0?r.loopTime:r.time;r.loop=score({...r.raw,time:r.raw.work/(t/60)});assert.ok(r.coefficient>=1&&r.coefficient<=10);}
for(const k of keys){assert.equal(rank(distributions[k][0],distributions[k]),0);assert.equal(rank(distributions[k].at(-1),distributions[k]),1);}
const output={version:1,method:'Expert-weighted relative difficulty heuristic; not fitted to player outcomes.',reference:'Unity catalog.order, valid unique mainline files',referenceCount:reference.length,medianCapacity:cap0,weights,distributions,levels:result};
fs.writeFileSync('difficulty-results.json',JSON.stringify(output,null,2));
const first=catalog.order.slice(0,14).map((id,i)=>{const r=result.find(r=>r.id===id);return `| ${i+1} | ${id} | ${r.fields.N} | ${r.fields.colors} | ${r.time} | ${r.coefficient.toFixed(2)} |`;});
fs.writeFileSync('DIFFICULTY_FORMULA.md',`# 关卡难度系数 v1\n\n此公式是基于关卡配置的相对难度估算，不是通关率、失败率或求解证明。权重是设计初始值，未经玩家数据拟合。原配置未修改。\n\n## 总公式\n\nD = 1 + 9 × [0.30 R(S) + 0.20 R(W) + 0.15 R(C) + 0.20 R(M) + 0.15 R(T)]\n\nD 范围 1–10；R 是在 ${reference.length} 个有效主线文件中的经验百分位，使用相同值相同分的中秩，并将参考最小/最大中秩缩放至 0/1。超出参考范围截断。不是把文件 ID 或出场序号当成难度。参考数组已写入 difficulty-results.json；比较后续新增关卡应冻结该数组。\n\n## 五项原始指标\n\n- S = 0.7 × 开局占用率 + 0.3 × 开局四向均不可移盒子比例。占用率分母为棋盘面积扣除沙仓和墙体占格，分子为开局已生成盒子的占格并集。测量四向移动时临时忽略冰冻/锁/方向锁，仍保留真实形状、胶合组及实体机关。只修改独立运行时，不修改 JSON。\n- W = N + G / ${cap0}。N 为全部盒子层的数量，含初始、隐藏、队列、多层；G 为这些层的总 Capacity；${cap0} 是全主线单层 Capacity 中位数。W 是无量纲工作量，不是预计步数。\n- C = 目标颜色种数 + 异色后续层数 / max(1,N)。异色层与所属主盒颜色比较，度量换色潜力，不冒充实际解锁路径。\n- M = F + 1.5K + B + 0.5A + 1.5J + O + 0.8H + 0.8Q + 0.25P + 0.5Z。\n- T = W / (时间秒数 / 60)。表示每分钟需处理的工作量；循环用 m_loopTime > 0 时的值，否则用 m_time。ClockSeconds 加时可能无法及时获取，v1 保守地不提前抵扣时间压力。\n\n## 机关指标\n\n| 符号 | 定义 |\n|---|---|\n| F | 所有层 FrozenCount 与胶合组 SharedFrozenCount 之和 |\n| K | 所有层 Lock.Count 与组 SharedLock.Count 之和 |\n| B | TableClothCount 与 SharedTableClothCount 之和 |\n| A | LockAxis 非零的层数 |\n| J | 各胶合组 max(0,MemberPitIds.length−1) 之和 |\n| O | 玻璃 Count、岩石 Health、车库 Health，加上各转轴最长臂长之和 |\n| H | 平台 HiddenPits 数量 |\n| Q | QueuedPits 数量 |\n| P | 各管道 GrainRows 相邻颜色变化次数 |\n| Z | coloredGrids 区域数 |\n\n组锁与成员锁、机关耐久与完成顺序可能共享解锁事件；M 衡量配置约束规模，不能解释为所需独立操作次数。原始 m_difficulty 不加入评分，以免形成循环定义。\n\n## 原主线前 14 关示例\n\n| 主线关卡 | 原始 ID | 盒子层数 | 颜色数 | 秒数 | 系数 D |\n|---|---|---|---|---|---|\n${first.join('\n')}\n\n## 无效数据与边界\n\nID 8 时间为 0、ID 257 无目标、ID 568 红沙不足，返回 valid:false，不纳入基准且不赋正常难度分。可玩性/死局应另外判断，不能将不可解关简单记成 10 分。v1 未包含最短解、必需挪位次数、沙画分层可达性、操作手感和玩家熟练度；它适合初步排序与异常筛查。\n\n评分已覆盖全部 577 个文件（574 个有效分数，3 个异常）。difficulty-results.json 保存各关原始指标、归一化值、贡献分和循环分数。执行 node difficulty.cjs 可复算。\n\n后续应以首局失败率、有效操作时长、重试次数进行校准，使用时间段或关卡分组留出验证；不要直接把 D/10 当作失败概率。\n`);
console.log(JSON.stringify({medianCapacity:cap0,reference:reference.length,scored:result.filter(r=>r.valid).length,first14:catalog.order.slice(0,14).map(id=>{const r=result.find(r=>r.id===id);return {id,D:r.coefficient}})},null,2));
