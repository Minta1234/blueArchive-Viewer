import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextureAtlas,AtlasAttachmentLoader,SkeletonBinary,Skeleton,AnimationStateData,AnimationState,Physics } from '@esotericsoftware/spine-core';
import { LobbyInteraction,chainMatrix,inverse,multiply,transform,pointInPolygon,voiceForEvent,gameViewport,lobbyView } from './interaction.mjs';
import {dialogueText} from './dialogue.mjs';
import {WorkSceneInteraction} from './work-scene.mjs';
import { createServer,resolveRequest } from './server.mjs';
import {exportWallpaper} from './export-wallpaper.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const readJSON=name=>JSON.parse(fs.readFileSync(path.join(here,'data',name),'utf8'));
const models=readJSON('models.json'),configs=readJSON('interactions.json');
function load(model) {
  const atlas=new TextureAtlas(fs.readFileSync(path.join(here,'../Live2D_Export',model.atlas),'utf8'));
  const data=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(fs.readFileSync(path.join(here,'../Live2D_Export',model.skeleton)));
  const skeleton=new Skeleton(data),state=new AnimationState(new AnimationStateData(data));
  const controller=new LobbyInteraction(skeleton,state,model,configs[model.id]);
  return {data,skeleton,state,controller};
}
function tick(scene,dt=0.25) {
  scene.skeleton.update(dt);scene.state.update(dt);scene.state.apply(scene.skeleton);
  scene.skeleton.updateWorldTransform(Physics.none);scene.controller.update(dt);scene.skeleton.updateWorldTransform(Physics.update);
  for(const bone of scene.skeleton.bones) assert.ok(Number.isFinite(bone.worldX+bone.worldY),`Invalid bone ${bone.data.name}`);
}

test('every Arona prefab actor applies to its original skeleton with a persistent background track',()=>{
  const work=readJSON('arona-scenes.json');
  for(const source of Object.values(work.scenes)) {
    const model=models.find(model=>model.id===source.modelId),scene=load(model);
    scene.controller=new WorkSceneInteraction(scene.skeleton,scene.state,model,source);
    scene.controller.start();tick(scene);
    for(const actor of source.actors.filter(actor=>actor.isIdle)) {
      scene.controller.setActor(actor);tick(scene,0.01);
      assert.equal(scene.state.getCurrent(0).animation.name,'Idle_background_00');
      for(const track of actor.idleTracks)assert.equal(scene.state.getCurrent(track.TrackIndex).animation.name,track.AnimationName);
      assert.equal(scene.controller.talk(),true);tick(scene,0.01);
      for(const track of actor.interactionTracks)assert.equal(scene.state.getCurrent(track.TrackIndex).animation.name,track.AnimationName);
      tick(scene,30);assert.equal(scene.controller.actor,actor);assert.equal(scene.controller.canInteract(),true);
    }
  }
});

