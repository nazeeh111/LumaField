import { stat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { convertPly, MAX_BYTES } from '../core.js';
const [input,output]=process.argv.slice(2);
try {
    if(!input||!output)throw new Error('Usage: node scripts/convert.mjs input.ply output.splat');
    if(resolve(input)===resolve(output))throw new Error('Input and output must differ.');
    if((await stat(input)).size>MAX_BYTES)throw new Error('Input exceeds the 128 MiB file limit.');
    const bytes=await readFile(input);
    const result=convertPly(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    // Never truncate an existing user output on a failed conversion.
    await writeFile(output,new Uint8Array(result),{flag:'wx'});
    console.log(`Converted ${result.byteLength/32} splats to ${output}`);
} catch(error) {console.error(error.message);process.exitCode=1;}
