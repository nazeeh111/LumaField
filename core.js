// LumaField file boundaries. No DOM or renderer dependencies.
export const MAX_BYTES = 128 * 1024 * 1024;
export const MAX_SPLATS = 2_000_000;
const TYPES = {float:['getFloat32',4],float32:['getFloat32',4],double:['getFloat64',8],float64:['getFloat64',8],char:['getInt8',1],int8:['getInt8',1],uchar:['getUint8',1],uint8:['getUint8',1],short:['getInt16',2],int16:['getInt16',2],ushort:['getUint16',2],uint16:['getUint16',2],int:['getInt32',4],int32:['getInt32',4],uint:['getUint32',4],uint32:['getUint32',4]};
const finite = n => typeof n === 'number' && Number.isFinite(n);
const clamp = n => Math.max(0,Math.min(255,Math.round(n)));

export function validateSplat(buffer) {
    if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength % 32) throw new Error('A .splat file must contain complete, nonempty 32-byte records.');
    const count=buffer.byteLength/32;
    if(count>MAX_SPLATS) throw new Error('Scene exceeds the 2 million splat limit.');
    const f=new Float32Array(buffer), b=new Uint8Array(buffer);
    for(let i=0;i<count;i++) {
        for(let j=0;j<3;j++) {
            if(!finite(f[i*8+j]) || Math.abs(f[i*8+j])>10000) throw new Error(`Invalid position at splat ${i}: coordinates must be finite and within ±10,000.`);
            if(!finite(f[i*8+j+3]) || f[i*8+j+3]<=0 || f[i*8+j+3]>64) throw new Error(`Invalid scale at splat ${i}: each scale must be in (0, 64].`);
        }
        if(b.slice(i*32+28,i*32+32).every(v=>v===128)) throw new Error(`Invalid rotation at splat ${i}: zero quaternion.`);
    }
    return count;
}

export function convertPly(input) {
    if(input.byteLength>MAX_BYTES) throw new Error('PLY exceeds the 128 MiB file limit.');
    const bytes=new Uint8Array(input);
    // Locate the header terminator in bytes so UTF-8 comments cannot shift data.
    let end=-1;
    const limit=Math.min(bytes.length,65536);
    for(let i=0;i<limit-10;i++) {
        if((i===0||bytes[i-1]===10) && String.fromCharCode(...bytes.subarray(i,i+10))==='end_header') {
            if(bytes[i+10]===10) {end=i+11;break;}
            if(bytes[i+10]===13&&bytes[i+11]===10) {end=i+12;break;}
        }
    }
    if(end<0) throw new Error('Missing PLY end_header within the 64 KiB header limit.');
    const lines=new TextDecoder().decode(bytes.subarray(0,end)).split(/\r?\n/);
    if(lines[0]!=='ply'||!lines.includes('format binary_little_endian 1.0')) throw new Error('Only binary_little_endian 1.0 PLY files are supported.');
    let count=null, current=null, stride=0;
    const properties={};
    for(const line of lines) {
        const words=line.trim().split(/\s+/);
        if(words[0]==='element') {
            if(words[1]==='vertex') {
                if(count!==null||current!==null) throw new Error('PLY vertex must be the first and only vertex element.');
                count=Number(words[2]);
                if(!Number.isInteger(count)||count<1||count>MAX_SPLATS) throw new Error('Invalid vertex count: expected 1–2,000,000.');
            }
            current=words[1];
        } else if(words[0]==='property'&&current==='vertex') {
            const [,type,name]=words;
            if(words.length!==3||!TYPES[type]||properties[name]) throw new Error('Unsupported or duplicate PLY vertex property; scalar numeric properties are required.');
            properties[name]={method:TYPES[type][0],offset:stride};stride+=TYPES[type][1];
        }
    }
    if(count===null) throw new Error('Missing PLY vertex count.');
    const required=['x','y','z'];
    const gaussian=['scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3'].some(name=>name in properties);
    if(gaussian) required.push('scale_0','scale_1','scale_2','rot_0','rot_1','rot_2','rot_3','opacity');
    const sh='f_dc_0' in properties;
    required.push(...(sh?['f_dc_0','f_dc_1','f_dc_2']:['red','green','blue']));
    for(const name of required) if(!properties[name]) throw new Error(`PLY property ${name} is required.`);
    if(stride*count>input.byteLength-end) throw new Error('PLY vertex data is truncated.');
    const data=new DataView(input,end);
    const value=(row,name)=>{const p=properties[name];const v=data[p.method](row*stride+p.offset,true);if(!finite(v))throw new Error(`Invalid ${['x','y','z'].includes(name)?'position':name} at vertex ${row}.`);return v;};
    const order=Array.from({length:count},(_,i)=>i);
    const importance=new Float64Array(count);
    if(gaussian) for(let i=0;i<count;i++) importance[i]=Math.exp(value(i,'scale_0')+value(i,'scale_1')+value(i,'scale_2'))/(1+Math.exp(-value(i,'opacity')));
    order.sort((a,b)=>importance[b]-importance[a]);
    const output=new ArrayBuffer(count*32), f=new Float32Array(output), b=new Uint8Array(output);
    for(let j=0;j<count;j++) {
        const i=order[j];
        ['x','y','z'].forEach((name,k)=>f[j*8+k]=value(i,name));
        for(let k=0;k<3;k++) f[j*8+3+k]=gaussian?Math.exp(value(i,`scale_${k}`)):0.01;
        let q=gaussian?[0,1,2,3].map(k=>value(i,`rot_${k}`)):[1,0,0,0];
        const norm=Math.hypot(...q);if(norm<1e-12)throw new Error(`Invalid rotation at vertex ${i}: zero quaternion.`);
        q.forEach((v,k)=>b[j*32+28+k]=clamp(v/norm*128+128));
        for(let k=0;k<3;k++) b[j*32+24+k]=clamp(sh?(0.5+0.28209479177387814*value(i,`f_dc_${k}`))*255:value(i,['red','green','blue'][k]));
        b[j*32+27]='opacity' in properties?clamp(255/(1+Math.exp(-value(i,'opacity')))):255;
    }
    validateSplat(output);
    return output;
}

