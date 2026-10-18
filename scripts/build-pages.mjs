import {mkdir,cp,readFile,writeFile} from 'node:fs/promises';
await mkdir('docs',{recursive:true});
await cp('public/workbench','docs',{recursive:true});
await cp('public/project-analysis.pdf','docs/project-analysis.pdf');
for(const name of ['app.js','cloud.js']){
 const source=await readFile('docs/'+name,'utf8');
 await writeFile('docs/'+name,source.replaceAll('href="../project-analysis.pdf"','href="./project-analysis.pdf"'));
}
await writeFile('docs/.nojekyll','');
console.log('GitHub Pages files prepared in docs/.');
