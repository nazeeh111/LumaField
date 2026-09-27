// Production main.js is evaluated with minimal browser surfaces. The worker,
// parser, buffers and message transfer are real; this does not test WebGL pixels.
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../core.js';
import { createWorker } from '../worker.js';
const root=new URL('../',import.meta.url);
async function boot(query='', libraryFixtures=false, expectedSceneName) {
const requests=[];
const nodes=new Map(),events={},focal=[];
function node(id){if(!nodes.has(id))nodes.set(id,{id,style:{},hidden:false,textContent:'',innerText:'',value:'',files:[],clientWidth:1000,clientHeight:750,addEventListener(n,f){events[`${id}:${n}`]=f;},setAttribute(){},closest(){return null},click(){}});return nodes.get(id)}
const canvas=node('canvas');const gl=new Proxy({canvas,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_p,key)=>key,uniform2fv:(key,v)=>{if(key==='focal')focal.push([...v]);}}, {get:(t,k)=>k in t?t[k]:(()=>({}))});canvas.getContext=()=>gl;
let instance, nextFrame;class FakeWorker{constructor(){instance=this;this.out=[];this.scope={postMessage:(m,transfer=[])=>this.out.push(structuredClone(m,{transfer}))};createWorker(this.scope)}postMessage(data,transfer=[]){this.scope.onmessage({data:structuredClone(data,{transfer})})}flush(){while(this.out.length)this.onmessage({data:this.out.shift()})}terminate(){}}
let resolveFetch;const fetching=new Promise(r=>resolveFetch=r);
const context={...core,Worker:FakeWorker,console,Float32Array,Uint8Array,ArrayBuffer,Blob,URL,URLSearchParams,TextDecoder,AbortController,Math,Date,Number,JSON,performance,devicePixelRatio:1,location:new URL('http://local/LumaField/'+query),history:{replaceState(_state,_title,url){context.location=new URL(url);}},navigator:{getGamepads:()=>[]},requestAnimationFrame(callback){nextFrame=callback},setTimeout,fetch:url=>{requests.push(String(url));if(!libraryFixtures)return fetching;const relative=new URL(url).pathname.replace('/LumaField/','');return Promise.resolve(new Response(fs.readFileSync(new URL(relative,root))));},document:{getElementById:node,createElement:()=>node('created'),addEventListener:(n,f)=>events[n]=f,body:{classList:{add(){},remove(){}}}},window:{addEventListener:(n,f)=>events[`window:${n}`]=f}};
vm.createContext(context);
let code=fs.readFileSync(new URL('main.js',root),'utf8').replace(/^import .*?;\n/,'').replaceAll('import.meta.url',JSON.stringify('http://local/LumaField/main.js'));
vm.runInContext(code,context);
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))};
function splat(x=0){const b=new ArrayBuffer(32);new Float32Array(b).set([x,0,0,.05,.05,.05]);new Uint8Array(b).set([200,180,150,255,255,128,128,128],24);return b}
const changeScene=file=>node('file-input').onchange({target:{files:[file],value:''}});
const changeCamera=file=>node('camera-file-input').onchange({target:{files:[file],value:''}});
const change=file=>/\.json$/i.test(file.name)?changeCamera(file):changeScene(file);
const camera=(x,fx=800)=>({position:[x,0,-5],rotation:[[1,0,0],[0,1,0],[0,0,1]],fx,fy:fx});
resolveFetch(new Response(splat()));await settle();instance.flush();await settle();instance.flush();assert.equal(node('scene-name').textContent,expectedSceneName || (libraryFixtures&&query.includes('scene=houseplant')?'Houseplant':'Meridian Pavilion'));

return {node,change,changeScene,changeCamera,camera,context,events,instance,settle,focal,requests,frame(time){const callback=nextFrame;nextFrame=null;callback(time)}};
}

