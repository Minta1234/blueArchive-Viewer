import {LobbyInteraction,bodyGeometry,pointInPolygon} from './interaction.mjs';

export function workSceneForModel(catalog,modelId) {
  // Prefer the later prefab for a shared skeleton; both source presets remain in the catalog.
  const matches=Object.values(catalog?.scenes || {}).filter(scene=>scene.modelId===modelId);
  return matches[matches.length-1] || null;
}

export class WorkSceneInteraction extends LobbyInteraction {
  constructor(skeleton,state,model,scene,onPlay=()=>{},random=Math.random) {
    const config={skeletonData:{scale:scene.scale,defaultMix:scene.defaultMix},
      controller:{skeletonTransformChain:scene.skeletonTransformChain},clips:{},drags:[]};
    super(skeleton,state,model,config,onPlay);
    Object.assign(this,{scene,random,actor:null,interaction:null});
  }
  start() {
    this.state.clearTracks();this.skeleton.setToSetupPose();this.interaction=null;
    this.actor=null;this.dialogueRow=null;
    this.playName(this.scene.backgroundAnimation,this.scene.loop,0);
    const idle=this.scene.actors.filter(actor=>actor.isIdle);
    if(idle.length)this.setActor(idle[Math.floor(this.random()*idle.length)]);
  }
  setActor(actor) {
    if(this.actor)for(const index of new Set([...this.actor.idleTracks,...this.actor.interactionTracks].map(track=>track.TrackIndex)))
      this.state.setEmptyAnimation(index,0);
    this.actor=actor;this.interaction=null;
    this.bodyPolygons=actor?.stateAfterInteraction ? bodyGeometry(this.config,{bodyTouches:actor.colliders.map(collider=>({type:'BoxCollider',...collider}))}) : [];
    for(const track of actor?.idleTracks || [])this.playTrack(track);
  }
  playTrack(track,useDefaultMix=true) {
    const entry=this.playName(track.AnimationName,Boolean(track.IsLoop),track.TrackIndex);
    if(entry)entry.mixDuration=useDefaultMix && track.MixDuration===0 ? this.defaultMix : track.MixDuration;
    return entry;
  }
  canInteract() {return Boolean(this.actor?.stateAfterInteraction) && !this.interaction;}
  canTalkAt(point) {return this.canInteract() && this.bodyPolygons.some(polygon=>pointInPolygon(point,polygon));}
  talk() {
    if(!this.canInteract())return false;
    const entries=this.actor.interactionTracks.map(track=>this.playTrack(track,false)).filter(Boolean);
    this.interaction={remaining:Math.max(0,...entries.map(entry=>entry.animation.duration+entry.delay))};
    return true;
  }
  update(delta) {
    if(!this.interaction)return;
    this.interaction.remaining-=delta;
    if(this.interaction.remaining>0)return;
    const next=this.scene.actors.find(actor=>actor.stateName===this.actor.stateAfterInteraction);
    this.interaction=null;
    if(next)this.setActor(next);
  }
}
