const fs=require('node:fs'),crypto=require('node:crypto'),Board=require('./board.js');
const catalog=JSON.parse(fs.readFileSync('levels/catalog.json'));
const manifest=JSON.parse(fs.readFileSync('import-manifest.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];let featureCounts={};
for(const entry of catalog.levels){
  const bytes=fs.readFileSync('levels/level_'+entry.id+'.json'),l=JSON.parse(bytes),d=l.m_creationData;
  const result={id:entry.id,mainline:catalog.order.map((id,i)=>id===entry.id?i+1:null).filter(Boolean),errors:[],warnings:[]};
  const source=fs.readFileSync(manifest.source+'/'+entry.path);
  if(sha(bytes)!==sha(source)||sha(bytes)!==manifest.files.find(f=>f.id===entry.id).sha256)throw Error('Source hash mismatch '+entry.id);
  for(const k of ['linkedPits','gluedGroups','pipes','garages','grinders','platformBlockers','dispensers','coloredGrids'])if(d[k]?.length)featureCounts[k]=(featureCounts[k]||0)+1;
  const defs=[...(d.pits||[]),...(d.platformBlockers||[]).flatMap(p=>p.HiddenPits||[]),...(d.dispensers||[]).flatMap(p=>p.QueuedPits||[])];
  const layers=[...(d.linkedPits||[]),...(d.platformBlockers||[]).flatMap(p=>p.HiddenLinkedPits||[]),...(d.dispensers||[]).flatMap(p=>p.QueuedLinkedPits||[])];
  if(!catalog.order.includes(entry.id))result.warnings.push('不在 Unity 主线顺序中；按原始 ID 可访问');
  for(const p of [...defs,...layers])if(p.Capacity<=0)result.warnings.push('容器 '+p.Id+' 容量非正数：'+p.Capacity);
  try{
    const b=new Board(l,catalog.rules);result.grains=b.grids.reduce((n,g)=>n+g.count,0);result.initialPits=b.pits.length;
    if(!b.pits.length&&!b.pending())result.warnings.push('无容器目标：原 Unity 胜利条件要求容器数大于 0');
    const available={},required={};
    for(const g of b.grids)for(const color of g.cells)if(color>=0)available[color]=(available[color]||0)+1;
    for(const pipe of d.pipes||[])for(const row of pipe.GrainRows||[])available[row.Color]=(available[row.Color]||0)+row.RowCount*pipe.Width;
    for(const p of [...defs,...layers])required[p.Color]=(required[p.Color]||0)+p.Capacity;
    for(const [color,amount] of Object.entries(required))if((available[color]||0)<amount)result.warnings.push('颜色 '+color+' 总沙量 '+(available[color]||0)+' 小于容量 '+amount+'（包括管道与隐藏层）');
    // Check immutable source even after a short simulation; do not fabricate a solution.
    b.started=true;for(let i=0;i<5;i++)b.advance(.02);
    if(JSON.stringify(l)!==JSON.stringify(JSON.parse(bytes)))throw Error('Runtime mutated level source');
  }catch(e){result.errors.push(e.message);}
  results.push(result);
}
if(sha(fs.readFileSync('levels/catalog.json'))!==manifest.catalogSha256)throw Error('Catalog changed');
const report={total:results.length,loadable:results.filter(r=>!r.errors.length).length,mainline:catalog.order.length,loop:catalog.loop.length,featureCounts,verification:'逐字节 SHA-256、全部关卡构建、短步模拟、源配置不变、沙量审计；未宣称所有关卡已通关',results};
fs.writeFileSync('compatibility-report.json',JSON.stringify(report,null,2));
const issues=results.filter(r=>r.errors.length||r.warnings.some(w=>!w.startsWith('不在')));
fs.writeFileSync('COMPATIBILITY.md','# Unity 全量迁移检查\n\n'+report.verification+'。\n\n共 '+report.total+' 个文件，'+report.loadable+' 个可构建，主线 '+report.mainline+' 项，循环 '+report.loop+' 项。原始 JSON 和 catalog 与 Unity 文件 SHA-256 完全一致。\n\n## 数据问题（保留原配置）\n\n'+issues.map(r=>'- ID '+r.id+'（主线 '+(r.mainline.join(',')||'未使用')+'）：'+[...r.errors,...r.warnings].join('；')).join('\n')+'\n\n## 表现差异\n\nH5 使用 Canvas 俯视绘制、整格拖动，未复刻 Unity 3D 模型、音效、粒子飞行动画、道具商城和体力系统。程序检查不等于逐关人工通关。\n');
console.log(JSON.stringify({total:report.total,loadable:report.loadable,issues:issues.map(r=>({id:r.id,errors:r.errors,warnings:r.warnings})),featureCounts},null,2));
