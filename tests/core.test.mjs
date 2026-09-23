import test from 'node:test';
import assert from 'node:assert/strict';
import { convertPly, validateSplat, validateCameras, readResponse, validateView } from '../core.js';
import { createWorker } from '../worker.js';

function splat(x=0){const b=new ArrayBuffer(32);new Float32Array(b).set([x,0,0,.05,.05,.05]);new Uint8Array(b).set([200,180,150,255,255,128,128,128],24);return b;}
function ply({count=1, format='binary_little_endian', ending='\n', values=[1,2,3,200,150,100],truncate=0}={}){
 const h=new TextEncoder().encode(['ply',`format ${format} 1.0`,`element vertex ${count}`,'property float x','property float y','property float z','property uchar red','property uchar green','property uchar blue','end_header',''].join(ending));
 const b=new Uint8Array(h.length+15-truncate);b.set(h);const d=new DataView(b.buffer,h.length);if(!truncate){values.slice(0,3).forEach((v,i)=>d.setFloat32(i*4,v,true));values.slice(3).forEach((v,i)=>d.setUint8(12+i,v));}return b.buffer;
}
test('PLY converts known geometry, colors and identity rotation',()=>{const b=convertPly(ply());assert.deepEqual([...new Float32Array(b).slice(0,3)],[1,2,3]);assert.deepEqual([...new Uint8Array(b).slice(24)],[200,150,100,255,255,128,128,128]);assert.equal(validateSplat(b),1);});
test('CRLF binary header accepted',()=>assert.equal(convertPly(ply({ending:'\r\n'})).byteLength,32));
test('ASCII PLY explicitly unsupported',()=>assert.throws(()=>convertPly(ply({format:'ascii'})),/binary_little_endian/));
test('truncated PLY rejected before reading rows',()=>assert.throws(()=>convertPly(ply({truncate:1})),/truncated/i));
test('zero vertices rejected',()=>assert.throws(()=>convertPly(ply({count:0})),/vertex count/i));
test('unbounded vertex declaration rejected',()=>assert.throws(()=>convertPly(ply({count:9999999999})),/vertex count/i));
test('nonfinite position rejected',()=>assert.throws(()=>convertPly(ply({values:[NaN,2,3,1,2,3]})),/position/i));
test('empty and partial splat records rejected',()=>{for(const n of [0,1,31,33])assert.throws(()=>validateSplat(new ArrayBuffer(n)),/32-byte/);});
test('nonfinite and excessive scale rejected',()=>{for(const value of [NaN,Infinity,-1,1000]){const b=splat();new Float32Array(b)[3]=value;assert.throws(()=>validateSplat(b),/scale/);}});
test('zero quaternion rejected',()=>{const b=splat();new Uint8Array(b).fill(128,28);assert.throws(()=>validateSplat(b),/rotation/);});
test('camera import validates focal and rotation',()=>{const c={position:[0,0,-5],rotation:[[1,0,0],[0,1,0],[0,0,1]],fx:700,fy:700,width:1000,height:700};assert.equal(validateCameras([c]).length,1);assert.throws(()=>validateCameras([{...c,fx:0}]),/focal/i);assert.throws(()=>validateCameras([{...c,rotation:[[0,0,0],[0,0,0],[0,0,0]]}]),/rotation/i);});
test('view hash requires finite invertible matrix',()=>{assert.throws(()=>validateView([1,2,3]),/view/i);assert.throws(()=>validateView(Array(16).fill(0)),/view/i);});
test('unknown Content-Length streams are assembled',async()=>{const bytes=new Uint8Array(splat());const r=new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,5));c.enqueue(bytes.slice(5));c.close();}}));assert.deepEqual(new Uint8Array(await readResponse(r)),bytes);});
test('advertised length is not trusted for allocation',async()=>{const r=new Response(new Uint8Array(splat()),{headers:{'content-length':'1000000000000'}});await assert.rejects(()=>readResponse(r),/limit/i);});
test('same-count scene replacement regenerates texture and sorting',()=>{const messages=[];const self={postMessage:m=>messages.push(m)};createWorker(self);const view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];self.onmessage({data:{buffer:splat(1),sceneId:1}});self.onmessage({data:{activate:1}});self.onmessage({data:{view}});self.onmessage({data:{buffer:splat(2),sceneId:2}});self.onmessage({data:{activate:2}});self.onmessage({data:{view}});assert.equal(messages.filter(m=>m.texdata).length,2);assert.equal(new Float32Array(messages.filter(m=>m.texdata)[1].texdata.buffer)[0],2);assert.equal(messages.filter(m=>m.depthIndex).at(-1).sceneId,2);});
test('bad import reports error while previous scene stays valid',()=>{const messages=[];const self={postMessage:m=>messages.push(m)};createWorker(self);self.onmessage({data:{buffer:splat(),sceneId:1}});self.onmessage({data:{buffer:new ArrayBuffer(0),sceneId:2}});assert.match(messages.at(-1).error,/32-byte/);});