test('affine transforms round trip nested original Unity transforms',()=>{
  const chain=[{position:{x:4,y:2},rotation:{x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},scale:{x:2,y:3}},
    {position:{x:-3,y:9},rotation:{x:0,y:0,z:0,w:1},scale:{x:100,y:100}}];
  const matrix=chainMatrix(chain),original={x:15,y:-32};
  const roundtrip=transform(inverse(matrix),transform(matrix,original));
  assert.ok(Math.abs(roundtrip.x-original.x)<1e-8 && Math.abs(roundtrip.y-original.y)<1e-8);
  assert.throws(()=>inverse([0,0,0,0,0,0]),/Singular/);
  assert.deepEqual(multiply([1,0,0,1,0,0],matrix),matrix);
});
test('hit regions use original collider, rotation and skeleton scale',()=>{
  const model=models.find(m=>m.id==='SpineLobbies/Airi_home/Airi_home');
  const scene=load(model),g=scene.controller.geometry.find(g=>g.control.gameObjectName==='HairPatIK');
  const p=transform(g.matrix,{x:0,y:0});
  assert.ok(pointInPolygon(p,g.polygons[0]));
  assert.equal(scene.controller.hit(p).control.boneName,'Touch_Point');
  assert.equal(scene.controller.hit({x:1e8,y:1e8}),null);
  assert.ok(Math.abs(p.x+369)<0.01 && Math.abs(p.y-1461)<0.01);
});
test('Airi uses original paired tracks, finish mask and drag clamp',()=>{
  const model=models.find(m=>m.id==='SpineLobbies/Airi_home/Airi_home');
  const scene=load(model);scene.controller.idle();scene.controller.talk();
  assert.equal(scene.state.getCurrent(0).animation.name,'Idle_01');
  assert.equal(scene.state.getCurrent(1).animation.name,'Talk_01_M');
  assert.equal(scene.state.getCurrent(2).animation.name,'Talk_01_A');
  tick(scene,16);
  assert.equal(scene.state.getCurrent(1).animation.name,'<empty>');
  const g=scene.controller.geometry.find(g=>g.control.boneName==='Touch_Point');
  assert.ok(scene.controller.beginDrag(g,{x:1e6,y:1e6}));tick(scene,2);
  const drag=scene.controller.drag,scale=scene.controller.config.skeletonData.scale;
  assert.ok(drag.bone.x>=g.control.MinLocalPos.x/scale-0.01 && drag.bone.x<=g.control.MaxLocalPos.x/scale+0.01);
  assert.ok(drag.bone.y>=g.control.MinLocalPos.y/scale-0.01 && drag.bone.y<=g.control.MaxLocalPos.y/scale+0.01);
  scene.controller.stopDrag();assert.equal(scene.controller.drag,null);tick(scene,3);
});
test('actual Talk timeline string payload resolves the original voice file',()=>{
  const model=models.find(m=>m.id==='SpineLobbies/Airi_home/Airi_home'),scene=load(model),voices=readJSON('voices.json');
  const played=[];scene.state.addListener({event:(_entry,event)=>{const voice=voiceForEvent(event,voices);if(voice)played.push(voice);}});
  scene.controller.start();assert.equal(scene.controller.talk(),false);tick(scene,30);
  scene.controller.talk();tick(scene,1.5);
  assert.equal(scene.state.getCurrent(0).animation.name,'Idle_01');
  assert.ok(played.includes('audio/airi_memoriallobby_1_1.ogg'));
  const file=fs.readFileSync(path.join(here,played[0]));assert.equal(file.subarray(0,4).toString(),'OggS');
});
test('CH0200_home Talk timeline events resolve all original voice files',()=>{
  const model=models.find(m=>m.id==='SpineLobbies/CH0200_home/CH0200_home'),scene=load(model),voices=readJSON('voices.json');
  const played=[];scene.state.addListener({event:(_entry,event)=>{const voice=voiceForEvent(event,voices);if(voice)played.push(voice);}});
  scene.controller.start();
  scene.state.setAnimation(1,'Talk_01_M',false);tick(scene,4);
  assert.ok(played.includes('audio/ch0200_memoriallobby_1_1.ogg'));
  assert.ok(played.includes('audio/ch0200_memoriallobby_1_2.ogg'));
  for(const p of played){
    const f=fs.readFileSync(path.join(here,p));
    assert.equal(f.subarray(0,4).toString(),'OggS');
  }
});
test('all 294 lobby skeletons and original clip graphs can be applied',()=>{
  const lobbies=models.filter(m=>m.category==='SpineLobbies');assert.equal(lobbies.length,294);
  let animations=0,drags=0;
  for(const model of lobbies) {
    const scene=load(model);scene.controller.start();tick(scene);
    for(const clip of scene.controller.clips) {
      if(!scene.data.findAnimation(clip.ClipName))continue;
      scene.state.clearTracks();scene.skeleton.setToSetupPose();scene.controller.play(clip);tick(scene);animations++;
    }
    scene.state.clearTracks();scene.controller.idle();scene.controller.talk();tick(scene);
    for(const g of scene.controller.geometry) {
      scene.controller.start();scene.state.clearTracks();scene.controller.idle();tick(scene,1/60);
      if(scene.controller.beginDrag(g,{x:0,y:0})){tick(scene);scene.controller.stopDrag();tick(scene);drags++;}
    }
  }
  console.log(`Validated ${lobbies.length} lobby skeletons, ${animations} original clip configs, ${drags} drag controls`);
});
test('native touch gates preserve intro and block talk/repress until bone return and end clip finish',()=>{
  const scene=load(models.find(m=>m.folder==='CH0335_home'));
  scene.controller.start();tick(scene,1/60);
  const g=scene.controller.geometry.find(g=>g.control.boneName==='Touch_Point');
  assert.equal(scene.controller.talk(),false);assert.equal(scene.controller.beginDrag(g,{x:0,y:0}),false);
  assert.equal(scene.state.getCurrent(0).animation.name,'Start_Idle_01');
  tick(scene,30);assert.equal(scene.controller.canInteract(),true);
  assert.equal(scene.controller.talk(),true);assert.equal(scene.controller.talk(),false);
  tick(scene,30);tick(scene,1/60);
  assert.equal(scene.controller.beginDrag(g,{x:1e4,y:1e4}),true);
  assert.ok(Math.abs(scene.controller.drag.alpha-g.control.FollowDragSpeed01)<1e-6);
  tick(scene,1/30);
  assert.ok(Math.abs(scene.controller.drag.alpha-g.control.FollowDragSpeed01)<1e-6,'drag alpha stays cached when FPS changes');
  scene.controller.stopDrag();
  assert.equal(scene.controller.canInteract(),false);
  assert.equal(scene.controller.beginDrag(g,{x:0,y:0}),false);
  for(let frame=0;frame<300;frame++)tick(scene,1/60);
  assert.equal(scene.controller.blockers.size,0);assert.equal(scene.controller.canInteract(),true);
});
test('native UIRoot framing uses original 2960x1440 constraints at standard and ultrawide aspects',()=>{
  assert.deepEqual(gameViewport(16/9),{width:2960,height:1665});
  assert.deepEqual(gameViewport(7/3),{width:3360,height:1440});
  assert.ok(Math.abs(gameViewport(2960/1440).width-2960)<1e-8);assert.equal(gameViewport(2960/1440).height,1440);
  assert.equal(gameViewport(2960/1440.5).height,1440,'Mathf.RoundToInt rounds half to even');
  assert.throws(()=>gameViewport(0),/Invalid/);
  const model=models.find(m=>m.folder==='CH0335_home'),scene=load(model),view=lobbyView(scene.skeleton,configs[model.id]);
  assert.ok(Math.abs(view.y-962)<0.001);assert.ok(Math.abs(view.width-2960)<0.001);
});
test('original CH0335 prefab hitbox and localized dialogue rows drive touch messages with original durations',()=>{
  const model=models.find(m=>m.folder==='CH0335_home'),scene=load(model);
  const dialogue=readJSON('dialogues.json').byModel[model.id],layout=readJSON('scenes.json').models[model.id];
  scene.controller=new LobbyInteraction(scene.skeleton,scene.state,model,configs[model.id],()=>{},dialogue,layout);
  scene.controller.start();tick(scene,30);tick(scene,1/60);
  assert.equal(dialogue.characterId,10135);
  assert.equal(scene.controller.bodyPolygons.length,1);
  const polygon=scene.controller.bodyPolygons[0],center={x:polygon.reduce((s,p)=>s+p.x,0)/4,y:polygon.reduce((s,p)=>s+p.y,0)/4};
  assert.equal(scene.controller.canTalkAt(center),true);assert.equal(scene.controller.canTalkAt({x:1e7,y:1e7}),false);
  assert.equal(scene.controller.talk(),true);
  const group=scene.controller.activeDialog.group,previous=group.groupId;
  assert.equal(scene.state.getCurrent(1).animation.name,group.animationName);
  assert.equal(scene.controller.dialogueRow.text,group.rows[0].text);
  assert.equal(scene.controller.talk(),false);
  tick(scene,group.rows[0].duration/1000+0.001);
  assert.equal(scene.controller.dialogueRow.text,group.rows[1].text);
  tick(scene,60);assert.equal(scene.controller.dialogueRow,null);
  assert.equal(scene.controller.talk(),true);assert.notEqual(scene.controller.activeDialog.group.groupId,previous);
  assert.equal(dialogueText('<b>JP</b><br>[ff0000]text[-]'),'JP\ntext');
});
test('server blocks traversal and serves binary ranges without writes',async()=>{
  for(const raw of ['/../extract_spine.py','/%2e%2e/extract_spine.py','/assets/../../GameAssembly.dll','/assets/%5csecret','/%00'])assert.throws(()=>resolveRequest(raw));
  const server=createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try {
    const url=`http://127.0.0.1:${server.address().port}`;
    const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/Memorial Lobby/);
    assert.equal((await fetch(url,{method:'POST'})).status,405);
    assert.equal((await fetch(url+'/api/export',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
    const localHeaders={'Content-Type':'application/json',Origin:url};
    assert.equal((await fetch(url+'/api/export',{method:'POST',headers:localHeaders,body:JSON.stringify({modelId:'../../outside'})})).status,400);
    const model=models.find(m=>m.folder==='Airi_home');
    const partial=await fetch(url+'/assets/'+model.skeleton,{headers:{Range:'bytes=0-15'}});
    assert.equal(partial.status,206);assert.equal((await partial.arrayBuffer()).byteLength,16);
    assert.equal((await fetch(url+'/assets/'+model.skeleton,{headers:{Range:'bytes=999999999-'}})).status,416);
    assert.equal((await fetch(url+'/no-such-file')).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('standalone Wallpaper Engine export includes all local dependencies and a verified ZIP',async()=>{
  const root=await fs.promises.mkdtemp(path.join(here,'.test-export-'));
  try{
    await assert.rejects(exportWallpaper('../../outside',{outputRoot:root}),/Unknown model/);
    const model=models.find(m=>m.id==='SpineLobbies/Airi_home/Airi_home');
    const result=await exportWallpaper(model.id,{outputRoot:root});
    const project=JSON.parse(fs.readFileSync(path.join(result.directory,'project.json'),'utf8'));
    assert.equal(project.type,'web');assert.equal(project.file,'index.html');
    assert.equal(project.general.properties.interactive.value,true);
    const html=fs.readFileSync(path.join(result.directory,'index.html'),'utf8');
    for(const script of ['spine-webgl.min.js','data.js','wallpaper.js']){
      assert.ok(html.includes(`src="${script}"`));assert.ok(fs.statSync(path.join(result.directory,script)).size>100);
    }
    const bundled=fs.readFileSync(path.join(result.directory,'wallpaper.js'),'utf8');
    assert.ok(!bundled.includes('127.0.0.1'));assert.ok(!bundled.includes('node_modules'));
    assert.ok(bundled.includes('wallpaperPropertyListener'));assert.ok(bundled.includes('applyGeneralProperties'));
    const script=fs.readFileSync(path.join(result.directory,'data.js'),'utf8');
    const payload=JSON.parse(script.slice('window.WALLPAPER_DATA='.length).trim().replace(/;$/,''));
    assert.equal(payload.model.id,model.id);
    assert.equal(payload.uiRoot.manualWidth,2960);assert.ok(payload.layout.bodyTouches.length);
    assert.equal(payload.dialogue.characterId,23000);
    assert.ok(html.includes('id="subtitle"'));assert.ok(html.includes('href="caption.css"'));
    for(const file of ['caption.css','ui/Lobby_balloon.png','ui/Lobby_balloon2.png','ui/GameJP-Medium.otf'])assert.ok(fs.existsSync(path.join(result.directory,file)));
    const atlas=new TextureAtlas(payload.atlasText);
    for(const page of atlas.pages)assert.ok(fs.existsSync(path.join(result.directory,'textures',page.name)));
    const data=new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(Buffer.from(payload.binary,'base64'));
    assert.ok(data.findAnimation('Talk_01_M'));
    assert.ok(Object.keys(payload.config.clips).length>10);assert.ok(result.audioFiles>10);
    for(const voice of Object.values(payload.voices))assert.ok(fs.existsSync(path.join(result.directory,voice)));
    assert.equal(fs.readFileSync(result.directory+'.zip').subarray(0,2).toString(),'PK');
    console.log(`Wallpaper Engine export: ${result.audioFiles} voices, ${(result.zipBytes/1048576).toFixed(1)} MB, standalone dependencies verified`);
  }finally{
    const relative=path.relative(here,root);
    assert.ok(relative.startsWith('.test-export-') && !relative.includes(path.sep));
    await fs.promises.rm(root,{recursive:true,force:true});
  }
});
