/* GrainRuns decoding ported from Unity SandMosaic/Core/SandGrid.cs. */
(function(root){
  function decode(def){
    const r=def.ResolutionPerCell;
    const width=Math.max(...def.ShapeCells.map(p=>p.x+1))*r;
    const height=Math.max(...def.ShapeCells.map(p=>p.y+1))*r;
    const cells=new Int8Array(width*height).fill(-2);
    for(const p of def.ShapeCells) for(let y=0;y<r;y++) for(let x=0;x<r;x++) cells[(p.y*r+y)*width+p.x*r+x]=-1;
    let count=0;
    for(const value of def.GrainRuns||[]){
      const v=value>>>0,cx=v&63,cy=(v>>>6)&63,y=(v>>>12)&31,x=(v>>>17)&31,length=((v>>>22)&31)+1,color=(v>>>27)&15;
      if(x+length>r||y>=r) throw Error('Invalid grain run');
      for(let n=0;n<length;n++){
        const gx=cx*r+x+n,gy=cy*r+y,i=gy*width+gx;
        if(gx>=width||gy>=height||cells[i]!==-1) throw Error('Overlapping or out of bounds grain');
        cells[i]=color;count++;
      }
    }
    // Legacy point encoding, used by untouched source level 163.
    for(const grain of def.GrainFills||[]){
      const x=grain.ShapeCell.x*r+grain.GrainCellPosition.x,y=grain.ShapeCell.y*r+grain.GrainCellPosition.y,i=y*width+x;
      if(x<0||y<0||x>=width||y>=height||cells[i]===-2)throw Error('Invalid legacy grain position');
      if(cells[i]>=0){if(cells[i]!==grain.Color)throw Error('Conflicting legacy grain');continue;}
      cells[i]=grain.Color;count++;
    }
    const grid={width,height,cells,count,resolution:r,definition:def,blocked:new Uint8Array(cells.length),glass:(def.GlassBlockers||[]).map(g=>g.Count),rocks:(def.RockBlockers||[]).map(g=>g.Health)};
    rebuild(grid);return grid;
  }
  function at(g,x,y){return x<0||y<0||x>=g.width||y>=g.height?-2:g.blocked[y*g.width+x]?-3:g.cells[y*g.width+x];}
  function rebuild(g){
    g.blocked.fill(0);const r=g.resolution;
    for(let i=0;i<g.glass.length;i++)if(g.glass[i]>0){const b=g.definition.GlassBlockers[i];for(const c of b.ShapeCells)for(let y=0;y<r;y++)for(let x=0;x<r;x++){const gx=(b.Anchor.x+c.x)*r+x,gy=(b.Anchor.y+c.y)*r+y;if(gx>=0&&gy>=0&&gx<g.width&&gy<g.height)g.blocked[gy*g.width+gx]=1;}}
    for(let i=0;i<g.rocks.length;i++)if(g.rocks[i]>0){const b=g.definition.RockBlockers[i];for(let n=1;n<b.Points.length;n++){const a=b.Points[n-1],z=b.Points[n],vx=z.x-a.x,vy=z.y-a.y,len=vx*vx+vy*vy;for(let y=0;y<g.height;y++)for(let x=0;x<g.width;x++){const px=(x+.5)/r-.5,py=(y+.5)/r-.5,t=len?Math.max(0,Math.min(1,((px-a.x)*vx+(py-a.y)*vy)/len)):0;const dx=px-a.x-t*vx,dy=py-a.y-t*vy;if(dx*dx+dy*dy<=b.Width*b.Width*.25)g.blocked[y*g.width+x]=1;}}}
  }
  function damage(g){let changed=false;for(const counts of [g.glass,g.rocks])for(let i=0;i<counts.length;i++)if(counts[i]>0){counts[i]--;changed=true;if(counts[i]===0)g.active=true;}if(changed)rebuild(g);}
  function take(g,x,y,color){if(at(g,x,y)!==color)return false;g.cells[y*g.width+x]=-1;g.count--;g.active=true;return true;}
  function put(g,x,y,color){if(at(g,x,y)!==-1)return false;g.cells[y*g.width+x]=color;g.count++;g.active=true;return true;}
  // Shared cell edges are interior and must not be outlined.
  function outline(ctx,cells,a,s,ox,oy,h,color,w=Math.max(2,s*.06)){
    const occupied=new Set(cells.map(c=>c.x+','+c.y)),has=(x,y)=>occupied.has(x+','+y);
    ctx.save();ctx.fillStyle=color;
    for(const c of cells){const x=ox+(a.x+c.x)*s,y=oy+(h-a.y-c.y-1)*s;
      if(!has(c.x-1,c.y))ctx.fillRect(x,y,w,s);
      if(!has(c.x+1,c.y))ctx.fillRect(x+s-w,y,w,s);
      if(!has(c.x,c.y+1))ctx.fillRect(x,y,s,w);
      if(!has(c.x,c.y-1))ctx.fillRect(x,y+s-w,s,w);
    }ctx.restore();
  }
  function paint(ctx,grid,palette,x,y,size){
    const pixel=size/grid.resolution;
    for(let gy=0;gy<grid.height;gy++)for(let gx=0;gx<grid.width;gx++){
      const color=grid.cells[gy*grid.width+gx];
      if(color<0)continue;
      ctx.fillStyle=palette[color];
      ctx.fillRect(x+gx*pixel,y+(grid.height-gy-1)*pixel,pixel+.1,pixel+.1);
      const shade=((gx*13+gy*7)%11)/55;
      ctx.fillStyle='rgba(0,0,0,'+shade+')';
      ctx.fillRect(x+gx*pixel,y+(grid.height-gy-1)*pixel,pixel*.8,pixel*.8);
    }
  }
  function settle(grid){
    const {width:w,height:h,cells:a}=grid;
    let changed=false;
    const read=(x,y)=>at(grid,x,y);
    grid.tick=(grid.tick||0)+1;
    for(let y=1;y<h;y++)for(let n=0;n<w;n++){
      const x=grid.tick%2?w-1-n:n,i=y*w+x;
      if(a[i]<0||grid.blocked[i])continue;
      let dx=0;
      if(read(x,y-1)!==-1){const first=(x*13+y*7+grid.tick)%2?1:-1;if(read(x+first,y-1)===-1)dx=first;else if(read(x-first,y-1)===-1)dx=-first;else continue;}
      a[(y-1)*w+x+dx]=a[i];a[i]=-1;changed=true;
    }
    return changed;
  }
  // Fill occupied rows from the bottom, accounting for irregular shapes.
  function fillAmounts(cells,ratio){
    const rows=new Map();
    for(const c of cells)rows.set(c.y,(rows.get(c.y)||0)+1);
    let remaining=cells.length*Math.max(0,Math.min(1,ratio));
    const amounts=new Map();
    for(const y of [...rows.keys()].sort((a,b)=>a-b)){
      const count=rows.get(y),amount=Math.min(1,remaining/count);
      amounts.set(y,amount);remaining-=amount*count;
    }
    return cells.map(c=>amounts.get(c.y));
  }
  const api={decode,paint,outline,settle,at,rebuild,damage,take,put,fillAmounts};
  if(typeof module!=='undefined')module.exports=api;else root.Sand=api;
})(typeof window==='undefined'?{}:window);
