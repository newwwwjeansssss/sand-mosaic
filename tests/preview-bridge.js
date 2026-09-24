// Browser-only test fixture. Never writes files; production index.html does not load this.
(() => {
  const memory=new Map();
  window.pywebview={api:{files:{
    read_text:async path=>({ok:true,data:{content:memory.has(path)?memory.get(path):await fetch(path).then(r=>r.text())}}),
    list_dir:async directory=>({ok:true,data:{entries:(await fetch('/api/levels').then(r=>r.json())).entries.filter(e=>e.path.startsWith(directory+'/'))}}),
    write_text:async(path,text)=>{memory.set(path,text);return {ok:true,data:{}};},
    delete:async path=>{memory.delete(path);return {ok:true,data:{}};},
    mkdir:async()=>({ok:true,data:{}}),
    write_base64:async()=>({ok:false,error:{code:'TEST_ONLY',message:'界面测试不写入图片'}})
  }}};
  window.addEventListener('load',()=>window.dispatchEvent(new Event('pywebviewready')),{once:true});
})();