test('tiny covariance underflows to zero instead of wrapping shift bits',()=>{for(const scale of [1e-12,1e-8]){const messages=[];const self={postMessage:m=>messages.push(m)};createWorker(self);const b=splat();new Float32Array(b).fill(scale,3,6);self.onmessage({data:{buffer:b,sceneId:1}});self.onmessage({data:{activate:1}});self.onmessage({data:{view:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}});const tex=messages.find(m=>m.texdata).texdata;assert.deepEqual([...tex.slice(4,7)],[0,0,0]);}});
test('non-unit encoded quaternion normalizes before covariance packing',()=>{const messages=[];const self={postMessage:m=>messages.push(m)};createWorker(self);const b=splat();new Float32Array(b).fill(64,3,6);new Uint8Array(b).fill(0,28);self.onmessage({data:{buffer:b,sceneId:1}});self.onmessage({data:{activate:1}});self.onmessage({data:{view:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}});const tex=messages.find(m=>m.texdata).texdata;for(const word of tex.slice(4,7))for(const half of [word&65535,word>>>16])assert.notEqual(half&0x7c00,0x7c00);});

test('ignored proposal and failed newer import preserve active worker scene',()=>{const messages=[];const self={postMessage:m=>messages.push(m)};createWorker(self);const view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];self.onmessage({data:{buffer:splat(1),sceneId:1}});self.onmessage({data:{activate:1}});self.onmessage({data:{view}});self.onmessage({data:{buffer:splat(2),sceneId:2}});self.onmessage({data:{buffer:new ArrayBuffer(0),sceneId:3}});assert.equal(messages.filter(m=>m.texdata).length,1);assert.equal(messages.filter(m=>m.depthIndex).at(-1).sceneId,1);assert.equal(messages.at(-1).sceneId,3);assert.ok(messages.at(-1).error);});

test('Gaussian PLY converts log scale, opacity, SH color and normalized quaternion',()=>{
 const names=['x','y','z','scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3','opacity','f_dc_0','f_dc_1','f_dc_2'];
 const header=new TextEncoder().encode(['ply','format binary_little_endian 1.0','comment café','element vertex 1',...names.map(n=>'property float '+n),'end_header',''].join('\r\n'));
 const input=new Uint8Array(header.length+names.length*4);input.set(header);const view=new DataView(input.buffer,header.length);
 [1,2,3,Math.log(.1),Math.log(.2),Math.log(.3),2,0,0,0,0,0,0,0].forEach((v,i)=>view.setFloat32(i*4,v,true));
 const b=convertPly(input.buffer);const f=new Float32Array(b);assert.ok(Math.abs(f[3]-.1)<1e-6);assert.ok(Math.abs(f[5]-.3)<1e-6);assert.deepEqual([...new Uint8Array(b).slice(24)],[128,128,128,128,255,128,128,128]);
});
test('camera source dimensions cannot poison projection',()=>{const c={position:[0,0,-5],rotation:[[1,0,0],[0,1,0],[0,0,1]],fx:700,fy:700,width:-1};assert.throws(()=>validateCameras([c]),/dimensions/);});
