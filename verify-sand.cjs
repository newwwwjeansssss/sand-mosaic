const fs=require('node:fs'),assert=require('node:assert/strict'),Sand=require('./sand.js');
let total=0;
for(let id=1;id<=14;id++){
  const data=JSON.parse(fs.readFileSync('levels/level_'+id+'.json','utf8'));
  let count=0,drawn=0;
  for(const def of data.m_creationData.containers){
    const grid=Sand.decode(def);
    // Independently sum the encoded run lengths, then count actual occupied pixels.
    const expected=def.GrainRuns.reduce((n,v)=>n+((v>>>22)&31)+1,0);
    assert.equal(grid.count,expected);
    assert.equal(Array.from(grid.cells).filter(c=>c>=0).length,expected);
    const ctx={fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isFinite));drawn++;}};
    Sand.paint(ctx,grid,Array(16).fill('#123456'),0,0,40);
    const before=Array.from(grid.cells).filter(c=>c>=0).sort();
    Sand.settle(grid);
    assert.deepEqual(Array.from(grid.cells).filter(c=>c>=0).sort(),before);
    count+=expected;
  }
  assert.equal(drawn,count*2);assert.ok(count>0);total+=count;
  console.log('Level',id,':',count,'grains; decode/render/conservation PASS');
}
console.log('Total',total,'grains verified');