export function validateCameras(value) {
    if(!Array.isArray(value)||value.length<1||value.length>10000) throw new Error('Camera JSON must be a nonempty array of at most 10,000 cameras.');
    for(const c of value) {
        if(c) for(const name of ['width','height']) if(c[name]!==undefined&&(!finite(c[name])||c[name]<=0||c[name]>100000))throw new Error('Camera image dimensions must be finite and positive.');
        if(!c||![c.fx,c.fy].every(n=>finite(n)&&n>0&&n<=100000)) throw new Error('Camera focal lengths fx and fy must be finite and positive.');
        if(!Array.isArray(c.position)||c.position.length!==3||!c.position.every(n=>finite(n)&&Math.abs(n)<=10000)) throw new Error('Invalid camera position.');
        if(!Array.isArray(c.rotation)||c.rotation.length!==3||!c.rotation.every(r=>Array.isArray(r)&&r.length===3&&r.every(finite)))throw new Error('Invalid camera rotation.');
        const r=c.rotation;
        for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(Math.abs(r[i].reduce((s,v,k)=>s+v*r[j][k],0)-(i===j?1:0))>0.02) throw new Error('Camera rotation must be orthonormal.');
    }
    return value;
}

export function validateView(v) {
    if(!Array.isArray(v)||v.length!==16||!v.every(n=>finite(n)&&Math.abs(n)<=1e6)) throw new Error('Saved view must contain 16 finite matrix values.');
    // Affine camera matrix with a nonsingular 3x3 rotation block.
    const det=v[0]*(v[5]*v[10]-v[6]*v[9])-v[4]*(v[1]*v[10]-v[2]*v[9])+v[8]*(v[1]*v[6]-v[2]*v[5]);
    if(Math.abs(det)<1e-6||Math.abs(v[15]-1)>0.001||[v[3],v[7],v[11]].some(n=>Math.abs(n)>0.001))throw new Error('Saved view is not an invertible affine camera matrix.');
    return v;
}

export async function readResponse(response, onProgress=()=>{}) {
    if(!response.ok) throw new Error(`Scene request failed (HTTP ${response.status}).`);
    const declared=Number(response.headers.get('content-length'));
    if(declared>MAX_BYTES) {await response.body?.cancel();throw new Error('Scene exceeds the 128 MiB download limit.');}
    if(!response.body) throw new Error('The scene response has no readable body.');
    const reader=response.body.getReader(), chunks=[];let length=0;
    try {
        while(true) {
            const {done,value}=await reader.read();if(done)break;
            length+=value.byteLength;
            if(length>MAX_BYTES)throw new Error('Scene exceeds the 128 MiB download limit.');
            chunks.push(value);onProgress(length,declared>0?declared:null);
        }
    } catch(error) {await reader.cancel().catch(()=>{});throw error;}
    finally {reader.releaseLock();}
    const result=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
    return result.buffer;
}
