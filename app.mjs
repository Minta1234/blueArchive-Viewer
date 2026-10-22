import { LobbyInteraction, lobbyView, voiceForEvent } from './interaction.mjs';
import {renderCaption} from './dialogue.mjs';
import {SceneVoiceAudio,sceneVoiceFiles} from './voice-audio.mjs';
import {WorkSceneInteraction,workSceneForModel} from './work-scene.mjs';
import {assetURL as joinAssetURL} from './asset-path.mjs';

const $=id=>document.getElementById(id);
const canvas=$('canvas'), stage=$('stage');
const runtime=globalThis.spine;
const settings=globalThis.VIEWER_CONFIG || {};
let context,renderer,models,interactions,scenes,dialogues,workScenes,voices={},active=null,selected=null,loadingToken=0,lastVoiceKey='';
let paused=false,muted=false,lastTime=performance.now(),press=null,forcedPat=false;
let previewCapture=null,exportDownloadURL=null,voiceSummary='';
const pointVector=new runtime.Vector3();
const voiceAudio=new SceneVoiceAudio({resolveURL:file=>joinAssetURL(file,settings.audioBase || './'),
  onState:playing=>{$('voice-status').textContent=playing ? 'Playing voice' : voiceSummary;},
  onError:error=>{if(error.name==='NotAllowedError')$('mode').textContent='Click the scene or Talk to enable audio';else console.warn('Voice preload/playback failed',error);}});
voiceAudio.setVolume(0.85);
for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>voiceAudio.unlock(),{capture:true});

async function json(url,optional=false) {
  const response=await fetch(url);
  if(!response.ok) { if(optional && response.status===404) return {}; throw new Error(`${url}: HTTP ${response.status}`); }
  return response.json();
}
const assetURL=relative=>joinAssetURL(relative,settings.assetBase || 'https://raw.githubusercontent.com/Minta1234/blueArchive-Viewer/assets/models/');
function status(message,error=false) {
  $('loading').hidden=!message;
  $('loading').textContent=message;
  $('loading').style.color=error ? '#ffb4b4' : '';
}
function stopAudio() { voiceAudio.stop();$('subtitle').textContent=''; }
function renderList() {
  const category=$('category').value,query=$('search').value.trim().toLowerCase();
  const filtered=models.filter(m=>(category==='all' || m.category===category) && `${m.displayName || ''} ${m.name} ${m.folder}`.toLowerCase().includes(query));
  $('count').textContent=filtered.length;
  const fragment=document.createDocumentFragment();
  for(const model of filtered) {
    const button=document.createElement('button');button.type='button';
    button.className=model.id===selected?.id ? 'active' : '';
    button.setAttribute('aria-current',model.id===selected?.id ? 'true' : 'false');
    const title=document.createElement('span');title.textContent=model.displayName || model.folder;
    const detail=document.createElement('small');detail.textContent=`${model.animations.length} animations · ${model.folder}`;
    button.append(title,detail);button.onclick=()=>loadModel(model);
    const item=document.createElement('div');item.setAttribute('role','listitem');item.append(button);fragment.append(item);
  }
  $('models').replaceChildren(fragment);
}

