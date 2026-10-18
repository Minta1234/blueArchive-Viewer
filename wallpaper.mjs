import {LobbyInteraction,lobbyView,voiceForEvent,clamp} from './interaction.mjs';
import {renderCaption} from './dialogue.mjs';

const data=window.WALLPAPER_DATA,spine=window.spine;
const canvas=document.getElementById('canvas'),message=document.getElementById('message'),voice=document.getElementById('voice');
const settings={soundenabled:true,volume:80,interactive:true,zoom:1,showhint:false,fps:30,paused:false};
let scene=null,press=null,last=performance.now(),lastDraw=last,resumeVoice=false,lastVoiceKey='';
function stopPress(talk=false) {
  if(!press)return;clearTimeout(press.timer);const previous=press;press=null;
  if(previous.triggered)scene?.controller.stopDrag();
  else if(talk && previous.distance<10 && previous.bodyHit && scene?.controller.talk())stopSound();
}
window.wallpaperPropertyListener={
  applyUserProperties(properties){
    for(const key of ['soundenabled','interactive','showhint'])if(properties[key])settings[key]=Boolean(properties[key].value);
    if(properties.volume)settings.volume=clamp(Number(properties.volume.value)||0,0,100);
    if(properties.zoom)settings.zoom=clamp(Number(properties.zoom.value)||1,0.6,1.8);
    voice.volume=settings.volume/100;
    if(!settings.soundenabled){voice.pause();resumeVoice=false;}
    if(!settings.interactive){stopPress();scene?.controller.stopDrag();}
    document.getElementById('hint').hidden=!settings.showhint;
  },
  applyGeneralProperties(properties){if(Number.isFinite(properties.fps))settings.fps=clamp(properties.fps,0,240);},
  setPaused(paused){
    if(paused){if(!settings.paused)resumeVoice=!voice.paused;stopPress();voice.pause();}
    else if(settings.paused && resumeVoice && settings.soundenabled)voice.play().catch(error=>console.error('Voice resume failed',error));
    settings.paused=Boolean(paused);last=lastDraw=performance.now();
  }
};
function world(event){
  const rect=canvas.getBoundingClientRect(),point=new spine.Vector3(event.clientX-rect.left,event.clientY-rect.top,0);
  scene.renderer.camera.screenToWorld(point,rect.width,rect.height);return {x:point.x,y:point.y};
}
function stopSound(){voice.pause();}
function playVoice(entry,event){
  const file=voiceForEvent(event,data.voices);if(!file || !settings.soundenabled || settings.paused)return;
  const cue=`${entry.animation.name}:${entry.trackTime}:${event.time}:${file}`;
  if(cue===lastVoiceKey)return;lastVoiceKey=cue;
  voice.pause();voice.src=file;voice.volume=settings.volume/100;
  voice.play().catch(error=>{
    if(error.name==='NotAllowedError'){document.getElementById('hint').textContent='Click the wallpaper to enable audio';document.getElementById('hint').hidden=false;}
    else if(error.name!=='AbortError')console.error('Voice playback failed',error);
  });
}
function frame(now){
  requestAnimationFrame(frame);
  if(settings.paused || document.hidden){last=lastDraw=now;return;}
  const interval=settings.fps>0 ? 1000/settings.fps : 0;
  if(interval && now-lastDraw<interval)return;
  const delta=Math.min((now-last)/1000,0.1);last=now;lastDraw=interval ? now-(now-lastDraw)%interval : now;
  if(!scene)return;
  const {context,renderer,skeleton,state,controller,view,atlas}=scene;
  skeleton.update(delta);state.update(delta);state.apply(skeleton);
  skeleton.updateWorldTransform(spine.Physics.none);controller.update(delta);skeleton.updateWorldTransform(spine.Physics.update);
  const gl=context.gl;gl.clearColor(0.025,0.04,0.06,1);gl.clear(gl.COLOR_BUFFER_BIT);
  Object.assign(view,lobbyView(skeleton,data.config,canvas.clientWidth/canvas.clientHeight,data.uiRoot));
  renderer.camera.position.set(view.x,view.y,0);renderer.camera.setViewport(view.width/settings.zoom,view.height/settings.zoom);
  renderer.resize(spine.ResizeMode.Fit);renderer.begin();renderer.drawSkeleton(skeleton,atlas.pages.some(p=>p.pma));renderer.end();
  const foreground=state.getCurrent(1),base=state.getCurrent(0);
  canvas.dataset.animation=(foreground?.animation.name!=='<empty>' && foreground?.animation.name) || base?.animation.name || '';
  canvas.dataset.drag=controller.drag?.control.boneName || '';
  renderCaption(document.getElementById('subtitle'),controller.dialogueRow,data.layout,view,canvas.clientWidth,canvas.clientHeight,settings.zoom);
}
async function init(){
  const context=new spine.ManagedWebGLRenderingContext(canvas,{alpha:false,antialias:true});
  const renderer=new spine.SceneRenderer(canvas,context,true),atlas=new spine.TextureAtlas(data.atlasText);
  await Promise.all(atlas.pages.map(page=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=()=>{page.setTexture(new spine.GLTexture(context,image));resolve();};
    image.onerror=()=>reject(new Error(`Cannot load texture: ${page.name}`));
    image.src='textures/'+page.name.split('/').map(encodeURIComponent).join('/');
  })));
  const binary=Uint8Array.from(atob(data.binary),c=>c.charCodeAt(0));
  const skeletonData=new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas)).readSkeletonData(binary);
  const skeleton=new spine.Skeleton(skeletonData),state=new spine.AnimationState(new spine.AnimationStateData(skeletonData));
  const controller=new LobbyInteraction(skeleton,state,data.model,data.config,()=>{},data.dialogue,data.layout);
  state.addListener({event:(entry,event)=>playVoice(entry,event)});
  controller.start();state.apply(skeleton);skeleton.updateWorldTransform(spine.Physics.reset);
  scene={context,renderer,atlas,skeleton,state,controller,view:lobbyView(skeleton,data.config)};
  canvas.addEventListener('mousedown',event=>{
    if(event.button!==0 || !settings.interactive || settings.paused || press || !controller.canInteract())return;
    const point=world(event),geometry=controller.hit(point);
    press={x:event.clientX,y:event.clientY,distance:0,point,bodyHit:controller.canTalkAt(point),timer:null,triggered:false};
    if(geometry)press.timer=setTimeout(()=>{
      if(press){press.triggered=controller.beginDrag(geometry,press.point);if(press.triggered)stopSound();}
    },Math.max(0,geometry.control.TriggerDelay)*1000);
  });
  window.addEventListener('mousemove',event=>{
    if(!press)return;press.distance=Math.max(press.distance,Math.hypot(event.clientX-press.x,event.clientY-press.y));
    press.point=world(event);if(controller.drag)controller.drag.point={...press.point};
  });
  window.addEventListener('mouseup',event=>{if(event.button===0)stopPress(true);});
  window.addEventListener('blur',()=>{stopPress();controller.stopDrag();});
  canvas.addEventListener('mouseleave',event=>{if(event.buttons===0){stopPress();controller.stopDrag();}});
  message.hidden=true;canvas.dataset.ready='true';requestAnimationFrame(frame);
}
init().catch(error=>{message.textContent=`Could not load wallpaper: ${error.message}`;console.error(error);});
