import { mkdir, cp, copyFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
await mkdir(out,{recursive:true});
for(const name of ['index.html','styles.css','main.js','core.js','worker.js','LICENSE','THIRD_PARTY.md'])await copyFile(new URL(name,root),new URL(name,out));
await cp(new URL('assets/',root),new URL('assets/',out),{recursive:true});
await cp(new URL('docs/',root),new URL('docs/',out),{recursive:true});
console.log('Static build ready in dist/. All runtime URLs are relative to the deployment subpath.');