async function loadModel(model) {
  if (model.id === 'SpineBackground/Arona_workpage/arona_workpage') {
    const hr = new Date().getHours();
    const isNight = hr < 6 || hr >= 18;
    const targetId = isNight
      ? 'SpineBackground/Arona_workpage_nighttime_02/arona_workpage_nighttime_2'
      : 'SpineBackground/Arona_workpage_daytime_02/arona_workpage_daytime_2';
    const target = models.find(m => m.id === targetId);
    if (target) return loadModel(target);
  }
  const token=++loadingToken;
  lastVoiceKey='';voiceSummary='';voiceAudio.reset();voiceAudio.setPaused(document.hidden);
  endPress(false);stopAudio();forcedPat=false;$('pat').setAttribute('aria-pressed','false');
  if(active) {active.manager.dispose();active=null;}
  selected=model;paused=false;$('pause').textContent='Pause';$('pause').setAttribute('aria-pressed','false');
  $('export').disabled=true;
  $('title').textContent=model.displayName || model.folder;$('playing').textContent='—';renderList();status(`Loading ${model.displayName || model.folder}…`);
  const manager=new runtime.AssetManager(context);
  const binaryURL=assetURL(model.skeleton),atlasURL=assetURL(model.atlas);
  try {
    manager.loadBinary(binaryURL);manager.loadTextureAtlas(atlasURL);

    const workScene=workSceneForModel(workScenes,model.id);
    let standModel=null, standBinaryURL=null, standAtlasURL=null;
    if(workScene) {
      const isNight = /night/i.test(model.id);
      const standId = isNight ? 'SpineCharacters/NP0035_spr/NP0035_spr' : 'SpineCharacters/arona_spr/arona_spr';
      standModel = models.find(m=>m.id===standId);
      if(standModel) {
        standBinaryURL = assetURL(standModel.skeleton);
        standAtlasURL = assetURL(standModel.atlas);
        manager.loadBinary(standBinaryURL);
        manager.loadTextureAtlas(standAtlasURL);
      }
    }

    await manager.loadAll();
    if(token!==loadingToken) {manager.dispose();return;}
    const atlas=manager.require(atlasURL),reader=new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(atlas));
    const data=reader.readSkeletonData(manager.require(binaryURL)),skeleton=new runtime.Skeleton(data);
    const state=new runtime.AnimationState(new runtime.AnimationStateData(data));
    const config=interactions[model.id],layout=scenes.models[model.id],dialogue=dialogues.byModel[model.id];

    let stand=null;
    if(workScene && standModel && standAtlasURL && standBinaryURL) {
      const standAtlas=manager.require(standAtlasURL);
      const standReader=new runtime.SkeletonBinary(new runtime.AtlasAttachmentLoader(standAtlas));
      const standData=standReader.readSkeletonData(manager.require(standBinaryURL));
      const standSkeleton=new runtime.Skeleton(standData);
      const standState=new runtime.AnimationState(new runtime.AnimationStateData(standData));
      standSkeleton.x = -720;
      standSkeleton.y = 0;
      stand = { model: standModel, atlas: standAtlas, data: standData, skeleton: standSkeleton, state: standState };
    }

    const onPlay=(name,track)=>{if(workScene ? track>0 && name!=='Dummy' : track<2)$('playing').textContent=name;};
    const playVoice=(file,text)=>{
      if(!muted && file) {
        voiceAudio.play(file);
      }
    };
    const controller=workScene ? new WorkSceneInteraction(skeleton,state,model,workScene,onPlay,Math.random,stand,playVoice)
      : new LobbyInteraction(skeleton,state,model,config,onPlay,dialogue,layout);
    state.addListener({event:(entry,event)=>{
      if(token!==loadingToken) return;
      const voice=voiceForEvent(event,voices);
      const cue=`${entry.animation.name}:${entry.trackTime}:${event.time}:${voice}`;
      if(voice && !muted && cue!==lastVoiceKey) {
        lastVoiceKey=cue;
        voiceAudio.play(voice);
      }
    }});
    status('Preparing scene voices and font…');

    if(workScene) {
      const workAudioFiles=[
        ...Object.values(controller.workData.actors).flatMap(a=>[...(a.intro||[]).map(x=>x.audio), ...(a.exit||[]).map(x=>x.audio)]),
        ...controller.workData.standGreeting.map(x=>x.audio),
        ...controller.workData.standTalk.map(x=>x.audio)
      ];
      await voiceAudio.prepare(workAudioFiles);
      if(token!==loadingToken){manager.dispose();return;}
      voiceSummary=`Voices ready: ${controller.workData.name} full voiced dialogue (${workAudioFiles.length} clips)`;
      $('voice-status').textContent=voiceSummary;
    } else {
      const voiceReady=await voiceAudio.prepare(sceneVoiceFiles(data,voices));
      if(token!==loadingToken){manager.dispose();return;}
      voiceSummary=voiceReady.total ? `Voices ready: ${voiceReady.ready}/${voiceReady.total}${voiceReady.ready<voiceReady.total ? ' · Some voices unavailable; reselect the scene to retry' : ''}` : 'No matched voice clips';
      $('voice-status').textContent=voiceSummary;
      if(voiceReady.ready<voiceReady.total)console.warn(`Scene voices ready: ${voiceReady.ready}/${voiceReady.total}; unavailable clips will be skipped to preserve timing.`);
    }

    controller.start();state.apply(skeleton);skeleton.updateWorldTransform(runtime.Physics.reset);
    const view=lobbyView(skeleton,config);
    active={model,manager,atlas,skeleton,state,controller,view,config,layout,workScene};
    $('export').disabled=false;
    const options=model.animations.map(a=>{const option=document.createElement('option');option.value=a.name;option.textContent=`${a.name} (${a.duration.toFixed(2)}s)`;return option;});
    $('animation').replaceChildren(...options);
    $('zoom').value='1';
    const pat=controller.geometry.find(g=>/^Pat/.test(g.control.IngClip?.clip));
    $('pat').disabled=!pat && !workScene;$('talk').disabled=workScene ? !controller.canInteract() : !model.animations.some(a=>/^Talk/i.test(a.name));
    $('talk').textContent=workScene ? (controller.mode==='stand' ? 'Talk' : 'React') : 'Talk';
    canvas.setAttribute('aria-label',workScene ? 'Click the actor to react. Transition to Stand portrait for headpats.' : 'Click to talk. Hold and drag the head to pat.');
    $('mode').textContent=workScene ? `Original work scene · ${controller.workData.name} · Click the actor to react`
      : config ? `Original clip settings · ${controller.geometry.length} drag regions` : 'Animation mode · No original touch data for this scene';
    $('touch-hint').textContent=workScene ? 'Click the actor to react · Transition to Stand portrait'
      : pat ? 'Click to talk · Hold and drag the head to pat · Drag other regions to move the gaze' : 'Click to talk · Or choose an animation below';
    $('evidence').textContent=[`Skeleton: ${model.skeleton}`,`Atlas: ${model.atlas}`,`Spine: ${model.version}`,
      config ? `Original prefab: ${config.sourceBundle}` : 'No original interaction prefab found',
      config ? `Clip config: ${Object.keys(config.clips).length} clips, defaultMix=${config.skeletonData.defaultMix}` : '',
      ...controller.geometry.map(g=>`${g.control.gameObjectName}: bone=${g.control.boneName}, trigger=${g.control.TriggerDelay}s, ${g.control.IngClip?.clip} → ${g.control.EndClip?.clip}`),
      'Uses original Track / Loop / Mix / Sync / Finish and colliders',
      'Camera: UIRoot 2960×1440 + native activeHeight / UIManager projection',
      'Native drag formulas, idle gates and release blocking; original prefab body collider and dialogue layout',
      workScene ? `Work prefab: ${workScene.prefabPath}\nBackground: ${workScene.backgroundAnimation} on track 0; ${workScene.actors.length} original actor states.\nFull Stand portrait (${controller.workData.name}), headpatting, dialogue balloons and voices integrated.` : '',
      'Unity timelines, post-processing, gyro, account conditions and full NGUI text layout are not reproduced'].filter(Boolean).join('\n');
    const dayNightBtn=$('daynight');
    if(dayNightBtn) {
      if(workScene) {
        dayNightBtn.hidden=false;
        const isNight=/night/i.test(model.id);
        dayNightBtn.textContent=isNight ? '🌙 Night → Switch to Day' : '☀️ Day → Switch to Night';
        dayNightBtn.onclick=()=>{
          const nextTarget=isNight
            ? 'SpineBackground/Arona_workpage_daytime_02/arona_workpage_daytime_2'
            : 'SpineBackground/Arona_workpage_nighttime_02/arona_workpage_nighttime_2';
          const nextModel=models.find(m=>m.id===nextTarget)
            || models.find(m=>isNight ? /daytime/i.test(m.id) : /nighttime/i.test(m.id));
          if(nextModel) loadModel(nextModel);
        };
      } else {
        dayNightBtn.hidden=true;
      }
    }
    location.hash=encodeURIComponent(model.id);status('');
  } catch(error) {
    try {manager.dispose();} catch(disposalError) {console.warn('Incomplete texture cleanup failed',disposalError);}
    if(token===loadingToken) {active=null;status(`Could not load scene\n${error?.message || error || 'Asset request failed'}`,true);console.error(error);}
  }
}

