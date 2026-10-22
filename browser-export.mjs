import {zip,strToU8} from 'fflate';
import {wallpaperHTML,wallpaperProject,wallpaperReadme} from './wallpaper-template.mjs';
import {assetURL} from './asset-path.mjs';
import {voiceForEvent} from './interaction.mjs';
function base64(bytes) {
  const parts=[];
  for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  return btoa(parts.join(''));
}

export async function exportInBrowser({scene,voices,dialogue,uiRoot,assetBase,audioBase,siteBase,preview,onProgress=()=>{}}) {
  const {model,config,layout,atlas,skeleton,workScene}=scene;
  const entries={};let completed=0;
  const fetchBytes=async url=>{
    const response=await fetch(url);
    if(!response.ok)throw new Error(`Download failed (${response.status}): ${url}`);
    const bytes=new Uint8Array(await response.arrayBuffer());
    onProgress(++completed);return bytes;
  };
  const voiceKeys=new Set(model.events.flatMap(e=>[e.name,e.audioPath,e.stringValue]).filter(Boolean));
  for(const animation of skeleton.data.animations)for(const timeline of animation.timelines)for(const event of timeline.events || []) {
    for(const key of [event.stringValue,event.data.stringValue,event.data.audioPath,event.data.name])if(key)voiceKeys.add(key);
  }
  const selectedVoices={};
  for(const key of voiceKeys){
    const file=voices[key] || voiceForEvent({stringValue:key,data:{name:key}},voices);
    if(file)selectedVoices[key]=file;
  }
  const audioFiles=[...new Set(Object.values(selectedVoices))];
  const files=[
    ...atlas.pages.map(page=>['textures/'+page.name,assetURL(model.atlas.slice(0,model.atlas.lastIndexOf('/')+1)+page.name,assetBase)]),
    ...audioFiles.map(file=>{
      if(!file.startsWith('audio/') || !file.endsWith('.ogg'))throw new Error('Invalid voice reference');
      return [file,assetURL(file,audioBase)];
    }),
    ...['caption.css','ui/Lobby_balloon.png','ui/Lobby_balloon2.png','ui/GameJP-Medium.otf','wallpaper.js'].map(file=>[file,new URL(file,siteBase).href]),
    ['spine-webgl.min.js',new URL('vendor/spine-webgl.min.js',siteBase).href],
    ['SPINE-RUNTIME-LICENSE.txt',new URL('vendor/SPINE-RUNTIME-LICENSE.txt',siteBase).href]
  ];
  for(const [name] of files)assetURL(name,'./');
  const [binary,atlasBytes]=await Promise.all([fetchBytes(assetURL(model.skeleton,assetBase)),fetchBytes(assetURL(model.atlas,assetBase))]);
  // Each download is retained only for this model; the full archive is never loaded into memory.
  for(let i=0;i<files.length;i+=4)await Promise.all(files.slice(i,i+4).map(async([name,url])=>{
    entries[name]=[await fetchBytes(url),{level:/\.(png|ogg|jpg)$/.test(name) ? 0 : 6}];
  }));
  const payload={model,config,layout,workScene,uiRoot,dialogue,voices:selectedVoices,atlasText:new TextDecoder().decode(atlasBytes),binary:base64(binary)};
  entries['data.js']=strToU8('window.WALLPAPER_DATA='+JSON.stringify(payload)+';\n');
  entries['index.html']=strToU8(wallpaperHTML(Boolean(workScene)));
  const hasPreview=typeof preview==='string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(preview) && preview.length<=6*1024*1024;
  if(preview!==undefined && !hasPreview)throw new Error('Invalid preview image');
  if(hasPreview)entries['preview.jpg']=[Uint8Array.from(atob(preview.split(',')[1]),c=>c.charCodeAt(0)),{level:0}];
  entries['project.json']=strToU8(JSON.stringify(wallpaperProject(model,hasPreview),null,2));
  entries['README.md']=strToU8(wallpaperReadme(model,audioFiles.length,config?.drags.length || 0,workScene));
  onProgress('zip');
  const bytes=await new Promise((resolve,reject)=>zip(entries,{level:6},(error,data)=>error ? reject(error) : resolve(data)));
  const slug=model.folder.replace(/[^A-Za-z0-9_-]/g,'_').slice(0,64) || 'wallpaper';
  return {blob:new Blob([bytes],{type:'application/zip'}),filename:slug+'-WallpaperEngine.zip',audioFiles:audioFiles.length,zipBytes:bytes.length};
}
