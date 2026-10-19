import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=path.join(root,'dist');
await fs.mkdir(out,{recursive:true});
for(const name of ['style.css','caption.css','ui','vendor'])await fs.cp(path.join(root,name),path.join(out,name),{recursive:true});
await fs.mkdir(path.join(out,'data'),{recursive:true});
for(const name of ['models.json','interactions.json','voices.json','dialogues.json','scenes.json'])await fs.copyFile(path.join(root,'data',name),path.join(out,'data',name));
const html=(await fs.readFile(path.join(root,'index.html'),'utf8')).replace('src="app.mjs"','src="app.js"');
await fs.writeFile(path.join(out,'index.html'),html);
const settings={assetBase:'https://raw.githubusercontent.com/Minta1234/blueArchive-Viewer/assets/models/',
  audioBase:'https://raw.githubusercontent.com/Minta1234/blueArchive-Viewer/assets/',exportMode:'browser'};
await fs.writeFile(path.join(out,'site-config.js'),'globalThis.VIEWER_CONFIG='+JSON.stringify(settings)+';\n');
await fs.writeFile(path.join(out,'.nojekyll'),'');
await build({entryPoints:[path.join(root,'app.mjs'),path.join(root,'wallpaper.mjs')],outdir:out,
  bundle:true,format:'iife',platform:'browser',target:'chrome90',minify:true,legalComments:'eof'});
await fs.copyFile(path.join(out,'wallpaper.js'),path.join(root,'wallpaper.js'));
let bytes=0;
async function count(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true})){
  const file=path.join(folder,entry.name);if(entry.isDirectory())await count(file);else bytes+=(await fs.stat(file)).size;
}}
await count(out);
if(bytes>1024**3)throw new Error('Static site exceeds the GitHub Pages size limit');
console.log(`Built static site: ${(bytes/1048576).toFixed(1)} MiB. Original assets load on demand from the assets branch.`);
