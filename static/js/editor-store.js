import {assignOurMetadata} from './level-collections.js';
import {createBasicLevel,assertLayoutChange} from '../../phase1-logic.js';
import {clone,allAssets,createEmptyLevel,validateLevel,validateAssets,validateConfig,getAssetReferences} from '../../gamelogic.js';
const json=v=>JSON.stringify(v);
export class EditorStore{
  constructor({config,assets,levels,files=null}){this.config=clone(config);this.assets=clone(assets);this.levels=levels.map(r=>({...r,data:clone(r.data)}));this.files=files;this.currentLevelId=this.levels[0]?.data.id;this.selected=null;this.selectedAssetId=allAssets(this.assets)[0]?.id;this.history=[];this.future=[];this.listeners=new Set();this.images=new Map();this.saving=false;this.baseline=new Map(this.levels.map(r=>[r.path,json(r.data)]));this.savedConfig=json(this.config);this.savedAssets=json(this.assets);}
  get current(){return this.levels.find(r=>r.data.id===this.currentLevelId);}
  get dirty(){return this.images.size>0||json(this.config)!==this.savedConfig||json(this.assets)!==this.savedAssets||this.levels.some(r=>json(r.data)!==this.baseline.get(r.path))||[...this.baseline.keys()].some(path=>!this.levels.some(r=>r.path===path));}
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  emit(){for(const f of this.listeners)f();}
  guard(){if(!this.files)throw Error('普通浏览器为只读模式，请使用 start.exe 编辑');if(this.saving)throw Error('正在保存，请稍候');}
  select(id){this.currentLevelId=id;this.selected=null;this.emit();}
  commit(entry){this.history.push(entry);if(this.history.length>50)this.history.shift();this.future=[];this.emit();}
  updateLevel(fn,{checkLayout=false}={}){this.guard();const r=this.current,before=clone(r.data),after=clone(r.data);const selection=clone(this.selected);try{fn(after);if(checkLayout)assertLayoutChange(before,after);}catch(e){this.selected=selection;throw e;}if(after.id!==before.id)throw Error('现有关卡 ID 不能改变，请新建关卡');if(json(before)===json(after))return;r.data=after;this.commit({type:'level',path:r.path,before,after:clone(after)});}
  updateConfig(value){this.guard();const errors=validateConfig(value);if(errors.length)throw Error(errors.join('；'));const before=clone(this.config);this.config=clone(value);this.commit({type:'config',before,after:clone(value)});}
  references(asset){return this.levels.filter(r=>getAssetReferences(r.data,asset,this.assets)).map(r=>r.data.id);}
  updateAsset(originalId,value,image=null){this.guard();const next=clone(this.assets),old=allAssets(this.assets).find(a=>a.id===originalId);
    if(old&&(value.id!==old.id||value.type!==old.type||value.colorIndex!==old.colorIndex||value.kind!==old.kind)&&this.references(old).length)throw Error('被关卡引用的资源不能改变 ID、类型或引用键');
    if(old){const found=allAssets(next).find(a=>a.id===originalId);Object.assign(found,clone(value));}else (next.categories.find(c=>c.id===(value.type==='color'?'colors':'entities'))||next.categories[0]).items.push(clone(value));
    const errors=validateAssets(next);if(errors.length)throw Error(errors.join('；'));
    const before=clone(this.assets),imagesBefore=new Map(this.images);this.assets=next;if(image)this.images.set(value.image,image);
    this.commit({type:'assets',before,after:clone(next),imagesBefore,imagesAfter:new Map(this.images)});
  }
  deleteAsset(id){this.guard();const asset=allAssets(this.assets).find(a=>a.id===id),refs=this.references(asset);if(refs.length)throw Error('资源被 '+refs.length+' 个关卡引用（如 '+refs.slice(0,8).join(',')+'），禁止删除');const before=clone(this.assets);this.assets=clone(this.assets);for(const c of this.assets.categories)c.items=c.items.filter(a=>a.id!==id);this.commit({type:'assets',before,after:clone(this.assets)});}
  addLevel(options=null){this.guard();const previousId=this.currentLevelId;const id=Math.max(0,...this.levels.map(r=>r.data.id),...[...this.baseline.keys()].map(p=>+(p.match(/level-(\d+)/)||[])[1]||0))+1;const data=options?createBasicLevel({id,config:this.config,assets:this.assets,...options}):createEmptyLevel({id,config:this.config,assets:this.assets}),record={path:'our-level/level-'+id+'.json',name:'level-'+id+'.json',data};assignOurMetadata(data,this.levels);this.levels.push(record);this.currentLevelId=id;this.selected=null;this.commit({type:'add',record:clone(record),previousId});}
  deleteLevel(){this.guard();if(this.levels.length<=1)throw Error('至少保留一个关卡');const record=clone(this.current),index=this.levels.indexOf(this.current);this.levels.splice(index,1);this.currentLevelId=(this.levels.find(r=>(r.data.editorMeta?.collection||'competitor')===(record.data.editorMeta?.collection||'competitor'))||this.levels[0]).data.id;this.selected=null;this.commit({type:'delete',record,index});}
  duplicateLevel(){this.guard();const previousId=this.currentLevelId;const id=Math.max(0,...this.levels.map(r=>r.data.id),...[...this.baseline.keys()].map(p=>+(p.match(/level-(\d+)/)||[])[1]||0))+1,data=clone(this.current.data);data.id=id;data.m_Name+=' · 副本';assignOurMetadata(data,this.levels);const record={path:'our-level/level-'+id+'.json',name:'level-'+id+'.json',data};this.levels.push(record);this.currentLevelId=id;this.selected=null;this.commit({type:'add',record:clone(record),previousId});}
  apply(entry,forward){if(entry.type==='level'){const r=this.levels.find(r=>r.path===entry.path);r.data=clone(forward?entry.after:entry.before);this.currentLevelId=r.data.id;}else if(entry.type==='config')this.config=clone(forward?entry.after:entry.before);else if(entry.type==='assets'){this.assets=clone(forward?entry.after:entry.before);const images=forward?entry.imagesAfter:entry.imagesBefore;if(images)this.images=new Map(images);}else if((entry.type==='add')===forward){this.levels.splice(entry.index??this.levels.length,0,clone(entry.record));this.currentLevelId=entry.record.data.id;}else{this.levels=this.levels.filter(r=>r.path!==entry.record.path);this.currentLevelId=(this.levels.find(r=>r.data.id===entry.previousId)||this.levels.find(r=>(r.data.editorMeta?.collection||'competitor')===(entry.record.data.editorMeta?.collection||'competitor'))||this.levels[0])?.data.id;}this.selected=null;this.emit();}
  undo(){this.guard();const e=this.history.pop();if(e){this.future.push(e);this.apply(e,false);}}
  redo(){this.guard();const e=this.future.pop();if(e){this.history.push(e);this.apply(e,true);}}
  async save(){this.guard();this.saving=true;this.emit();try{
    const errors=[...validateConfig(this.config),...validateAssets(this.assets)];if(errors.length)throw Error(errors.join('；'));
    const changed=this.levels.filter(r=>json(r.data)!==this.baseline.get(r.path));for(const r of changed){const e=validateLevel(r.data,this.assets);assertLayoutChange(this.baseline.has(r.path)?JSON.parse(this.baseline.get(r.path)):null,r.data);if(e.length)throw Error(r.name+'：'+e.join('；'));}
    // Removing/re-keying assets is guarded at edit time; validate all color references at save too.
    for(const r of this.levels){const e=validateLevel(r.data,this.assets).filter(s=>s.includes('资源映射')||s.includes('未注册颜色'));if(e.length)throw Error(r.name+'：'+e.join('；'));}
    if(this.images.size){try{await this.files.mkdir('level/asset',true);}catch(e){if(e.code!=='ALREADY_EXISTS')throw e;}for(const [path,image] of this.images){await this.files.writeBase64(path,image,false);this.images.delete(path);}}
    if(json(this.config)!==this.savedConfig){await this.files.writeText('config.json',JSON.stringify(this.config,null,2),true);this.savedConfig=json(this.config);}
    if(json(this.assets)!==this.savedAssets){await this.files.writeText('asset.json',JSON.stringify(this.assets,null,2),true);this.savedAssets=json(this.assets);}
    if(changed.some(r=>r.path.startsWith('our-level/'))){try{await this.files.mkdir('our-level',true);}catch(e){if(e.code!=='ALREADY_EXISTS')throw e;}}
    for(const r of changed){await this.files.writeText(r.path,JSON.stringify(r.data,null,2),this.baseline.has(r.path));this.baseline.set(r.path,json(r.data));}
    for(const path of [...this.baseline.keys()])if(!this.levels.some(r=>r.path===path)){await this.files.remove(path,false);this.baseline.delete(path);}
    this.history=[];this.future=[];
  }finally{this.saving=false;this.emit();}}
}
