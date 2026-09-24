import {filterLevels,sequenceOf} from './level-collections.js';
import {drawLevel,calculateDifficulty} from '../../gamelogic.js';
export function createComparison({state,onSelect,reference=()=>'competitor',onReference=()=>{}}){
 const dialog=document.createElement('dialog');dialog.className='comparison-dialog';dialog.id='comparison-dialog';
 dialog.innerHTML='<div class="comparison-head"><div><h2>原创与竞品 · 同关对照</h2><p>编号按各自主线顺序排列。难度为配置估算，不代表失败率。</p></div><button id="close-comparison">关闭</button></div><label>参考竞品 <select id="comparison-reference" aria-label="参考竞品"><option value="competitor">竞品1</option><option value="competitor2">竞品2 · ColorSand</option></select></label><label>对照关卡 <select id="comparison-sequence" aria-label="对照关卡"></select></label><div class="comparison-boards"><section><h3 id="compare-ours-title"></h3><canvas id="compare-ours"></canvas><p id="compare-ours-info"></p><button id="open-ours">在编辑器打开我们的关卡</button></section><section><h3 id="compare-competitor-title"></h3><canvas id="compare-competitor"></canvas><p id="compare-competitor-info"></p><button id="open-competitor">在编辑器打开竞品关卡</button></section></div><h3>前 50 关难度曲线 <span class="ours-key">━ 我们</span> <span class="competitor-key">━ 竞品</span></h3><canvas id="comparison-curve" width="1000" height="230" aria-label="两套关卡前50关难度曲线"></canvas>';
 document.body.append(dialog);const $=s=>dialog.querySelector(s);let pair=[];
 $('#close-comparison').onclick=()=>dialog.close();$('#comparison-sequence').onchange=render;$('#comparison-reference').onchange=()=>{onReference($('#comparison-reference').value);render();};
 ['ours','competitor'].forEach((kind,i)=>$('#open-'+kind).onclick=()=>{if(pair[i]){dialog.close();onSelect(pair[i]);}});
 function render(){const {store,catalog}=state(),n=+$('#comparison-sequence').value;
  pair=['ours',$('#comparison-reference').value].map(kind=>filterLevels(store.levels,catalog,kind).find(r=>sequenceOf(r.data,catalog)===n));
  ['ours','competitor'].forEach((kind,i)=>{const r=pair[i],canvas=$('#compare-'+kind);canvas.width=store.config.canvas.width;canvas.height=store.config.canvas.height;
   $('#compare-'+kind+'-title').textContent=(i?($('#comparison-reference').value==='competitor2'?'竞品2':'竞品1'):'我们')+' · 第 '+n+' 关';$('#open-'+kind).disabled=!r;
   if(!r){canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);$('#compare-'+kind+'-info').textContent='此关卡尚未制作';return;}
   drawLevel(canvas.getContext('2d'),r.data,{assets:store.assets,grid:true,sandLabels:false});
   const score=calculateDifficulty(r.data,store.assets,store.config);$('#compare-'+kind+'-info').textContent=`${r.data.m_Name} · 难度 ${score.score??'—'} · ${r.data.m_time} 秒\n${r.data.editorMeta?.intent||'竞品参考关卡'}`;
  });drawCurve(store,catalog,n);
 }
 function drawCurve(store,catalog,selected){const canvas=$('#comparison-curve'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,left=40,top=15,bottom=h-28,x=n=>left+(n-1)*(w-left-20)/49,y=v=>bottom-(v-1)*(bottom-top)/9;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#121b2a';ctx.fillRect(0,0,w,h);ctx.font='12px sans-serif';
  for(const value of [1,3,5,7,10]){ctx.strokeStyle='#344052';ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(w-15,y(value));ctx.stroke();ctx.fillStyle='#b5c3d6';ctx.fillText(value,15,y(value)+4);}
  for(const n of [1,8,16,26,40,50]){ctx.fillStyle='#b5c3d6';ctx.fillText(n,x(n)-5,h-8);}
  ['ours',$('#comparison-reference').value].forEach((kind,i)=>{ctx.strokeStyle=i?'#ffbe73':'#55dec1';ctx.lineWidth=2.5;ctx.beginPath();let previous=0;
   for(const r of filterLevels(store.levels,catalog,kind)){const n=sequenceOf(r.data,catalog);if(n>50)continue;const score=calculateDifficulty(r.data,store.assets,store.config).score;if(score===null)continue;if(n===previous+1&&previous)ctx.lineTo(x(n),y(score));else ctx.moveTo(x(n),y(score));previous=n;}ctx.stroke();
  });if(selected<=50){ctx.strokeStyle='#ffffff70';ctx.setLineDash([4,5]);ctx.beginPath();ctx.moveTo(x(selected),top);ctx.lineTo(x(selected),bottom);ctx.stroke();ctx.setLineDash([]);}
 }
 return {open(){$('#comparison-reference').value=reference();const {store,catalog}=state(),numbers=[...new Set(filterLevels(store.levels,catalog,'ours').map(r=>sequenceOf(r.data,catalog)))].sort((a,b)=>a-b);$('#comparison-sequence').replaceChildren();for(const n of numbers){const option=document.createElement('option');option.value=n;option.textContent='第 '+n+' 关';$('#comparison-sequence').append(option);}$('#comparison-sequence').value=String(numbers.includes(sequenceOf(store.current.data,catalog))?sequenceOf(store.current.data,catalog):numbers[0]);render();dialog.showModal();}};
}
