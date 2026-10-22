export const referenceKey = ref => ref ? `${ref.file}:${ref.pathId}` : null;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const voiceForEvent = (event,voices) => {
  if (!event || !voices) return null;
  const direct = voices[event.stringValue] || voices[event.data?.stringValue]
    || voices[event.data?.audioPath] || voices[event.data?.name];
  if (direct) return direct;
  const candidates = [event.stringValue, event.data?.stringValue, event.data?.audioPath, event.data?.name];
  for (const c of candidates) {
    if (!c || typeof c !== 'string') continue;
    const clean = c.replace(/^(?:sound|audio|images\/sound|images\/audio)\//i, '').replace(/\.(?:ogg|wav|mp3)$/i, '');
    const found = voices[clean] || voices[clean.toLowerCase()] || voices[c.toLowerCase()]
      || voices[`sound/${clean}`] || voices[`sound/${clean}.ogg`] || voices[`Sound/${clean}.wav`]
      || voices[`Audio/${clean}`] || voices[`Audio/${clean}.wav`];
    if (found) return found;
  }
  return null;
};

export function multiply(a, b) {
  return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
    a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function transform(matrix, point) {
  return { x: matrix[0]*point.x+matrix[2]*point.y+matrix[4], y: matrix[1]*point.x+matrix[3]*point.y+matrix[5] };
}
export function inverse(m) {
  const det = m[0]*m[3]-m[1]*m[2];
  if (Math.abs(det) < 1e-12) throw new Error('Singular transform in original prefab');
  return [m[3]/det,-m[1]/det,-m[2]/det,m[0]/det,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det];
}
export function chainMatrix(chain = []) {
  return chain.reduce((matrix, t) => {
    const q=t.rotation, s=t.scale, p=t.position;
    return multiply([ (1-2*(q.y*q.y+q.z*q.z))*s.x, 2*(q.x*q.y+q.w*q.z)*s.x,
      2*(q.x*q.y-q.w*q.z)*s.y, (1-2*(q.x*q.x+q.z*q.z))*s.y,p.x,p.y],matrix);
  }, [1,0,0,1,0,0]);
}
export function controlGeometry(config) {
  if (!config?.controller?.skeletonTransformChain) return [];
  const scale = config.skeletonData.scale;
  const skeletonUI = multiply(chainMatrix(config.controller.skeletonTransformChain), [scale,0,0,scale,0,0]);
  const uiToSkeleton = inverse(skeletonUI);
  return config.drags.map(control => {
    const matrix = multiply(uiToSkeleton,chainMatrix(control.transformChain));
    return { control, matrix, inverse: inverse(matrix), polygons: control.colliders.filter(c=>c.m_Enabled).map(c => {
      const {x,y}=c.m_Center, size=c.m_Size;
      if (!size) return [];
      return [{x:x-size.x/2,y:y-size.y/2},{x:x+size.x/2,y:y-size.y/2},
        {x:x+size.x/2,y:y+size.y/2},{x:x-size.x/2,y:y+size.y/2}].map(p=>transform(matrix,p));
    }) };
  });
}
export function gameViewport(aspect,root={manualWidth:2960,manualHeight:1440}) {
  if(!Number.isFinite(aspect) || aspect<=0)throw new Error('Invalid viewport aspect');
  const height=Math.max(root.manualHeight,root.manualWidth/aspect),floor=Math.floor(height);
  const activeHeight=height-floor===0.5 ? floor+(floor%2) : Math.round(height);
  const adjustment=Math.max(1,(4/3)/aspect);
  return {width:activeHeight*aspect*adjustment,height:activeHeight*adjustment};
}
export function skeletonUIMatrix(config) {
  const s=config.skeletonData.scale;
  return multiply(chainMatrix(config.controller.skeletonTransformChain),[s,0,0,s,0,0]);
}
export function bodyGeometry(config,layout) {
  if(!config?.controller.skeletonTransformChain)return [];
  const uiToSkeleton=inverse(skeletonUIMatrix(config));
  return (layout?.bodyTouches || []).filter(c=>c.type==='BoxCollider').map(c=>{
    const matrix=multiply(uiToSkeleton,chainMatrix(c.transformChain)),{x,y}=c.m_Center,s=c.m_Size;
    return [{x:x-s.x/2,y:y-s.y/2},{x:x+s.x/2,y:y-s.y/2},{x:x+s.x/2,y:y+s.y/2},{x:x-s.x/2,y:y+s.y/2}].map(p=>transform(matrix,p));
  });
}
export function lobbyView(skeleton,config,aspect=16/9,root) {
  if(config?.controller.skeletonTransformChain) {
    const matrix=skeletonUIMatrix(config),ui=gameViewport(aspect,root);
    const center=transform(inverse(matrix),{x:0,y:0});
    return {...center,width:ui.width/Math.hypot(matrix[0],matrix[1]),height:ui.height/Math.hypot(matrix[2],matrix[3]),uiWidth:ui.width,uiHeight:ui.height};
  }
  const b=skeleton.getBoundsRect();
  return {x:b.x+b.width/2,y:b.y+b.height/2,width:Math.max(b.width*1.05,1),height:Math.max(b.height*1.05,1)};
}
export function pointInPolygon(point, polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y) && point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}

export class LobbyInteraction {
  constructor(skeleton,state,model,config,onPlay=()=>{},dialogue=null,layout=null) {
    Object.assign(this,{skeleton,state,model,config,onPlay,dialogue,layout});
    this.clips=Object.values(config?.clips || {});
    this.geometry=controlGeometry(config);
    this.bodyPolygons=bodyGeometry(config,layout);
    this.dialogueRow=null;this.activeDialog=null;this.previousGroup=null;
    this.drag=null; this.returning=[]; this.talkIndex=0; this.blockers=new Set(); this.delta=1/60;
    this.defaultMix=config?.skeletonData.defaultMix ?? 0.2;
    state.data.defaultMix=this.defaultMix;
    this.idleClips=new Map();const visited=new Set();
    const addIdle=ref=>{
      const clip=this.clip(ref);if(!clip || visited.has(clip.ClipName))return;
      visited.add(clip.ClipName);this.idleClips.set(clip.Track,clip);for(const sync of clip.SyncPlayClipObjects || [])addIdle(sync);
    };
    for(const ref of config?.controller.idleClipPool || [])addIdle(ref);
    this.randomIdleClips=(config?.controller.idleBaseRandomClipPool || []).map(ref=>this.clip(ref)).filter(Boolean);
  }
  clip(ref) { return this.config?.clips[referenceKey(ref)] || null; }
  isIdle() {
    return this.state.tracks.every(entry=>!entry?.animation || this.idleClips.get(entry.trackIndex)?.ClipName===entry.animation.name
      || (!this.config && /^Idle(?:_|$)/i.test(entry.animation.name))
      || this.randomIdleClips.some(clip=>clip.ClipName===entry.animation.name && clip.Track===entry.trackIndex && !clip.BlockInteractionOnPlay)
      || (!entry.loop && entry.isComplete()));
  }
  canInteract() { return this.blockers.size===0 && this.isIdle(); }
  canTalkAt(point) { return this.bodyPolygons.some(p=>pointInPolygon(point,p)); }
  returnToIdle() {
    for(let track=0;track<this.state.tracks.length;track++) {
      const idle=this.idleClips.get(track);
      if(idle) {
        if(this.state.getCurrent(track)?.animation.name!==idle.ClipName)this.play(idle);
      } else if(this.state.getCurrent(track))this.state.setEmptyAnimation(track,this.defaultMix);
    }
    if(!this.state.getCurrent(0))this.idle();
  }
  idle() {
    const original=this.config?.controller.idleClipPool?.map(r=>this.clip(r)).find(Boolean)
      || this.clips.find(c=>c.IsTrackMainIdle);
    if(original) return this.play(original);
    const fallback=this.model.animations.find(a=>/^Idle(?:_|$)/i.test(a.name)) || this.model.animations[0];
    if(fallback) this.playName(fallback.name,true,0);
  }
  start() {
    this.state.clearTracks(); this.skeleton.setToSetupPose(); this.blockers.clear();
    this.drag=null; this.returning=[];
    this.activeDialog=null;this.dialogueRow=null;
    const intro=this.clips.find(c=>/^Start_Idle/.test(c.ClipName));
    if(intro) this.play(intro); else this.idle();
  }
  playName(name,loop=false,track=0) {
    if(!this.skeleton.data.findAnimation(name)) return null;
    const entry=this.state.setAnimation(track,name,loop);
    this.onPlay(name,track); return entry;
  }
  play(clip,visited=new Set()) {
    if(!clip || visited.has(clip.ClipName) || !this.skeleton.data.findAnimation(clip.ClipName)) return null;
    visited.add(clip.ClipName);
    const entry=this.playName(clip.ClipName,Boolean(clip.Loop),clip.Track);
    if(!entry) return null;
    entry.mixDuration=clip.UseDefaultIntroMix ? this.defaultMix : clip.IntroMix;
    entry.listener={complete:()=>{
      if(entry.loop || this.state.getCurrent(clip.Track)!==entry) return;
      if(clip.FinishMode===3 && clip.NextClipObject) this.play(this.clip(clip.NextClipObject));
      else if(clip.FinishMode===1) this.idle();
      else if(clip.FinishMode===2) this.state.setEmptyAnimation(clip.Track,clip.UseDefaultOutroMix ? this.defaultMix : clip.OutroMix);
    }};
    for(const ref of clip.SyncPlayClipObjects || []) this.play(this.clip(ref),visited);
    return entry;
  }
  talk() {
    if(!this.canInteract() || this.activeDialog) return false;
    const groups=this.dialogue?.groups.filter(group=>group.animationExists && group.rows[0]?.condition===0
      && this.clips.some(clip=>clip.ClipName===group.animationName));
    if(groups?.length) {
      // shortcut: account unlock and seasonal filters need live game state; standalone uses unconditional lobby groups.
      const choices=groups.filter(group=>group.groupId!==this.previousGroup);
      const group=(choices.length ? choices : groups)[Math.floor(Math.random()*(choices.length || groups.length))];
      this.previousGroup=group.groupId;
      this.activeDialog={group,index:0,elapsed:0};this.dialogueRow=group.rows[0];
      this.play(this.clips.find(clip=>clip.ClipName===group.animationName));return true;
    }
    const pool=this.clips.filter(c=>/^Talk_\d+_M$/.test(c.ClipName));
    const names=pool.length ? pool : this.clips.filter(c=>/^Talk_\d+$/.test(c.ClipName));
    if(names.length) { this.play(names[this.talkIndex++%names.length]); return true; }
    const fallback=this.model.animations.filter(a=>/^Talk/i.test(a.name) && !/_A$/.test(a.name));
    if(fallback.length) { const entry=this.playName(fallback[this.talkIndex++%fallback.length].name); entry.listener={complete:()=>this.idle()}; return true; }
    return false;
  }
  hit(point) {
    const hits=this.geometry.filter(g=>g.polygons.some(p=>pointInPolygon(point,p)));
    return hits.find(g=>/^Pat/.test(g.control.IngClip?.clip)) || hits[0] || null;
  }
  beginDrag(geometry,point) {
    if(!this.canInteract() || !geometry) return false;
    const control=geometry.control, bone=this.skeleton.findBone(control.boneName);
    if(!bone) return false;
    this.drag={control,bone,point:{...point},x:bone.x,y:bone.y,alpha:clamp(control.FollowDragSpeed01*this.delta/0.01666666753590107,0,1)};
    this.blockers.add(this.drag);
    this.returning=this.returning.filter(d=>d.bone!==bone);
    for(let track=1;track<this.state.tracks.length;track++)if(this.state.getCurrent(track))this.state.setEmptyAnimation(track,this.defaultMix);
    this.play(this.clip(control.IngClip)); return true;
  }
  stopDrag() {
    if(!this.drag) return;
    const drag=this.drag; this.drag=null;
    const ing=this.clip(drag.control.IngClip),end=this.clip(drag.control.EndClip);
    if(ing)this.state.setEmptyAnimation(ing.Track,ing.UseDefaultOutroMix ? this.defaultMix : ing.OutroMix);
    this.play(end);
    drag.alpha=clamp(drag.control.FollowReleaseSpeed01*this.delta/0.01666666753590107,0,1);
    drag.releaseTime=0;drag.endDuration=this.skeleton.data.findAnimation(end?.ClipName)?.duration || 0;
    this.returning.push(drag);
  }
  updateBones(delta) {
    if(delta>0)this.delta=delta;
    for(const drag of [...this.returning,...(this.drag ? [this.drag]:[])]) {
      const {control,bone}=drag, scale=this.config.skeletonData.scale;
      let destination={x:control.OrigLocalPos.x/scale,y:control.OrigLocalPos.y/scale};
      const active=drag===this.drag;
      if(active && bone.parent) {
        destination=bone.parent.worldToLocal({...drag.point});
        destination.x=clamp(destination.x+(control.BoneCenterOffset?.x || 0)/scale,control.MinLocalPos.x/scale,control.MaxLocalPos.x/scale);
        destination.y=clamp(destination.y+(control.BoneCenterOffset?.y || 0)/scale,control.MinLocalPos.y/scale,control.MaxLocalPos.y/scale);
      }
      const close=(drag.x-destination.x)**2+(drag.y-destination.y)**2<4.999999873689376e-05/(scale*scale);
      drag.x=close ? destination.x : drag.x+(destination.x-drag.x)*drag.alpha;
      drag.y=close ? destination.y : drag.y+(destination.y-drag.y)*drag.alpha;
      bone.x=drag.x; bone.y=drag.y;
      if(!active) {
        drag.releaseTime+=delta;
        if(close && drag.releaseTime>drag.endDuration) {
          this.returning=this.returning.filter(d=>d!==drag);this.blockers.delete(drag);
          this.returnToIdle();
        }
      }
    }
  }
  update(delta) {
    if(this.activeDialog) {
      const dialog=this.activeDialog;dialog.elapsed+=delta;
      while(dialog.index<dialog.group.rows.length && dialog.elapsed>=dialog.group.rows[dialog.index].duration/1000) {
        dialog.elapsed-=dialog.group.rows[dialog.index].duration/1000;dialog.index++;
      }
      this.dialogueRow=dialog.group.rows[dialog.index] || null;
      if(!this.dialogueRow)this.activeDialog=null;
    }
    this.updateBones(delta);
  }
}
