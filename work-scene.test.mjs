import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WorkSceneInteraction,workSceneForModel} from './work-scene.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('./data/arona-scenes.json',import.meta.url)));
const models=JSON.parse(fs.readFileSync(new URL('./data/models.json',import.meta.url)));
function fixture(scene,random=()=>0) {
  const model=models.find(model=>model.id===scene.modelId),animations=new Map(model.animations.map(animation=>[animation.name,animation]));
  const skeleton={data:{findAnimation:name=>animations.get(name)},setToSetupPose(){}};
  const state={data:{},tracks:[],clearTracks(){this.tracks=[];},getCurrent(index){return this.tracks[index];},
    setAnimation(index,name,loop){return this.tracks[index]={animation:animations.get(name),loop,delay:0};},
    setEmptyAnimation(index){this.tracks[index]={animation:{name:'<empty>',duration:0},delay:0};}};
  return {state,controller:new WorkSceneInteraction(skeleton,state,model,scene,()=>{},random)};
}

test('work scenes join original prefab references and preserve scenario weights without a guessed clock',()=>{
  assert.equal(catalog.records.length,15);assert.equal(Object.keys(catalog.scenes).length,5);
  assert.deepEqual(catalog.records.filter(row=>row.ratio).map(row=>[row.id,row.ratio]),[[1,1],[2,99],[3,100],[12,10000000],[13,10000000]]);
  assert.equal(catalog.scenes.UIWorkAronaScene_00_Day.modelId,catalog.scenes.UIWorkAronaScene_01_Day.modelId);
  const legacy=models.find(model=>model.name==='arona_workpage');
  assert.equal(workSceneForModel(catalog,legacy.id),null);
  assert.equal(workSceneForModel(catalog,catalog.scenes.UIWorkAronaScene_01_Day.modelId).prefabPath,catalog.scenes.UIWorkAronaScene_01_Day.prefabPath);
});

test('all original actor tracks play together; touches are gated and preserve background through return to Stand',()=>{
  for(const scene of Object.values(catalog.scenes)) {
    const {controller,state}=fixture(scene);controller.start();
    assert.equal(state.getCurrent(0).animation.name,'Idle_background_00');
    for(const actor of scene.actors.filter(actor=>actor.isIdle)) {
      controller.setActor(actor);
      for(const track of actor.idleTracks) {
        assert.equal(state.getCurrent(track.TrackIndex).animation.name,track.AnimationName);
        assert.equal(state.getCurrent(track.TrackIndex).mixDuration,track.MixDuration || scene.defaultMix);
      }
      controller.update(1000);assert.equal(controller.actor,actor,'Dialogue interval must not change the actor');
      assert.ok(controller.bodyPolygons.length>0);
      const polygon=controller.bodyPolygons[0],center={x:polygon.reduce((n,p)=>n+p.x,0)/polygon.length,y:polygon.reduce((n,p)=>n+p.y,0)/polygon.length};
      assert.equal(controller.canTalkAt(center),true);
      assert.equal(controller.canTalkAt({x:1e12,y:1e12}),false);
      assert.equal(controller.talk(),true);assert.equal(controller.talk(),false);
      let duration=0;
      for(const track of actor.interactionTracks) {
        const entry=state.getCurrent(track.TrackIndex);assert.equal(entry.animation.name,track.AnimationName);
        assert.equal(entry.mixDuration,track.MixDuration);duration=Math.max(duration,entry.animation.duration+entry.delay);
      }
      controller.update(duration/2);assert.equal(controller.canInteract(),false);
      controller.update(duration/2+0.001);
      assert.equal(controller.actor,scene.actors.find(next=>next.stateName===actor.stateAfterInteraction));
      assert.equal(controller.canInteract(),false);assert.equal(state.getCurrent(0).animation.name,'Idle_background_00');
    }
  }
});

test('initial random choice uses every idle actor including duplicate state names in hierarchy order',()=>{
  for(const scene of Object.values(catalog.scenes)) {
    const idle=scene.actors.filter(actor=>actor.isIdle);
    for(let i=0;i<idle.length;i++) {
      const {controller}=fixture(scene,()=>(i+0.5)/idle.length);controller.start();assert.equal(controller.actor,idle[i]);
    }
  }
});
