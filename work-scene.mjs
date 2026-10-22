import {LobbyInteraction,bodyGeometry,pointInPolygon} from './interaction.mjs';
import {getWorkDataForModel} from './work-data.mjs';

export function workSceneForModel(catalog,modelId) {
  // Prefer the later prefab for a shared skeleton; both source presets remain in the catalog.
  const matches=Object.values(catalog?.scenes || {}).filter(scene=>scene.modelId===modelId);
  return matches[matches.length-1] || null;
}

export class WorkSceneInteraction extends LobbyInteraction {
  constructor(skeleton,state,model,scene,onPlay=()=>{},random=Math.random,stand=null,onVoice=()=>{}) {
    const config={skeletonData:{scale:scene.scale,defaultMix:scene.defaultMix},
      controller:{skeletonTransformChain:scene.skeletonTransformChain},clips:{},drags:[]};
    super(skeleton,state,model,config,onPlay);
    this.scene=scene;
    this.random=random;
    this.actor=null;
    this.interaction=null;
    this.stand=stand;
    this.onVoice=onVoice;
    this.mode='background'; // 'background' | 'stand'
    this.workData=getWorkDataForModel(model.id);
    this.talkIndex=0;
    this.petting=false;
    this.petReturning=false;
    this.setupStand();
  }

  setupStand() {
    if(!this.stand) return;
    const {skeleton} = this.stand;
    skeleton.x = -720;
    skeleton.y = 0;
    this.bonePoint = skeleton.findBone('Touch_Point');
    this.boneEye = skeleton.findBone('Touch_Eye');
    if(this.bonePoint) {
      this.initialPointX = this.bonePoint.x;
      this.initialPointY = this.bonePoint.y;
    }
    if(this.boneEye) {
      this.initialEyeX = this.boneEye.x;
      this.initialEyeY = this.boneEye.y;
    }
  }

  setStand(stand) {
    this.stand = stand;
    this.setupStand();
  }

  start() {
    this.mode='background';
    this.interaction=null;
    this.actor=null;
    this.dialogueRow=null;
    this.petting=false;
    this.petReturning=false;
    this.state.clearTracks();
    this.skeleton.setToSetupPose();
    if(this.stand) {
      this.stand.state.clearTracks();
      this.stand.skeleton.setToSetupPose();
      if(this.bonePoint) this.bonePoint.y = this.initialPointY;
      if(this.boneEye) {
        this.boneEye.x = this.initialEyeX;
        this.boneEye.y = this.initialEyeY;
      }
    }
    this.playName(this.scene.backgroundAnimation,this.scene.loop,0);
    const idle=this.scene.actors.filter(actor=>actor.isIdle);
    if(idle.length) this.setActor(idle[Math.floor(this.random()*idle.length)]);
  }

  setActor(actor) {
    if(this.actor) for(const index of new Set([...this.actor.idleTracks,...this.actor.interactionTracks].map(track=>track.TrackIndex)))
      this.state.setEmptyAnimation(index,0);
    this.actor=actor;
    this.interaction=null;
    this.bodyPolygons=actor?.stateAfterInteraction ? bodyGeometry(this.config,{bodyTouches:actor.colliders.map(collider=>({type:'BoxCollider',...collider}))}) : [];
    for(const track of actor?.idleTracks || []) this.playTrack(track);

    // Schedule ambient idle dialogue
    if(this.mode==='background' && actor) {
      const data=this.workData.actors[actor.stateName];
      if(data?.intro?.length) {
        const choice = data.intro[Math.floor(this.random() * data.intro.length)];
        const center = this.actorCenter();
        setTimeout(()=>{
          if(this.mode==='background' && this.actor===actor && !this.interaction) {
            this.dialogueRow = { text: choice.text, textEn: choice.textEn, isBackground: true, point: center };
            this.onVoice(choice.audio, choice.text);
          }
        }, 800);
      }
    }
  }

  actorCenter() {
    if(this.bodyPolygons.length) {
      const poly = this.bodyPolygons[0];
      return { x: poly.reduce((s,p)=>s+p.x,0)/poly.length, y: poly.reduce((s,p)=>s+p.y,0)/poly.length };
    }
    return { x: -800, y: 1000 };
  }

  playTrack(track,useDefaultMix=true) {
    const entry=this.playName(track.AnimationName,Boolean(track.IsLoop),track.TrackIndex);
    if(entry)entry.mixDuration=useDefaultMix && track.MixDuration===0 ? this.defaultMix : track.MixDuration;
    return entry;
  }

  canInteract() {
    if(this.mode==='stand') return !this.interaction;
    return Boolean(this.actor?.stateAfterInteraction) && !this.interaction;
  }

  canTalkAt(point) {
    if(!this.canInteract()) return false;
    if(this.mode==='stand') {
      return point.x >= -1100 && point.x <= -340 && point.y >= 0 && point.y <= 1500;
    }
    return this.bodyPolygons.some(polygon=>pointInPolygon(point,polygon));
  }