function worldPoint(event) {
  const rect=canvas.getBoundingClientRect();
  pointVector.set(event.clientX-rect.left,event.clientY-rect.top,0);
  renderer.camera.screenToWorld(pointVector,rect.width,rect.height);
  return {x:pointVector.x,y:pointVector.y};
}
function talk() { if(!paused && active?.controller.talk()) {stopAudio();forcedPat=false;$('pat').setAttribute('aria-pressed','false');} }
function endPress(allowTalk=true) {
  if(!press) return;
  clearTimeout(press.timer);
  const previous=press;press=null;
  if(canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id);
  if(previous.triggered) active?.controller.stopDrag();
  else if(allowTalk && previous.distance<10 && previous.bodyHit) talk();
}
function togglePat() {
  if(!active || paused) return;
  if(active.workScene && active.controller.mode==='stand') {
    if(forcedPat) {active.controller.stopDrag();forcedPat=false;}
    else {
      forcedPat=active.controller.beginDrag({isHeadPat:true},{x:-700,y:1100});
      if(forcedPat)stopAudio();
    }
    $('pat').setAttribute('aria-pressed',String(forcedPat));
    return;
  }
  if(forcedPat) {active.controller.stopDrag();forcedPat=false;}
  else {
    const g=active.controller.geometry.find(g=>/^Pat/.test(g.control.IngClip?.clip));
    if(!g) return;
    const polygon=g.polygons[0];
    const p=polygon?.length ? {x:polygon.reduce((s,v)=>s+v.x,0)/polygon.length,y:polygon.reduce((s,v)=>s+v.y,0)/polygon.length} : {x:0,y:0};
    forcedPat=active.controller.beginDrag(g,p);if(forcedPat)stopAudio();
  }
  $('pat').setAttribute('aria-pressed',String(forcedPat));
}

