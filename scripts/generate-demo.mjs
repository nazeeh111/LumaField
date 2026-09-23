import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const points=[];let seed=4309;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function add(x,y,z,s,color,alpha=245){const variation=.9+rand()*.2;points.push([x,y,z,s,s,s,...color.map(v=>Math.min(255,Math.round(v*variation))),alpha]);}
const stone=[196,184,163],ivory=[233,226,208],copper=[190,105,65],green=[76,102,73];
for(let x=-3.7;x<=3.7;x+=.085)for(let z=-3.2;z<=3.2;z+=.085){const tile=(Math.floor((x+4)/.65)+Math.floor((z+4)/.65))%2;add(x,0,z,.053,tile?stone:ivory);}
// Five structural portals: two columns and a continuous copper arch.
for(const z of [-2.4,-1.2,0,1.2,2.4]){
 for(const x of [-2.25,2.25])for(let y=0;y>=-1.3;y-=.055)for(let a=0;a<Math.PI*2;a+=.45)add(x+.07*Math.cos(a),y,z+.07*Math.sin(a),.045,copper);
 for(let a=0;a<=Math.PI;a+=.017)for(let ring=0;ring<8;ring++){const t=ring*Math.PI/4;add((2.25+.065*Math.cos(t))*Math.cos(a),-1.3-(2.25+.065*Math.cos(t))*Math.sin(a),z+.065*Math.sin(t),.045,copper);}
}
// Low stone walls, benches and exhibition plinths.
function box(cx,cy,cz,w,h,d,col){for(let x=-w/2;x<=w/2;x+=.055)for(let z=-d/2;z<=d/2;z+=.055){add(cx+x,cy-h/2,cz+z,.04,col);add(cx+x,cy+h/2,cz+z,.04,col);}for(let y=-h/2;y<=h/2;y+=.055){for(let x=-w/2;x<=w/2;x+=.055){add(cx+x,cy+y,cz-d/2,.04,col);add(cx+x,cy+y,cz+d/2,.04,col);}for(let z=-d/2;z<=d/2;z+=.055){add(cx-w/2,cy+y,cz+z,.04,col);add(cx+w/2,cy+y,cz+z,.04,col);}}}
for(const x of [-2.65,2.65]){box(x,-.28,0,.55,.56,4.6,stone);for(let k=0;k<1900;k++){const z=(rand()-.5)*4.5;add(x+(rand()-.5)*.48,-.62-rand()*.18,z,.047,green);}}
for(const z of [-1.7,0,1.7]){box(0,-.32,z,.65,.64,.65,ivory);for(let a=0;a<2*Math.PI;a+=.025)for(let b=0;b<2*Math.PI;b+=.25){const radius=.42+.055*Math.cos(b);add(radius*Math.cos(a),-1.2+radius*Math.sin(a),z+.055*Math.sin(b),.032,copper);}}
const data=new ArrayBuffer(points.length*32),floats=new Float32Array(data),bytes=new Uint8Array(data);
points.forEach((p,i)=>{floats.set(p.slice(0,6),i*8);bytes.set(p.slice(6),i*32+24);bytes.set([255,128,128,128],i*32+28);});
const target=new URL('../assets/',import.meta.url);await mkdir(target,{recursive:true});await writeFile(new URL('meridian.splat',target),new Uint8Array(data));
await writeFile(new URL('demo.json',target),JSON.stringify({name:'Meridian Pavilion',kind:'Seeded procedural architecture',seed:4309,splats:points.length,bytes:data.byteLength,generator:'scripts/generate-demo.mjs',rights:'Original procedural geometry and colors; no photographs or external media.'},null,2)+'\n');
console.log(`Generated ${points.length.toLocaleString()} splats (${data.byteLength} bytes) at ${fileURLToPath(target)}`);
