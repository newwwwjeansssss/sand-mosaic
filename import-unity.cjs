// Byte-for-byte copy; never serialize or rewrite Unity configuration.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source='D:/sandmosaic/UnityWork',dest=__dirname;
const catalogPath='Assets/Res/SandMosaicSub/Data/Levels/catalog.json';
const bytes=fs.readFileSync(path.join(source,catalogPath)),catalog=JSON.parse(bytes);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest={source,importedAt:new Date().toISOString(),catalogSha256:hash(bytes),files:[]};
fs.mkdirSync(path.join(dest,'levels'),{recursive:true});
for(const entry of catalog.levels){
  const b=fs.readFileSync(path.join(source,entry.path));
  const target='levels/level_'+entry.id+'.json';fs.writeFileSync(path.join(dest,target),b);
  manifest.files.push({id:entry.id,source:entry.path,target,sha256:hash(b)});
}
fs.writeFileSync(path.join(dest,'levels/catalog.json'),bytes);
fs.writeFileSync(path.join(dest,'import-manifest.json'),JSON.stringify(manifest,null,2));
console.log('Copied '+manifest.files.length+' levels; mainline '+catalog.order.length+'; loop '+catalog.loop.length);