function render(now) {
  requestAnimationFrame(render);
  const dt=Math.min((now-lastTime)/1000,0.05);lastTime=now;
  if(document.hidden) return;
  const gl=context.gl;
  gl.clearColor(0.025,0.04,0.06,1);gl.clear(gl.COLOR_BUFFER_BIT);
  if(!active) return;
  const {state,skeleton,controller,view,atlas}=active;
  if(!paused) {
    skeleton.update(dt);state.update(dt);state.apply(skeleton);
    skeleton.updateWorldTransform(runtime.Physics.none);controller.update(dt);skeleton.updateWorldTransform(runtime.Physics.update);
    if(controller.stand && controller.mode==='stand') {
      const {skeleton: ss, state: st} = controller.stand;
      ss.update(dt);st.update(dt);st.apply(ss);
      ss.updateWorldTransform(runtime.Physics.update);
    }
  }
  const zoom=Number($('zoom').value);
  Object.assign(view,lobbyView(skeleton,active.config,canvas.clientWidth/canvas.clientHeight,scenes.uiRoot));
  renderer.camera.position.set(view.x,view.y,0);renderer.camera.setViewport(view.width/zoom,view.height/zoom);
  renderer.resize(runtime.ResizeMode.Fit);renderer.begin();
  renderer.drawSkeleton(skeleton,atlas.pages.some(p=>p.pma));
  if(controller.stand && controller.mode==='stand') {
    renderer.drawSkeleton(controller.stand.skeleton,controller.stand.atlas.pages.some(p=>p.pma));
  }
  if($('hitboxes').checked) {
    for(const geometry of controller.geometry) {
      const color=/^Pat/.test(geometry.control.IngClip?.clip) ? new runtime.Color(0.3,0.9,1,1) : new runtime.Color(1,0.75,0.3,1);
      for(const poly of geometry.polygons) for(let i=0;i<poly.length;i++) {
        const a=poly[i],b=poly[(i+1)%poly.length];renderer.line(a.x,a.y,b.x,b.y,color);
      }
    }
  }
  renderer.end();
  if(active.workScene) {
    $('talk').disabled=!controller.canInteract();
    $('talk').textContent=controller.mode==='stand' ? 'Talk' : 'React';
    $('pat').disabled=controller.mode!=='stand';
    $('mode').textContent=controller.mode==='stand'
      ? `Stand mode · ${controller.workData.name} · Click to talk · Hold head to pat`
      : `Work scene · ${controller.actor?.stateName || ''} · Click the actor to react`;
    $('touch-hint').textContent=controller.mode==='stand'
      ? 'Click to talk · Hold and drag head to pat · Mouse moves gaze'
      : 'Click the actor to react · Transition to Stand portrait';
  }
  renderCaption($('subtitle'),controller.dialogueRow,active.layout,view,canvas.clientWidth,canvas.clientHeight,zoom);
  if(previewCapture){const resolve=previewCapture;previewCapture=null;resolve(canvas.toDataURL('image/jpeg',0.82));}
}

