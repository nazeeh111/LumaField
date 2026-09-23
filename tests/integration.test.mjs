// Production main.js is evaluated with minimal browser surfaces. The worker,
// parser, buffers and message transfer are real; this does not test WebGL pixels.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import { createWorker } from '../worker.js';
const root=new URL('../',import.meta.url);
async function boot(query='', libraryFixtures=false) {
const requests=[];
const nodes=new Map(),events={},focal=[];
function node(id){if(!nodes.has(id))nodes.set(id,{id,style:{},hidden:false,textContent:'',innerText:'',value:'',files:[],clientWidth:1000,clientHeight:750,addEventListener(n,f){events[`${id}:${n}`]=f;},setAttribute(){},closest(){return null},click(){}});return nodes.get(id)}
const canvas=node('canvas');const gl=new Proxy({canvas,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_p,key)=>key,uniform2fv:(key,v)=>{if(key==='focal')focal.push([...v]);}}, {get:(t,k)=>k in t?t[k]:(()=>({}))});canvas.getContext=()=>gl;
let instance;class FakeWorker{constructor(){instance=this;this.out=[];this.scope={postMessage:(m,transfer=[])=>this.out.push(structuredClone(m,{transfer}))};createWorker(this.scope)}postMessage(data,transfer=[]){this.scope.onmessage({data:structuredClone(data,{transfer})})}flush(){while(this.out.length)this.onmessage({data:this.out.shift()})}terminate(){}}
let resolveFetch;const fetching=new Promise(r=>resolveFetch=r);
const context={...core,Worker:FakeWorker,console,Float32Array,Uint8Array,ArrayBuffer,Blob,URL,URLSearchParams,TextDecoder,AbortController,Math,Date,Number,JSON,performance,devicePixelRatio:1,location:new URL('http://local/LumaField/'+query),history:{replaceState(_state,_title,url){context.location=new URL(url);}},navigator:{getGamepads:()=>[]},requestAnimationFrame(){},setTimeout,fetch:url=>{requests.push(String(url));if(!libraryFixtures)return fetching;const relative=new URL(url).pathname.replace('/LumaField/','');return Promise.resolve(new Response(fs.readFileSync(new URL(relative,root))));},document:{getElementById:node,createElement:()=>node('created'),addEventListener:(n,f)=>events[n]=f,body:{classList:{add(){},remove(){}}}},window:{addEventListener:(n,f)=>events[`window:${n}`]=f}};
vm.createContext(context);
let code=fs.readFileSync(new URL('main.js',root),'utf8').replace(/^import .*?;\n/,'').replaceAll('import.meta.url',JSON.stringify('http://local/LumaField/main.js'));
vm.runInContext(code,context);
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
function splat(x=0){const b=new ArrayBuffer(32);new Float32Array(b).set([x,0,0,.05,.05,.05]);new Uint8Array(b).set([200,180,150,255,255,128,128,128],24);return b}
const change=file=>node('file-input').onchange({target:{files:[file],value:''}});
const camera=(x,fx=800)=>({position:[x,0,-5],rotation:[[1,0,0],[0,1,0],[0,0,1]],fx,fy:fx});
resolveFetch(new Response(splat()));await settle();instance.flush();await settle();instance.flush();assert.equal(node('scene-name').textContent,libraryFixtures&&query.includes('scene=houseplant')?'Houseplant':'Meridian Pavilion');

return {node,change,camera,context,instance,settle,focal,requests};
}

function splat(x=0){const b=new ArrayBuffer(32);new Float32Array(b).set([x,0,0,.05,.05,.05]);new Uint8Array(b).set([200,180,150,255,255,128,128,128],24);return b;}
test('production loading handles out-of-order cameras, reset intrinsics, and stale failed scene replacement', async()=>{
const {node,change,camera,context,instance,settle,focal}=await boot();
let oldResolve;change({name:'old.json',size:100,text:()=>new Promise(r=>oldResolve=r)});
change({name:'new.json',size:100,text:async()=>JSON.stringify([camera(2,100000)])});await settle();
assert.equal(vm.runInContext('camera.position[0]',context),2);
oldResolve(JSON.stringify([camera(1,100000)]));await settle();
assert.equal(vm.runInContext('camera.position[0]',context),2);

node('reset-button').onclick();assert.equal(vm.runInContext('camera.fx',context),800);assert.deepEqual(focal.at(-1),[800,800]);
// A is accepted in worker but its notifications wait. Start B before draining
// A; B fails. A was never committed on the UI, yet remains worker scene.
change({name:'A.splat',size:32,arrayBuffer:async()=>splat(1)});await settle();
change({name:'B.splat',size:1,arrayBuffer:async()=>new ArrayBuffer(1)});await settle();
instance.flush();await settle();instance.flush();
instance.postMessage({view:[1,0,0,0,0,1,0,0,0,0,-1,0,0,0,0,1]});await settle();
assert(instance.out.every(m=>m.sceneId===1));
});
test('local saved view survives default demo until its matching scene opens',async()=>{
const saved=[1,0,0,0,0,1,0,0,0,0,1,0,1,2,9,1];
const {change,context,instance,settle}=await boot('?viewScene=local.splat#'+encodeURIComponent(JSON.stringify(saved)));
change({name:'local.splat',size:32,arrayBuffer:async()=>splat(1)});await settle();instance.flush();await settle();instance.flush();
assert.equal(JSON.stringify(vm.runInContext('viewMatrix',context)),JSON.stringify(saved));
});

test('bundled capture selector loads real data, persists reload, and returns to the default', async()=>{
 const app=await boot('',true);
 assert.equal(app.node('scene-name').textContent,'Meridian Pavilion');
 app.node('scene-select').onchange({target:{value:'houseplant'}});
 await app.settle();app.instance.flush();await app.settle();app.instance.flush();
 assert.equal(app.node('scene-name').textContent,'Houseplant');
 assert.equal(app.node('splat-count').textContent,'113,648');
 assert.equal(app.node('scene-credit').hidden,false);
 assert.equal(app.context.location.search,'?scene=houseplant');
 assert.equal(app.requests.at(-1),'http://local/LumaField/assets/captures/houseplant.splat');
 const reopened=await boot(app.context.location.search,true);
 assert.equal(reopened.node('scene-name').textContent,'Houseplant');
 reopened.node('scene-select').onchange({target:{value:'pavilion'}});
 await reopened.settle();reopened.instance.flush();await reopened.settle();reopened.instance.flush();
 assert.equal(reopened.node('scene-name').textContent,'Meridian Pavilion');
 assert.equal(reopened.node('scene-credit').hidden,true);
 assert.equal(reopened.context.location.search,'');
});
