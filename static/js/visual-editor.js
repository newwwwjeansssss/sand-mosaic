import {shapePresets,transformObject} from '../../phase1-logic.js';
import * as Game from '../../gamelogic.js';
import {entityNames,poolStats,fillPool,reshapeObject,editIssues,nextEntityId} from '../../editor-logic.js';

const labels={Id:'编号',Anchor:'位置',StartPosition:'位置',ShapeCells:'占地形状',Color:'颜色',Capacity:'收沙目标（粒）',LockAxis:'移动限制',FrozenCount:'冻结次数',TableClothCount:'桌布次数',Lock:'锁',Key:'钥匙',Type:'类型',Count:'次数',ClockSeconds:'完成后加时（秒）',HammerCount:'锤子参数',ResolutionPerCell:'每格沙粒分辨率',Health:'耐久',ColorFilter:'触发颜色',HasValue:'启用',m_value:'颜色',Up:'向上长度',Down:'向下长度',Left:'向左长度',Right:'向右长度',ContainerIndex:'关联沙池',Direction:'出口方向',EdgePositionInSimGrid:'出口切向位置（沙粒格）',EdgeNormalPosition:'出口法向位置（棋盘格）',Width:'宽度',GrainRows:'供沙顺序',RowCount:'供沙行数',MainPitId:'关联主盒子',Order:'层序',MemberPitIds:'成员盒子',SharedFrozenCount:'共享冻结次数',SharedTableClothCount:'共享桌布次数',SharedLock:'共享锁',GlassBlockers:'玻璃',RockBlockers:'岩石',Points:'路径点',HiddenPits:'隐藏盒子',HiddenLinkedPits:'隐藏多层',HiddenGluedGroups:'隐藏胶合组',QueuedPits:'出盒顺序',QueuedLinkedPits:'队列多层',Facing:'朝向',MouthWidth:'出口宽度',QueueSlotCount:'队列槽数',x:'X',y:'Y'};
const arrayKinds={HiddenPits:'pits',QueuedPits:'pits',HiddenLinkedPits:'linkedPits',QueuedLinkedPits:'linkedPits',HiddenGluedGroups:'gluedGroups'};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const at=(o,path)=>path.reduce((v,k)=>v[k],o);
export function createVisualEditor(api){
  const host=document.querySelector('#visual-properties'),balance=document.querySelector('#sand-balance');
  let detailNodes=[],lastSelection='';
  function action(fn){return (...args)=>{try{fn(...args);}catch(e){api.error(e);}};}
  function button(text,fn,disabled=false){const b=el('button','editor-button',text);b.type='button';b.disabled=disabled;b.onclick=action(fn);return b;}
  function colors(){return Game.allAssets(Game.assetsForLevel(api.state().store.current.data,api.state().store.assets)).filter(a=>a.type==='color');}
  function update(path,value){api.update(object=>{const parent=at(object,path.slice(0,-1));parent[path.at(-1)]=value;});}
  function reorder(path,index,offset){api.update(root=>{const list=at(root,path);[list[index+offset],list[index]]=[list[index],list[index+offset]];
    if(String(path.at(-1)).endsWith('LinkedPits')){const orders=new Map();for(const layer of list){layer.Order=orders.get(layer.MainPitId)||0;orders.set(layer.MainPitId,layer.Order+1);}}
  });}
  function options(key,path){const {store}=api.state(),d=store.current.data.m_creationData;
    if(key==='Color'||key==='m_value')return colors().map(a=>[a.colorIndex,a.name]);
    if(key==='LockAxis')return [[0,'自由移动'],[1,'仅水平'],[2,'仅垂直']];
    if(key==='Direction')return [[0,'上边'],[1,'下边'],[2,'左边'],[3,'右边']];
    if(key==='HasValue')return [[0,'关闭'],[1,'开启']];
    if(key==='ContainerIndex')return (d.containers||[]).map((p,i)=>[i,'沙池 '+(i+1)]);
    if(key==='MainPitId'){
      const object=Game.selectedObject(store.current.data,store.selected),top=path[0];
      const pits=top==='HiddenLinkedPits'?object.HiddenPits:top==='QueuedLinkedPits'?object.QueuedPits:d.pits;
      return (pits||[]).map(p=>[p.Id,'盒子 #'+p.Id]);
    }return null;
  }
  function field(parent,key,value,path,disabled){
    const label=el('label','visual-field'),title=el('span','',labels[key]||key);label.append(title);
    const choices=options(key,path),input=el(choices?'select':'input','control');
    if(choices){if(!choices.some(([v])=>v===value))choices.push([value,'当前值 '+value+'（未匹配）']);for(const [v,name] of choices){const o=el('option','',name);o.value=v;input.append(o);}}
    else if(typeof value==='number'){input.type='number';input.step='1';if(!['x','y'].includes(key))input.min=key==='Capacity'||key==='Width'||key==='ResolutionPerCell'?1:0;}
    else if(typeof value==='boolean'){input.type='checkbox';input.checked=value;}else input.type='text';
    input.value=value;input.disabled=disabled||key==='Id'||key==='ResolutionPerCell';input.setAttribute('aria-label',labels[key]||key);
    input.onchange=action(()=>{
      const next=typeof value==='number'?Number(input.value):typeof value==='boolean'?input.checked:input.value;
      if(typeof next==='number'&&(!Number.isFinite(next)||!Number.isInteger(next)||input.min!==undefined&&input.min!==''&&next<Number(input.min)))throw Error((labels[key]||key)+' 数值无效');
      update(path,next);
    });label.append(input);parent.append(label);
  }
  function shape(parent,object,path,disabled){
    const panel=el('div','shape-panel'),caption=el('p','help','单击格子增减形状；浅色为可扩展区域。'),canvas=el('canvas','shape-canvas');
    const cells=object.ShapeCells,maxX=Math.max(0,...cells.map(c=>c.x)),maxY=Math.max(0,...cells.map(c=>c.y));
    const cols=Math.min(64,Math.max(5,maxX+2)),rows=Math.min(64,Math.max(4,maxY+2)),size=Math.min(30,260/cols,220/rows);
    canvas.width=Math.ceil(cols*size);canvas.height=Math.ceil(rows*size);canvas.setAttribute('aria-label','形状编辑网格');
    const ctx=canvas.getContext('2d'),filled=new Set(cells.map(c=>c.x+','+c.y));
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){ctx.fillStyle=filled.has(x+','+y)?'#63d6b4':'#263349';ctx.fillRect(x*size+1,(rows-1-y)*size+1,size-2,size-2);}
    const apply=newCells=>{let loss=0;const draft=structuredClone(object);reshapeObject(draft,newCells,{allowLoss:true});if(object.ResolutionPerCell)loss=poolStats(object).total-poolStats(draft).total;
      if(loss&&!confirm('缩小形状将移除 '+loss+' 粒沙子，是否应用？'))return;
      api.update(root=>reshapeObject(at(root,path),newCells,{allowLoss:true}));};
    canvas.onclick=action(event=>{if(disabled)return;const bounds=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-bounds.left)*canvas.width/bounds.width/size),y=rows-1-Math.floor((event.clientY-bounds.top)*canvas.height/bounds.height/size);if(x<0||y<0||x>=cols||y>=rows)return;apply(filled.has(x+','+y)?cells.filter(c=>c.x!==x||c.y!==y):[...cells,{x,y}]);});
    const controls=el('div','visual-row'),width=el('input','control'),height=el('input','control');width.type=height.type='number';width.min=height.min=1;width.max=height.max=64;width.value=maxX+1;height.value=maxY+1;width.disabled=height.disabled=disabled;
    width.setAttribute('aria-label','矩形宽度');height.setAttribute('aria-label','矩形高度');
    controls.append(width,el('span','','×'),height,button('设为矩形',()=>{const w=+width.value,h=+height.value;if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>64||h>64)throw Error('宽高须为 1–64 的整数');apply(Array.from({length:w*h},(_,i)=>({x:i%w,y:Math.floor(i/w)})));},disabled));
    const presets=el('div','visual-actions');
    for(const [name,cells] of Object.entries(shapePresets))presets.append(button(name,()=>apply(structuredClone(cells)),disabled));
    const transforms=el('div','visual-actions');for(const [op,title] of [['rotate','旋转 90°'],['mirror','左右镜像'],['flip','上下镜像']])transforms.append(button(title,()=>api.update(root=>transformObject(at(root,path),op)),disabled));
    panel.append(caption,presets,canvas,controls,transforms);
    if(object.Capacity!==undefined){const row=el('div','visual-row'),amount=el('input','control');amount.type='number';amount.min='1';amount.step='1';amount.value=api.state().store.config.defaults.resolution**2;amount.disabled=disabled;amount.setAttribute('aria-label','每格容量');row.append(amount,button('按每格计算容量',()=>{const n=Number(amount.value);if(!Number.isInteger(n)||n<=0)throw Error('每格容量必须是正整数');api.update(root=>{at(root,path).Capacity=new Set(object.ShapeCells.map(c=>c.x+','+c.y)).size*n;});},disabled));panel.append(el('p','help','容量独立于形状；需要时按每格容量重新计算。'),row);}
    parent.append(panel);
  }
  function newItem(key){const {store}=api.state();const preset=arrayKinds[key]?Game.allAssets(store.assets).find(a=>a.type==='preset'&&a.kind===arrayKinds[key]):null;
    if(preset){const result=structuredClone(preset.defaults);if('Id'in result)result.Id=nextEntityId(store.current.data);return result;}
    const color=colors()[0]?.colorIndex||0;
    if(key==='GrainRows')return {Color:color,RowCount:1};
    if(key==='GlassBlockers')return {Anchor:{x:0,y:0},ShapeCells:[{x:0,y:0}],Count:1};
    if(key==='RockBlockers')return {Points:[{x:0,y:0}],Width:1,Health:1};
    if(key==='Points')return {x:0,y:0};return null;
  }
  function form(parent,object,path,disabled,depth=0,visibleKeys=null){
    for(const [key,value] of Object.entries(object)){
      if(visibleKeys&&!visibleKeys.has(key))continue;
      if(['GrainRuns','GrainFills'].includes(key)||value===null)continue;
      const next=[...path,key];
      if(key==='ShapeCells'){shape(parent,object,path,disabled);continue;}
      if(key==='MemberPitIds'){
        const group=el('fieldset','visual-group'),legend=el('legend','',labels[key]);group.append(legend);
        const root=Game.selectedObject(api.state().store.current.data,api.state().store.selected),pits=path[0]==='HiddenGluedGroups'?root.HiddenPits:api.state().store.current.data.m_creationData.pits;
        for(const pit of pits||[]){const label=el('label','member-option'),check=el('input');check.type='checkbox';check.checked=value.includes(pit.Id);check.disabled=disabled;check.onchange=action(()=>update(next,check.checked?[...value,pit.Id]:value.filter(id=>id!==pit.Id)));label.append(check,el('span','','盒子 #'+pit.Id));group.append(label);}parent.append(group);continue;
      }
      if(Array.isArray(value)){
        const details=el('details','visual-group'),summary=el('summary','',(labels[key]||key)+' · '+value.length);details.dataset.path=next.join('.');detailNodes.push(details);details.append(summary);
        value.forEach((item,index)=>{const card=el('div','sequence-card'),head=el('div','sequence-head');head.append(el('strong','','第 '+(index+1)+' 项'));
          head.append(button('↑',()=>reorder(next,index,-1),disabled||index===0),button('↓',()=>reorder(next,index,1),disabled||index===value.length-1),button('删除',()=>{
            if(!confirm('删除此项及其关联层级？可撤销。'))return;
            api.update(root=>{const owner=at(root,path),list=owner[key],removed=list[index];list.splice(index,1);
              if(key==='HiddenPits'||key==='QueuedPits'){const layerKey=key==='HiddenPits'?'HiddenLinkedPits':'QueuedLinkedPits';owner[layerKey]=(owner[layerKey]||[]).filter(v=>v.MainPitId!==removed.Id);if(owner.HiddenGluedGroups)owner.HiddenGluedGroups=owner.HiddenGluedGroups.map(g=>({...g,MemberPitIds:g.MemberPitIds.filter(id=>id!==removed.Id)})).filter(g=>g.MemberPitIds.length>1);}
            });
          },disabled));card.append(head);if(item&&typeof item==='object')form(card,item,[...next,index],disabled,depth+1);else field(card,String(index),item,[...next,index],disabled);details.append(card);});
        if(newItem(key)!==null)details.append(button('＋ 添加'+(labels[key]||key),()=>api.update(root=>at(root,next).push(newItem(key))),disabled));
        parent.append(details);continue;
      }
      if(typeof value==='object'){const group=el('fieldset','visual-group');group.append(el('legend','',labels[key]||key));form(group,value,next,disabled,depth+1);parent.append(group);}
      else field(parent,key,value,next,disabled);
    }
  }
  function sandPanel(parent,object,disabled){
    const stats=poolStats(object),section=el('section','fill-panel');section.append(el('h4','','沙量配置'));
    const metrics=el('div','pool-metrics');for(const [label,n] of [['实际粒数',stats.total],['最大粒数',stats.maximum],['填充率',(stats.total/Math.max(1,stats.maximum)*100).toFixed(1)+'%']]){const card=el('div');card.append(el('strong','',String(n)),el('small','',label));metrics.append(card);}section.append(metrics);
    section.append(el('p','help','逐色输入数量，预览后应用。分层从池底向上排列；填充会替换当前沙子。'));
    const extra=el('details','extra-colors');extra.dataset.path='fill-colors';detailNodes.push(extra);extra.append(el('summary','','添加其他颜色'));
    const amounts=[];for(const color of colors()){const row=el('label','fill-color'),swatch=el('i','color-swatch'),input=el('input','control');swatch.style.background=color.color;input.type='number';input.min=0;input.step=1;input.value=stats.colors.get(color.colorIndex)||0;input.disabled=disabled;input.setAttribute('aria-label',color.name+'填充数量');row.append(swatch,el('span','',color.name),input);(stats.colors.has(color.colorIndex)||color.id===api.state().store.selectedAssetId?section:extra).append(row);amounts.push({color:color.colorIndex,input});}section.append(extra);
    const select=el('select','control');for(const [value,title] of [['layers','分层排列'],['mixed','混合排列']]){const o=el('option','',title);o.value=value;select.append(o);}select.disabled=disabled;select.setAttribute('aria-label','沙粒排列');section.append(select);
    const preview=el('canvas','fill-preview');preview.width=240;preview.height=150;preview.hidden=true;const message=el('p','help');let proposed=null;
    const applyButton=button('应用预览',()=>{if(!proposed)throw Error('请先预览填充');const value=proposed;api.update(root=>{root.GrainRuns=value.GrainRuns;root.GrainFills=value.GrainFills;});},true);
    const invalidate=()=>{proposed=null;preview.hidden=true;applyButton.disabled=true;message.textContent='数量已修改，请重新预览';};for(const a of amounts)a.input.oninput=invalidate;select.onchange=invalidate;
    const previewFill=()=>{proposed=null;applyButton.disabled=true;const draft=structuredClone(object);const count=fillPool(draft,amounts.map(a=>({color:a.color,count:+a.input.value})),select.value||'layers');const g=globalThis.Sand.decode(draft),ctx=preview.getContext('2d');ctx.clearRect(0,0,preview.width,preview.height);const scale=Math.min(240/(g.width/g.resolution),150/(g.height/g.resolution));globalThis.Sand.paint(ctx,g,Game.palette(api.state().store.assets,api.state().store.current.data),0,0,scale);preview.hidden=false;proposed=draft;applyButton.disabled=disabled;message.textContent='预览共 '+count+' 粒 / 可填 '+stats.available+' 粒';};
    const buttons=el('div','visual-actions');buttons.append(button('预览填充',previewFill,disabled),applyButton,button('选中色填满',()=>{const asset=Game.allAssets(Game.assetsForLevel(api.state().store.current.data,api.state().store.assets)).find(a=>a.id===api.state().store.selectedAssetId);if(asset?.type!=='color')throw Error('请先在左侧资源库选中颜色');for(const a of amounts)a.input.value=a.color===asset.colorIndex?stats.available:0;previewFill();},disabled),button('清空沙子',()=>{if(confirm('清空这个沙池的全部沙子？可撤销。'))api.update(root=>fillPool(root,[]));},disabled));section.append(buttons,message,preview);parent.append(section);
  }
  function render(){
    const {store,editable}=api.state();if(!store)return;
    const selected=store.selected,selectionKey=store.current.data.id+':'+selected?.kind+':'+selected?.index;
    const openPaths=new Set(lastSelection===selectionKey?detailNodes.filter(n=>n.open).map(n=>n.dataset.path):[]);lastSelection=selectionKey;detailNodes=[];
    host.replaceChildren();const object=Game.selectedObject(store.current.data,selected);
    if(!object){host.append(el('div','inspector-empty','点击画布中的沙池或盒子，编辑其形状、颜色和数量。机关也可从上方列表选取。'));}
    else{
      host.append(el('div','selection-heading',entityNames[selected.kind]+' '+(selected.index+1)));
      if(!editable)host.append(el('p','help','进入编辑模式后可修改属性。'));
      if(selected.kind==='containers')sandPanel(host,object,!editable);
      if(['pits','containers','wall'].includes(selected.kind)){
        const keys=new Set(['Id','Anchor','StartPosition','ShapeCells','Color','Capacity','LockAxis','ResolutionPerCell']);
        form(host,object,[],!editable,0,keys);
        const advanced=Object.fromEntries(Object.entries(object).filter(([k])=>!keys.has(k)&&!['GrainRuns','GrainFills'].includes(k)));
        if(Object.keys(advanced).length){const detail=el('details','visual-group');detail.dataset.path='advanced-properties';detailNodes.push(detail);detail.append(el('summary','','高级机关参数'));form(detail,advanced,[],!editable);host.append(detail);}
      }else form(host,object,[],!editable);
      for(const details of detailNodes)details.open=openPaths.has(details.dataset.path);
    }
    balance.replaceChildren();const result=editIssues(store.current.data),table=el('table','balance-table'),head=el('tr');for(const title of ['颜色','供应','目标','差额'])head.append(el('th','',title));table.append(head);
    for(const row of result.balance){const tr=el('tr',row.difference<0?'shortage':''),name=el('td'),swatch=el('i','color-swatch');swatch.style.background=Game.palette(store.assets,store.current.data)[row.color];name.append(swatch,el('span','',' '+row.color));tr.append(name,...[row.supply,row.required,(row.difference>0?'+':'')+row.difference].map(n=>el('td','',String(n))));table.append(tr);}balance.append(table);
    for(const issue of result.issues)balance.append(el('p','issue-message',issue));
    balance.append(el('p','help','供应含池内与管道沙量；目标含多层、隐藏及队列盒子。数值充足不代表一定可通关。'));
  }
  return {render};
}