async function init() {
  context=new runtime.ManagedWebGLRenderingContext(canvas,{alpha:false,antialias:true});
  renderer=new runtime.SceneRenderer(canvas,context,true);
  [models,interactions,voices,scenes,dialogues,workScenes]=await Promise.all([json('data/models.json'),json('data/interactions.json'),json('data/voices.json',true),json('data/scenes.json'),json('data/dialogues.json'),json('data/arona-scenes.json')]);
  $('total').textContent=`${models.filter(m=>m.category==='SpineLobbies').length} lobbies · ${models.length} readable models`;
  $('search').oninput=renderList;$('category').onchange=renderList;
  $('talk').onclick=talk;$('pat').onclick=togglePat;
  $('export-close').onclick=()=>$('export-dialog').close();
  $('export').onclick=async()=>{
    if(!active)return;
    const scene=active,modelId=scene.model.id;
    $('export').disabled=true;$('export-dialog').showModal();
    $('export-message').textContent='Packing the model, textures, voices and interaction code…';$('export-links').replaceChildren();
    try {
      const preview=await new Promise(resolve=>{previewCapture=resolve;});
      if(settings.exportMode==='browser') {
        const {exportInBrowser}=await import('./browser-export.mjs');
        const result=await exportInBrowser({scene,voices,dialogue:dialogues.byModel[modelId] || null,uiRoot:scenes.uiRoot,
          assetBase:settings.assetBase,audioBase:settings.audioBase,siteBase:new URL('./',location.href).href,preview,
          onProgress:progress=>{$('export-message').textContent=progress==='zip' ? 'Compressing ZIP…' : `Downloading files (${progress})…`;}});
        if(exportDownloadURL)URL.revokeObjectURL(exportDownloadURL);
        exportDownloadURL=URL.createObjectURL(result.blob);
        const download=document.createElement('a');download.href=exportDownloadURL;download.download=result.filename;download.textContent='Download ZIP';
        $('export-links').append(download);
        $('export-message').textContent=`Ready: ${result.audioFiles} voice clips · ${(result.zipBytes/1048576).toFixed(1)} MB\nExtract the ZIP, then drag index.html into Create Wallpaper in Wallpaper Engine.`;
        return;
      }
      const response=await fetch('/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({modelId,preview})});
      const result=await response.json();if(!response.ok)throw new Error(result.error || `HTTP ${response.status}`);
      $('export-message').textContent=`Ready: ${result.audioFiles} voice clips · ${(result.zipBytes/1048576).toFixed(1)} MB\n${result.directory}\nExtract the ZIP, then drag index.html into Create Wallpaper in Wallpaper Engine`;
      const download=document.createElement('a');download.href=result.download;download.textContent='Download ZIP';download.download='';
      const previewLink=document.createElement('a');previewLink.href=result.preview;previewLink.textContent='Preview export';previewLink.target='_blank';previewLink.rel='noopener';
      $('export-links').append(download,previewLink);
    }catch(error){$('export-message').textContent=`Export failed: ${error.message}`;}
    finally{$('export').disabled=false;}
  };
  $('reset').onclick=()=>{if(active){stopAudio();active.controller.start();forcedPat=false;$('pat').setAttribute('aria-pressed','false');}};
  $('mute').onclick=()=>{muted=!muted;voiceAudio.setMuted(muted);if(muted)stopAudio();$('mute').textContent=`Sound: ${muted?'Off':'On'}`;$('mute').setAttribute('aria-pressed',String(muted));};
  $('pause').onclick=()=>{paused=!paused;voiceAudio.setPaused(paused || document.hidden);if(paused){stopAudio();endPress(false);active?.controller.stopDrag();forcedPat=false;$('pat').setAttribute('aria-pressed','false');}$('pause').textContent=paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(paused));};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen();}catch(error){$('mode').textContent=error.message;}};
  $('play').onclick=()=>{
    if(!active)return;stopAudio();active.controller.stopDrag();forcedPat=false;$('pat').setAttribute('aria-pressed','false');
    active.controller.activeDialog=null;active.controller.dialogueRow=null;
    const name=$('animation').value,clip=active.controller.clips.find(c=>c.ClipName===name);
    if(clip) {const entry=active.controller.play(clip);if(entry && $('loop').checked)entry.loop=true;}
    else active.controller.playName(name,$('loop').checked,0);
  };
  canvas.addEventListener('pointerdown',event=>{
    if(!active || paused || event.button!==0 || press) return;
    if(forcedPat)togglePat();
    canvas.focus();endPress(false);const point=worldPoint(event),geometry=active.controller.hit(point);
    if(!active.controller.canInteract())return;
    press={id:event.pointerId,x:event.clientX,y:event.clientY,distance:0,point,bodyHit:active.controller.canTalkAt(point),triggered:false,timer:null};
    canvas.setPointerCapture(event.pointerId);
    if(geometry) press.timer=setTimeout(()=>{
      if(press && active){press.triggered=active.controller.beginDrag(geometry,press.point);if(press.triggered)stopAudio();}
    },Math.max(0,geometry.control.TriggerDelay)*1000);
  });
  canvas.addEventListener('pointermove',event=>{
    const point=worldPoint(event);
    if(active?.workScene && active.controller.mode==='stand') {
      active.controller.updateCursor(point);
    }
    if(!press || event.pointerId!==press.id) return;
    press.distance=Math.max(press.distance,Math.hypot(event.clientX-press.x,event.clientY-press.y));
    press.point=point;
    if(active?.controller.drag)active.controller.drag.point={...press.point};
    if(active?.workScene && active.controller.mode==='stand' && active.controller.petting && active.controller.bonePoint) {
      const deltaY = event.clientY - press.y;
      active.controller.bonePoint.y = Math.max(active.controller.initialPointY - 30, Math.min(active.controller.initialPointY + 30, active.controller.bonePoint.y - deltaY * 0.15));
    }
  });
  canvas.addEventListener('pointerup',event=>{if(press?.id===event.pointerId)endPress();});
  canvas.addEventListener('pointercancel',()=>endPress(false));
  canvas.addEventListener('lostpointercapture',()=>endPress(false));
  canvas.addEventListener('keydown',event=>{
    if(event.code==='Space'){event.preventDefault();talk();}
    if(event.key.toLowerCase()==='h')togglePat();
    if(event.key==='Escape'){endPress(false);active?.controller.stopDrag();forcedPat=false;$('pat').setAttribute('aria-pressed','false');}
  });
  window.addEventListener('blur',()=>{endPress(false);active?.controller.stopDrag();forcedPat=false;$('pat').setAttribute('aria-pressed','false');});
  document.addEventListener('visibilitychange',()=>voiceAudio.setPaused(document.hidden || paused));
  requestAnimationFrame(render);
  const initial=models.find(m=>m.id===decodeURIComponent(location.hash.slice(1))) || models.find(m=>m.id==='SpineLobbies/Airi_home/Airi_home') || models[0];
  await loadModel(initial);
}
init().catch(error=>{status(`Could not start viewer\n${error.message}`,true);console.error(error);});
