/* Behavioral port of Unity SandBoard.cs / SandBoardFeatures.cs.
   Source definitions stay read-only; all counters/positions live on this instance. */
(function(root){
  const S=typeof module!=='undefined'?require('./sand.js'):root.Sand;
  const inside=(cells,a,x,y)=>(cells||[]).some(c=>c.x+(a?.x||0)===x&&c.y+(a?.y||0)===y);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dirs=[[0,-1],[-1,0],[1,0],[0,1]];
  const matches=(f,c)=>!f||!f.HasValue||f.m_value===c;
  // .NET Math.Round defaults to midpoint-to-even.
  const round=v=>{const lo=Math.floor(v);return v-lo===.5?(lo%2===0?lo:lo+1):Math.round(v);};
  class Board{
    constructor(level,rules={},timeLimit=level.m_time){
      this.level=level;this.layout=level.m_creationData;
      if(!this.layout||this.layout.gridSize.x<=0||this.layout.gridSize.y<=0||!Number.isFinite(timeLimit)||timeLimit<=0)throw Error('原配置不满足 Unity 加载条件：棋盘尺寸必须有效，时间必须大于 0');
      this.rules={StepsPerUpdate:4,SettlingDurationSeconds:.02,MaxDrainPerEdgePerTick:16,DrainDepthBoostStart:.75,DrainDepthBoostEnd:1,DrainAllUsePercentCheck:1,DrainAllCompareValue:.99,...rules};
      this.remaining=timeLimit;this.timeLimit=timeLimit;this.started=false;this.won=false;this.accumulator=0;this.completed=0;this.collected=0;
      this.pits=[];this.grids=(this.layout.containers||[]).map(S.decode);
      this.layers=[...(this.layout.linkedPits||[])];this.groups=[...(this.layout.gluedGroups||[])];
      this.garages=(this.layout.garages||[]).map(g=>g.Health);this.grinders=(this.layout.grinders||[]).map(()=>0);
      this.platforms=(this.layout.platformBlockers||[]).map(()=>false);this.dispensers=(this.layout.dispensers||[]).map(()=>0);
      this.pipes=(this.layout.pipes||[]).map(p=>(p.GrainRows||[]).map(r=>r.RowCount*p.Width));
      for(const p of this.layout.pits||[])this.add(p);
      for(const group of this.groups)for(const p of this.pits)if(group.MemberPitIds.includes(p.Id)){
        p.FrozenCount=Math.max(p.FrozenCount,group.SharedFrozenCount||0);p.TableClothCount=Math.max(p.TableClothCount,group.SharedTableClothCount||0);
        if(group.SharedLock?.Count>(p.Lock?.Count||0))p.Lock={...group.SharedLock};
      }
      this.updateFeatures();
    }
    get failed(){return this.started&&this.remaining<=0&&!this.won;}
    add(def){const p={...def,definition:def,x:def.StartPosition.x,y:def.StartPosition.y,color:def.Color,filled:0,done:false,layer:-1,FrozenCount:def.FrozenCount||0,TableClothCount:def.TableClothCount||0,Lock:{Type:0,Count:0,...def.Lock},Key:{Type:0,...def.Key}};this.pits.push(p);return p;}
    covered(p){return this.garages.some((h,i)=>h>0&&p.ShapeCells.some(c=>inside(this.layout.garages[i].ShapeCells,this.layout.garages[i].Anchor,p.x+c.x,p.y+c.y)));}
    movable(p){return p&&!p.done&&p.filled<p.Capacity&&p.FrozenCount<=0&&p.Lock.Count<=0&&!this.covered(p)&&!this.won&&!this.failed;}
    group(p){const g=this.groups.find(g=>g.MemberPitIds.includes(p.Id));return g?[p,...this.pits.filter(a=>a!==p&&!a.done&&g.MemberPitIds.includes(a.Id))]:[p];}
    featureBlocks(p,x,y){
      if(this.garages.some((h,i)=>h>0&&inside(this.layout.garages[i].ShapeCells,this.layout.garages[i].Anchor,x,y)))return true;
      for(let i=0;i<this.grinders.length;i++){const g=this.layout.grinders[i],dx=x-g.Anchor.x,dy=y-g.Anchor.y,n=this.grinders[i];if(dx===0&&dy===0||dx===0&&(dy>0&&dy<=g.Up-n||dy<0&&-dy<=g.Down-n)||dy===0&&(dx>0&&dx<=g.Right-n||dx<0&&-dx<=g.Left-n))return true;}
      return (this.layout.coloredGrids||[]).some(g=>g.Color!==p.color&&inside(g.ShapeCells,g.Anchor,x,y));
    }
    canPlace(p,x,y){
      if(!Number.isInteger(x)||!Number.isInteger(y))return false;
      const group=this.group(p),dx=x-p.x,dy=y-p.y,d=this.layout;
      for(const m of group){
        if(m.FrozenCount>0||m.Lock?.Count>0||m.LockAxis===1&&dy!==0||m.LockAxis===2&&dx!==0)return false;
        for(const c of m.ShapeCells){const gx=m.x+dx+c.x,gy=m.y+dy+c.y;
          if(gx<0||gy<0||gx>=d.gridSize.x||gy>=d.gridSize.y||inside(d.wall?.ShapeCells,null,gx,gy))return false;
          if(this.grids.some(g=>inside(g.definition.ShapeCells,g.definition.Anchor,gx,gy)))return false;
          if(this.pits.some(a=>!a.done&&!group.includes(a)&&inside(a.ShapeCells,a,gx,gy))||this.featureBlocks(m,gx,gy))return false;
        }
      }return true;
    }
    move(p,x,y){
      if(!this.movable(p)||!Number.isFinite(x)||!Number.isFinite(y))return false;
      x=round(clamp(x,-1,this.layout.gridSize.x));y=round(clamp(y,-1,this.layout.gridSize.y));let moved=false;
      for(let n=0;n<this.layout.gridSize.x+this.layout.gridSize.y;n++){
        const dx=p.LockAxis===2?0:Math.sign(x-p.x),dy=p.LockAxis===1?0:Math.sign(y-p.y);if(!dx&&!dy)break;let step=false;
        if(dx&&this.canPlace(p,p.x+dx,p.y)){for(const m of this.group(p))m.x+=dx;step=true;}
        if(dy&&this.canPlace(p,p.x,p.y+dy)){for(const m of this.group(p))m.y+=dy;step=true;}
        if(!step)break;moved=true;
      }this.started||=moved;return moved;
    }
    feed(){
      for(let i=0;i<this.pipes.length;i++){
        const p=this.layout.pipes[i],g=this.grids[p.ContainerIndex],left=this.pipes[i];if(!g||p.Width<=0)continue;
        for(let slot=0;slot<p.Width;slot++){const row=left.findIndex(n=>n>0);if(row<0)break;
          const tangent=p.EdgePositionInSimGrid-Math.trunc(p.Width/2)+slot,r=g.resolution,normal=p.EdgeNormalPosition*r;
          const x=p.Direction<2?tangent:p.Direction===2?normal:normal+r-1,y=p.Direction<2?(p.Direction===0?normal+r-1:normal):tangent;
          if(S.put(g,x,y,p.GrainRows[row].Color))left[row]--;
        }
      }
    }
    fallback(g){const d=this.layout;return g.definition.ShapeCells.every(c=>{
      const x=g.definition.Anchor.x+c.x,y=g.definition.Anchor.y+c.y-1;
      return x<0||y<0||x>=d.gridSize.x||y>=d.gridSize.y||inside(d.wall?.ShapeCells,null,x,y)||this.grids.some(a=>inside(a.definition.ShapeCells,a.definition.Anchor,x,y));
    });}
    candidates(p,g,c,dx,dy,depth,fallback,all){
      const out=[],r=g.resolution,origin=(dx===0?c.x:c.y)*r,tangent=dx===0?g.width:g.height,normal=dx===0?g.height:g.width;
      const nearest=new Float64Array(tangent).fill(Infinity);
      for(let dist=0;dist<normal;dist++){
        if((fallback||!all)&&dist>=r)break;
        if(!fallback&&(dx>0||dy>0?dist>depth-1:dist>=depth))break;
        let left=Math.max(-origin,-dist-1),right=Math.min(tangent-origin,r+dist+1);
        if(fallback){left=Math.max(left,-r);right=Math.min(right,2*r);}
        for(let row=-origin;row<tangent-origin;row++){
          const x=c.x*r+(dx<0?dist:dx>0?r-1-dist:row),y=c.y*r+(dy<0?dist:dy>0?r-1-dist:row),color=S.at(g,x,y),idx=origin+row;
          if(color===-3){nearest[idx]=-Infinity;continue;}if(color<0||nearest[idx]===-Infinity)continue;
          if(fallback){if(nearest[idx]<dist)continue;nearest[idx]=dist;}
          if(row>=left&&row<right&&color===p.color)out.push([x,y]);
        }
      }return out;
    }
    drain(){
      for(const p of this.pits){
        if(p.done||p.FrozenCount>0||p.Lock.Count>0||p.TableClothCount>0||this.covered(p))continue;
        for(const g of this.grids)for(const c of g.definition.ShapeCells)for(const [dx,dy] of dirs){
          if(inside(g.definition.ShapeCells,null,c.x+dx,c.y+dy))continue;
          const cx=g.definition.Anchor.x+c.x,cy=g.definition.Anchor.y+c.y;
          for(const part of p.ShapeCells){
            if(inside(p.ShapeCells,null,part.x-dx,part.y-dy)||p.x+part.x!==cx+dx||p.y+part.y!==cy+dy)continue;
            const fill=p.filled/Math.max(1,p.Capacity),r=this.rules,b=clamp((fill-r.DrainDepthBoostStart)/Math.max(.01,r.DrainDepthBoostEnd-r.DrainDepthBoostStart),0,1),depth=6*(1+2*b*b*(3-2*b));
            const all=r.DrainAllUsePercentCheck!==0?fill>=r.DrainAllCompareValue:p.Capacity-p.filled<=r.DrainAllCompareValue;
            let candidates=this.candidates(p,g,c,dx,dy,all?999:depth,false,all);
            if(!candidates.length&&this.fallback(g))candidates=this.candidates(p,g,c,dx,dy,999,true,false);
            let removed=0;
            for(const [x,y] of candidates){if(removed>=r.MaxDrainPerEdgePerTick||p.filled>=p.Capacity)break;if(S.take(g,x,y,p.color)){p.filled++;this.collected++;removed++;}}
          }
        }
        if(p.filled>=p.Capacity)this.finish(p);
      }
      this.updateFeatures();this.won=this.pits.length>0&&this.pits.every(p=>p.done)&&!this.pending();
    }
    finish(p){
      for(const g of this.grids)S.damage(g);
      for(const a of this.pits){if(a.FrozenCount>0)a.FrozenCount--;if(a.TableClothCount>0)a.TableClothCount--;if(p.Key.Type>0&&a.Lock.Type===p.Key.Type&&a.Lock.Count>0)a.Lock.Count--;}
      for(let i=0;i<this.garages.length;i++)if(this.garages[i]>0&&matches(this.layout.garages[i].ColorFilter,p.color))this.garages[i]--;
      for(let i=0;i<this.grinders.length;i++)if(matches(this.layout.grinders[i].ColorFilter,p.color))this.grinders[i]++;
      this.remaining+=Math.max(0,p.definition.ClockSeconds||0);
      const next=this.layers.filter(l=>l.MainPitId===p.Id&&l.Order>p.layer).sort((a,b)=>a.Order-b.Order)[0];
      if(next){p.layer=next.Order;p.color=next.Color;p.Capacity=next.Capacity;p.filled=0;p.FrozenCount=next.FrozenCount||0;p.Lock={Type:0,Count:0,...next.Lock};p.Key={Type:0,...next.Key};p.LockAxis=next.LockAxis;return;}
      p.done=true;this.completed++;
    }
    updateFeatures(){
      for(let i=0;i<this.platforms.length;i++)if(!this.platforms[i]){
        const a=this.layout.platformBlockers[i];if(this.pits.some(p=>!p.done&&p.ShapeCells.some(c=>inside(a.ShapeCells,a.Anchor,p.x+c.x,p.y+c.y))))continue;
        this.platforms[i]=true;for(const p of a.HiddenPits||[])this.add(p);this.layers.push(...a.HiddenLinkedPits||[]);this.groups.push(...a.HiddenGluedGroups||[]);
      }
      for(let i=0;i<this.dispensers.length;i++){
        const a=this.layout.dispensers[i],index=this.dispensers[i],def=(a.QueuedPits||[])[index];if(!def)continue;
        const p={Id:def.Id,x:def.StartPosition.x,y:def.StartPosition.y,color:def.Color,LockAxis:def.LockAxis,ShapeCells:def.ShapeCells,FrozenCount:0,Lock:{Count:0}};
        const minX=Math.min(0,...p.ShapeCells.map(c=>p.x+c.x)),minY=Math.min(0,...p.ShapeCells.map(c=>p.y+c.y));p.x-=minX;p.y-=minY;
        if(!this.canPlace(p,p.x,p.y))continue;const spawned=this.add(def);spawned.x=p.x;spawned.y=p.y;this.dispensers[i]++;if(index===0)this.layers.push(...a.QueuedLinkedPits||[]);
      }
    }
    pending(){return this.platforms.some(v=>!v)||this.dispensers.some((v,i)=>v<(this.layout.dispensers[i].QueuedPits||[]).length);}
    advance(delta){
      if(this.won||this.failed||!this.started||delta<=0)return;
      this.remaining=Math.max(0,this.remaining-delta);this.accumulator+=Math.min(delta,.1);
      const interval=Math.max(.005,this.rules.SettlingDurationSeconds);
      while(this.accumulator>=interval){this.accumulator-=interval;for(let i=0;i<this.rules.StepsPerUpdate;i++){this.feed();for(const g of this.grids)if(g.active)g.active=S.settle(g);}this.drain();}
    }
  }
  if(typeof module!=='undefined')module.exports=Board;else root.SandBoard=Board;
})(typeof window==='undefined'?{}:window);
