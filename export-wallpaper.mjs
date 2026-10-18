import {wallpaperHTML,wallpaperProject,wallpaperReadme} from './wallpaper-template.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {build} from 'esbuild';
import {TextureAtlas,AtlasAttachmentLoader,SkeletonBinary} from '@esotericsoftware/spine-core';

const here=path.dirname(fileURLToPath(import.meta.url));
const assets=path.resolve(here,'../Live2D_Export');
export const exportRoot=path.resolve(here,'../WallpaperEngine_Exports');
const execFileAsync=promisify(execFile);
const readJSON=async name=>JSON.parse(await fs.readFile(path.join(here,'data',name),'utf8'));

async function safeSource(root,relative){
  if(typeof relative!=='string' || relative.includes('\\') || relative.includes('\0') || relative.split('/').includes('..') || path.isAbsolute(relative))throw new Error('Unsafe asset path');
  const real=await fs.realpath(path.resolve(root,relative));
  const rel=path.relative(root,real);
  if(rel.startsWith('..') || path.isAbsolute(rel))throw new Error('Asset escapes source folder');
  return real;
}
export async function exportWallpaper(modelId,{preview,outputRoot=exportRoot}={}){
  const models=await readJSON('models.json'),model=models.find(m=>m.id===modelId);
  if(!model)throw new Error('Unknown model');
  if(preview!==undefined && (typeof preview!=='string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(preview) || preview.length>6*1024*1024))throw new Error('Invalid preview image');
  const interactions=await readJSON('interactions.json'),allVoices=await readJSON('voices.json');
  const scenes=await readJSON('scenes.json'),dialogues=await readJSON('dialogues.json');
  const config=interactions[modelId] || null;
  const binary=await fs.readFile(await safeSource(assets,model.skeleton));
  const atlasText=await fs.readFile(await safeSource(assets,model.atlas),'utf8'),atlas=new TextureAtlas(atlasText);
  const skeletonData=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(binary);
  const voiceKeys=new Set(model.events.flatMap(e=>[e.name,e.audioPath,e.stringValue]).filter(Boolean));
  for(const animation of skeletonData.animations)for(const timeline of animation.timelines)for(const event of timeline.events || []) {
    for(const key of [event.stringValue,event.data.stringValue,event.data.audioPath,event.data.name])if(key)voiceKeys.add(key);
  }
  const voices=Object.fromEntries([...voiceKeys].filter(k=>allVoices[k]).map(k=>[k,allVoices[k]]));
  const audioFiles=[...new Set(Object.values(voices))];
  await fs.mkdir(outputRoot,{recursive:true});
  const slug=model.folder.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64) || 'wallpaper';
  const directory=await fs.mkdtemp(path.join(outputRoot,slug+'-'));
  const copy=async(source,relative)=>{const target=path.join(directory,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(source,target);};
  for(const page of atlas.pages){
    const original=path.posix.join(path.posix.dirname(model.atlas),page.name);
    await safeSource(assets,original);
    if(page.name.includes('..') || page.name.includes('\\') || path.isAbsolute(page.name))throw new Error('Unsafe atlas page');
    await copy(await safeSource(assets,original),'textures/'+page.name);
  }
  for(const file of audioFiles){
    if(!file.startsWith('audio/') || !file.endsWith('.ogg'))throw new Error('Invalid voice reference');
    await copy(await safeSource(here,file),file);
  }
  await copy(path.join(here,'node_modules/@esotericsoftware/spine-webgl/dist/iife/spine-webgl.min.js'),'spine-webgl.min.js');
  await copy(path.join(here,'node_modules/@esotericsoftware/spine-webgl/LICENSE'),'SPINE-RUNTIME-LICENSE.txt');
  for(const file of ['caption.css','ui/Lobby_balloon.png','ui/Lobby_balloon2.png','ui/GameJP-Medium.otf'])await copy(path.join(here,file),file);
  const payload={model,config,voices,layout:scenes.models[modelId],uiRoot:scenes.uiRoot,dialogue:dialogues.byModel[modelId] || null,atlasText,binary:binary.toString('base64')};
  await fs.writeFile(path.join(directory,'data.js'),'window.WALLPAPER_DATA='+JSON.stringify(payload)+';\n');
  await build({entryPoints:[path.join(here,'wallpaper.mjs')],bundle:true,format:'iife',target:'chrome90',minify:true,
    outfile:path.join(directory,'wallpaper.js'),legalComments:'eof'});
  await fs.writeFile(path.join(directory,'index.html'),wallpaperHTML());
  const project=wallpaperProject(model,Boolean(preview));
  if(preview)await fs.writeFile(path.join(directory,'preview.jpg'),Buffer.from(preview.split(',')[1],'base64'));
  await fs.writeFile(path.join(directory,'project.json'),JSON.stringify(project,null,2));
  await fs.writeFile(path.join(directory,'README.md'),wallpaperReadme(model,audioFiles.length,config?.drags.length || 0));
  const zip=directory+'.zip';
  await execFileAsync('python',[path.join(here,'zip-export.py'),directory,zip],{windowsHide:true,maxBuffer:1024*1024});
  const zipBytes=(await fs.stat(zip)).size,name=path.basename(directory);
  return {directory,name,zipBytes,audioFiles:audioFiles.length,download:`/exports/${encodeURIComponent(name)}.zip`,preview:`/exports/${encodeURIComponent(name)}/index.html`};
}
