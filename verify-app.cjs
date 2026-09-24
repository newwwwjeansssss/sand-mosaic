// DOM/Canvas contract smoke test, not a substitute for a browser playthrough.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),Board=require('./board.js'),Sand=require('./sand.js');
const elements=new Map(),handlers={};let draws=0;
const context=new Proxy({}, {get:(o,k)=>k in o?o[k]:(...args)=>{if(['fillRect','strokeRect','moveTo','lineTo','rect','clearRect','arc'].includes(k)){assert.ok(args.every(Number.isFinite),k+' has invalid coordinates');draws++;}}});
const element=key=>{if(!elements.has(key))elements.set(key,{value:'',style:{},dataset:{},children:[],classList:{toggle(){}},appendChild(v){this.children.push(v);},replaceChildren(){this.children=[];}});return elements.get(key);};
const canvas={width:720,height:720,getContext:()=>context,addEventListener:(k,f)=>handlers[k]=f,setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0,width:720,height:720})};
const env={Sand,SandBoard:Board,document:{querySelector:k=>k==='#board'?canvas:element(k),querySelectorAll:()=>element('#levelList').children,createElement:()=>({dataset:{},classList:{toggle(){}}}),addEventListener(){}},performance:{now:()=>1000},fetch:async url=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(url))}),requestAnimationFrame(){},setTimeout(){},clearTimeout(){},console};
vm.createContext(env);vm.runInContext(fs.readFileSync('container-view.js','utf8'),env);vm.runInContext(fs.readFileSync('app.js','utf8'),env);
setImmediate(async()=>{try{
  assert.equal(vm.runInContext('state.data.id',env),58);assert.equal(element('#levelList').children.length,550);
  vm.runInContext("state.mode='raw';renderList()",env);assert.equal(element('#levelList').children.length,577);
  for(let id=1;id<=577;id++){
    await vm.runInContext('loadLevel('+id+')',env);
    if(id===8){assert.equal(vm.runInContext('state.board',env),null);assert.match(element('#issues').textContent,/时间/);continue;}
    vm.runInContext('draw();renderInfo()',env);
  }
  vm.runInContext("state.mode='main';state.level=550;next()",env);await new Promise(setImmediate);assert.equal(vm.runInContext('state.mode',env),'loop');assert.equal(vm.runInContext('state.data.id',env),521);
  vm.runInContext("state.mode='raw';state.level=8",env);await vm.runInContext('loadLevel(8)',env);await vm.runInContext('loadLevel(1)',env);assert.equal(vm.runInContext('state.data.id',env),1);
  console.log('PASS: 576 levels Canvas draw contract, ID8 error recovery, 550 mainline / 577 raw list, mainline→loop transition; '+draws+' draw calls');
}catch(e){console.error(e);process.exitCode=1;}});
