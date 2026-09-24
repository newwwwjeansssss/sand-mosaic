/* Draw the union of ShapeCells: shared edges are interior, not box walls. */
function drawPit(p, s, ox, oy, boardHeight) {
  const has = (x,y) => p.ShapeCells.some(c=>c.x===x&&c.y===y);
  const inset=0, rim=Math.max(2,s*.06);
  const ratio=Math.min(1,p.filled/Math.max(1,p.Capacity));
  const amounts=Sand.fillAmounts(p.ShapeCells,ratio);
  ctx.save();
  ctx.beginPath();
  for(const c of p.ShapeCells){
    const x=ox+(p.x+c.x)*s,y=oy+(boardHeight-p.y-c.y-1)*s;
    const l=has(c.x-1,c.y)?0:inset,r=has(c.x+1,c.y)?0:inset;
    const t=has(c.x,c.y+1)?0:inset,b=has(c.x,c.y-1)?0:inset;
    ctx.rect(x+l,y+t,s-l-r,s-t-b);
  }
  ctx.fillStyle='#081321';ctx.fill();ctx.clip();ctx.fillStyle=COLORS[p.color];ctx.globalAlpha=.25;ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=COLORS[p.color];ctx.globalAlpha=.75;
  for(const [i,c] of p.ShapeCells.entries()){
    const x=ox+(p.x+c.x)*s,bottom=oy+(boardHeight-p.y-c.y)*s;
    ctx.fillRect(x,bottom-s*amounts[i],s,s*amounts[i]);
  }
  ctx.globalAlpha=1;
  Sand.outline(ctx,p.ShapeCells,p,s,ox,oy,boardHeight,'#000000',rim);
  ctx.restore();
  // Label stays inside an occupied cell, including L-shaped containers.
  const c=p.ShapeCells[0],x=ox+(p.x+c.x+.5)*s,y=oy+(boardHeight-p.y-c.y-.5)*s;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='white';ctx.font='bold '+Math.max(9,s*.23)+'px system-ui';
  ctx.fillText(String(Math.max(0,p.Capacity-p.filled)),x,y-2);
  ctx.fillStyle='#b9cadb';ctx.font=Math.max(7,s*.14)+'px system-ui';
  ctx.fillText('剩余容量',x,y+s*.23);
  const marker=p.FrozenCount>0?'冰 '+p.FrozenCount:p.Lock?.Count>0?'锁'+p.Lock.Type+'·'+p.Lock.Count:p.TableClothCount>0?'布 '+p.TableClothCount:p.Key?.Type>0?'钥匙 '+p.Key.Type:p.LockAxis===1?'↔':p.LockAxis===2?'↕':'';
  if(marker){ctx.font='bold '+Math.max(9,s*.18)+'px system-ui';ctx.fillStyle='#ffffff';ctx.fillText(marker,x,y-s*.27);}
  const remainingLayers=state.board?.layers.filter(l=>l.MainPitId===p.Id&&l.Order>p.layer).length||0;
  if(remainingLayers){ctx.font=Math.max(8,s*.15)+'px system-ui';ctx.fillStyle='#ffe5a8';ctx.fillText('+'+remainingLayers+'层',x,y+s*.4);}
  ctx.textBaseline='alphabetic';
}
