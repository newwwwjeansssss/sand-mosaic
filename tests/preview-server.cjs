const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Development-only HTTP fixture for browser regression tests.
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'};
http.createServer((req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400); res.end('Bad request'); return; }
  if(pathname==='/api/levels'){
    import('../levellist.js').then(({scanLevelFiles})=>scanLevelFiles(async directory=>({entries:(await fs.promises.readdir(path.join(root,directory),{withFileTypes:true})).map(e=>({name:e.name,type:e.isFile()?'file':'directory'}))}))).then(entries=>{
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({entries}));
    }).catch(error=>{res.writeHead(500,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:error.message}));});return;  }
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file,(error,data) => {
    if(error){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  });
}).listen(Number(process.env.PORT)||8765,'127.0.0.1',()=>console.log('Sand Mosaic: http://127.0.0.1:'+(Number(process.env.PORT)||8765)+'/'));