function splat(x=0){const b=new ArrayBuffer(32);new Float32Array(b).set([x,0,0,.05,.05,.05]);new Uint8Array(b).set([200,180,150,255,255,128,128,128],24);return b;}
function near(actual, expected, tolerance=1e-6){assert(Math.abs(actual-expected)<tolerance,`${actual} differs from ${expected}`)}
function nearMatrix(actual, expected){actual.forEach((value,index)=>near(value,expected[index]));}
test('auto orbit starts at the current view, circles the scene center at steady speed, and resumes without a jump',async()=>{
 const app=await boot();
 app.change({name:'offset.splat',size:32,arrayBuffer:async()=>splat(10)});
 await app.settle();app.instance.flush();await app.settle();app.instance.flush();
 vm.runInContext('viewMatrix=getViewMatrix(lookAtCamera([14,-2,-8],[10,0,0]))',app.context);
 const view=()=>Array.from(vm.runInContext('viewMatrix',app.context));
 const position=()=>Array.from(vm.runInContext('invert4(viewMatrix).slice(12,15)',app.context));
 const before=view();
 app.node('orbit-button').onclick();app.frame(1000);
 nearMatrix(view(),before);
 app.frame(2000);
 const first=position();
 near(Math.hypot(first[0]-10,first[2]),Math.hypot(4,8));
 near(first[1],-2);
 assert(first[0]!==14);
 const transform=Array.from(vm.runInContext('invert4(viewMatrix)',app.context));
 const toward=[10-first[0],-first[1],-first[2]];
 near(transform[8]*toward[0]+transform[9]*toward[1]+transform[10]*toward[2],Math.hypot(...toward));
 app.frame(3000);
 const second=position();
 near(Math.atan2(first[2],first[0]-10),Math.atan2(second[2],second[0]-10)+0.18,1e-5);
 app.node('orbit-button').onclick();app.frame(4000);
 const paused=view();
 app.node('orbit-button').onclick();app.frame(5000);
 nearMatrix(view(),paused);
 app.frame(5000+2*Math.PI/0.00018);
 nearMatrix(view(),paused);
 app.node('orbit-button').onclick();app.node('orbit-button').onclick();
 app.frame(6000+2*Math.PI/0.00018);
 nearMatrix(view(),paused);
});
test('auto orbit reaches the same pose at a timestamp regardless of frame cadence',async()=>{
 const fast=await boot(),slow=await boot();
 fast.node('orbit-button').onclick();slow.node('orbit-button').onclick();
 fast.frame(1000);slow.frame(1000);
 fast.frame(2000);fast.frame(3000);slow.frame(3000);
 nearMatrix(Array.from(vm.runInContext('viewMatrix',fast.context)),Array.from(vm.runInContext('viewMatrix',slow.context)));
});
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
test('camera navigation reaches views beyond shortcut keys and invalid import keeps the active scene and cameras',async()=>{
 const app=await boot();
 const views=Array.from({length:12},(_,i)=>app.camera(i+1));
 app.changeCamera({name:'cameras.json',size:1000,text:async()=>JSON.stringify(views)});
 await app.settle();
 assert.equal(app.node('camera-nav').hidden,false);
 assert.equal(app.node('camera-position').textContent,'Camera 1 of 12');
 app.node('camera-index').value='12';app.node('camera-index').oninput({target:app.node('camera-index')});
 assert.equal(app.node('camera-position').textContent,'Camera 12 of 12');
 assert.equal(vm.runInContext('camera.position[0]',app.context),12);
 app.node('orbit-button').onclick();
 assert.equal(app.node('camera-position').textContent,'Free view');
 assert.equal(app.node('camera-index').value,'');
 app.node('camera-index').value='12';app.node('camera-index').onchange({target:app.node('camera-index')});
 app.changeCamera({name:'bad.json',size:100,text:async()=>JSON.stringify([{...app.camera(99),fx:0}])});
 await app.settle();
 assert.equal(app.node('status').textContent,'Could not load camera views');
 assert.equal(app.node('scene-name').textContent,'Meridian Pavilion');
 assert.equal(app.node('camera-nav').hidden,false);
 app.node('camera-next').onclick();
 assert.equal(vm.runInContext('camera.position[0]',app.context),1);
 assert.equal(app.node('camera-position').textContent,'Camera 1 of 12');
});
test('camera number field and shortcuts select the same numbered views; saved hash exits calibrated view',async()=>{
 const app=await boot();
 const views=Array.from({length:12},(_,i)=>app.camera(i+1));
 app.changeCamera({name:'cameras.json',size:1000,text:async()=>JSON.stringify(views)});
 await app.settle();
 const key=(digit)=>app.events['window:keydown']({target:{closest:()=>null},code:`Digit${digit}`,key:digit,preventDefault(){}});
 app.node('camera-index').value='1';app.node('camera-index').oninput({target:app.node('camera-index')});
 assert.equal(vm.runInContext('camera.position[0]',app.context),1);
 key('1');assert.equal(vm.runInContext('camera.position[0]',app.context),1);
 key('0');assert.equal(vm.runInContext('camera.position[0]',app.context),10);
 assert.equal(app.node('camera-index').value,'10');
 app.context.location.hash=encodeURIComponent(JSON.stringify([1,0,0,0,0,1,0,0,0,0,1,0,1,2,9,1]));
 app.events['window:hashchange']();
 assert.equal(app.node('camera-position').textContent,'Free view');
 assert.equal(app.node('camera-index').value,'');
});
test('bundled view save gives a selectable link when the clipboard is unavailable',async()=>{
 const app=await boot();
 await app.node('save-button').onclick();
 assert.equal(app.node('view-feedback').hidden,false);
 assert.equal(app.node('view-link').hidden,false);
 assert.equal(app.node('view-link').value,app.context.location.href);
 assert.match(app.node('view-feedback-text').textContent,/Copy the link/);
});
test('remote URL scenes keep remote link wording while local imports require reopening the file',async()=>{
 const app=await boot('?url='+encodeURIComponent('https://example.org/remote.splat'),false,'remote.splat');
 assert.equal(app.node('scene-type-label').textContent,'REMOTE SCENE');
 assert.equal(app.node('custom-scene-option').textContent,'Remote scene');
 assert.equal(app.node('save-label').textContent,'Copy link');
 await app.node('save-button').onclick();
 assert.match(app.node('view-feedback-text').textContent,/remote scene/);
 assert.doesNotMatch(app.node('view-feedback-text').textContent,/Reopen/);
 assert.match(app.node('view-link').value,/example.org/);
 app.changeScene({name:'local.splat',size:32,arrayBuffer:async()=>splat()});
 await app.settle();app.instance.flush();await app.settle();app.instance.flush();
 assert.equal(app.node('scene-type-label').textContent,'LOCAL SCENE');
 assert.equal(app.node('custom-scene-option').textContent,'Local scene');
 assert.equal(app.node('save-label').textContent,'Save view');
 assert.equal(app.context.location.search,'');
 await app.node('save-button').onclick();
 assert.match(app.node('view-feedback-text').textContent,/Reopen local.splat/);
 assert.equal(app.node('view-link').hidden,true);
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
test('failed and stale bundled scene requests keep the selected scene truthful',async()=>{
 const app=await boot('',true);
 const picker=app.node('scene-select');
 app.context.fetch=async()=>new Response('missing',{status:404});
 picker.value='houseplant';picker.onchange({target:picker});
 assert.equal(picker.value,'pavilion');
 await app.settle();
 assert.equal(app.node('scene-name').textContent,'Meridian Pavilion');
 assert.equal(app.node('splat-count').textContent,'51,372');
 assert.equal(app.node('scene-credit').hidden,true);
 let releaseHouseplant;
 app.context.fetch=url=>String(url).includes('houseplant')
     ?new Promise(resolve=>{releaseHouseplant=resolve})
     :Promise.resolve(new Response(fs.readFileSync(new URL('assets/meridian.splat',root))));
 picker.value='houseplant';picker.onchange({target:picker});
 app.node('demo-button').onclick();
 await app.settle();app.instance.flush();await app.settle();app.instance.flush();
 releaseHouseplant(new Response(fs.readFileSync(new URL('assets/captures/houseplant.splat',root))));
 await app.settle();app.instance.flush();
 assert.equal(picker.value,'pavilion');
 assert.equal(app.node('scene-name').textContent,'Meridian Pavilion');
 assert.equal(app.node('splat-count').textContent,'51,372');
});