  hit(point) {
    if(this.mode==='stand') {
      // Headpat region
      if(point.x >= -850 && point.x <= -550 && point.y >= 920 && point.y <= 1380) {
        return {
          control: {
            gameObjectName: 'HeadPat',
            boneName: 'Touch_Point',
            TriggerDelay: 0.1,
            IngClip: { clip: 'Pat_01_M' },
            EndClip: { clip: 'PatEnd_01_M' }
          },
          isHeadPat: true
        };
      }
      return null;
    }
    return null;
  }

  beginDrag(geometry, point) {
    if(this.mode==='stand' && geometry?.isHeadPat && this.stand) {
      this.petting = true;
      this.petReturning = false;
      this.stand.state.setAnimation(1, 'Pat_01_M', false);
      this.stand.state.setAnimation(2, 'Pat_01_A', false);
      if(this.onPlay) this.onPlay('Pat_01_M', 1);
      return true;
    }
    return false;
  }

  stopDrag() {
    if(this.mode==='stand' && this.petting && this.stand) {
      this.petting = false;
      this.petReturning = true;
      this.stand.state.setAnimation(1, 'PatEnd_01_M', false);
      this.stand.state.setAnimation(2, 'PatEnd_01_A', false);
      this.stand.state.addEmptyAnimation(1, 0.5, 0);
      this.stand.state.addEmptyAnimation(2, 0.5, 0);
      if(this.onPlay) this.onPlay('PatEnd_01_M', 1);
    }
  }

  updateCursor(point) {
    if(this.mode==='stand' && this.boneEye && this.stand) {
      // Move eye bone towards pointer
      const dx = (point.x - (-720)) / 1000;
      const dy = (point.y - 1000) / 1000;
      this.boneEye.x = this.initialEyeX + Math.max(-15, Math.min(15, dx * 15));
      this.boneEye.y = this.initialEyeY + Math.max(-10, Math.min(10, dy * 10));
    }
  }

  talk() {
    if(!this.canInteract()) return false;
    if(this.mode==='stand') {
      const talks = this.workData.standTalk;
      const line = talks[this.talkIndex % talks.length];
      this.talkIndex++;
      if(this.stand) {
        if(line.expr) this.stand.state.setAnimation(1, line.expr, true);
        if(this.onPlay) this.onPlay(line.expr, 1);
      }
      this.dialogueRow = { text: line.text, textEn: line.textEn, isStand: true };
      this.onVoice(line.audio, line.text);
      return true;
    }

    // Background reaction
    const entries=this.actor.interactionTracks.map(track=>this.playTrack(track,false)).filter(Boolean);
    const duration = Math.max(0,...entries.map(entry=>entry.animation.duration+entry.delay));
    this.interaction={remaining: duration};

    const data = this.workData.actors[this.actor.stateName];
    if(data?.exit?.length) {
      const exitLine = data.exit[Math.floor(this.random() * data.exit.length)];
      this.dialogueRow = { text: exitLine.text, textEn: exitLine.textEn, isBackground: true, point: this.actorCenter() };
      this.onVoice(exitLine.audio, exitLine.text);
    }
    return true;
  }

  update(delta) {
    if(this.mode==='stand') {
      if(this.petReturning && this.bonePoint) {
        const diff = this.initialPointY - this.bonePoint.y;
        if(Math.abs(diff) <= 1) {
          this.bonePoint.y = this.initialPointY;
          this.petReturning = false;
        } else {
          this.bonePoint.y += Math.sign(diff) * Math.min(Math.abs(diff), 60 * delta);
        }
      }
      return;
    }

    if(!this.interaction) return;
    this.interaction.remaining -= delta;
    if(this.interaction.remaining > 0) return;

    const next=this.scene.actors.find(actor=>actor.stateName===this.actor.stateAfterInteraction);
    this.interaction=null;

    if(this.stand && next?.stateName==='Stand') {
      // Transition to Stand mode
      for(const index of new Set([...this.actor.idleTracks,...this.actor.interactionTracks].map(track=>track.TrackIndex)))
        this.state.setEmptyAnimation(index, 0);
      this.actor = next;
      this.mode = 'stand';
      this.stand.skeleton.setToSetupPose();
      this.stand.state.clearTracks();
      this.stand.state.setAnimation(0, 'Idle_01', true);

      // Play greeting
      const greetings = this.workData.standGreeting;
      const greet = greetings[Math.floor(this.random() * greetings.length)];
      if(greet.expr) this.stand.state.setAnimation(1, greet.expr, true);
      this.dialogueRow = { text: greet.text, textEn: greet.textEn, isStand: true };
      this.onVoice(greet.audio, greet.text);
      if(this.onPlay) this.onPlay('Idle_01', 0);
    } else {
      // Fallback: keep current idle actor visible
      this.setActor(!next || next.stateName==='Stand' ? this.actor : next);
    }
  }
}
