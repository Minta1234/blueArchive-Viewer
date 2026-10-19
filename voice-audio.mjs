import {voiceForEvent} from './interaction.mjs';

export function sceneVoiceFiles(skeletonData,voices) {
  return [...new Set(skeletonData.animations.flatMap(animation=>animation.timelines.flatMap(timeline=>
    (timeline.events || []).map(event=>voiceForEvent(event,voices)))).filter(Boolean))];
}

// Keep only the selected scene, with four concurrent requests and a bounded loading deadline.
export class SceneVoiceAudio {
  constructor({contextFactory=()=>new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
    mediaFactory=()=>new Audio(),fetcher=globalThis.fetch,resolveURL=file=>file,
    protocol=globalThis.location?.protocol,timeout=20000,onState=()=>{},onError=console.warn}={}) {
    const rawFetcher=fetcher || globalThis.fetch;
    const safeFetcher=typeof rawFetcher==='function' ? rawFetcher.bind(globalThis) : (...args)=>globalThis.fetch(...args);
    Object.assign(this,{mediaFactory,fetcher:safeFetcher,resolveURL,protocol,timeout,onState,onError});
    try {this.context=contextFactory();this.gain=this.context.createGain();this.gain.connect(this.context.destination);}
    catch(error){this.context=null;onError(error);}
    this.cache=new Map();this.loading=null;this.current=null;this.muted=false;this.paused=false;this.volume=1;
  }
  unlock() {
    if(this.context?.state==='suspended')this.context.resume().catch(error=>this.onError(error));
  }
  reset() {
    this.loading?.abort();this.stop();
    for(const clip of this.cache.values())if(clip.media){clip.media.pause();clip.media.removeAttribute('src');clip.media.load();}
    this.cache.clear();
  }
  async prepare(files) {
    this.reset();
    const load=new AbortController();this.loading=load;
    const timer=setTimeout(()=>load.abort(),this.timeout),queue=[...new Set(files)];
    let next=0;
    const failures=[];
    const worker=async()=>{
      while(next<queue.length && !load.signal.aborted) {
        const file=queue[next++];
        try {
          const url=this.resolveURL(file);
          let clip;
          if(this.context && this.protocol!=='file:') {
            const response=await (this.fetcher || globalThis.fetch).call(globalThis,url,{signal:load.signal});
            if(!response.ok)throw new Error(`Voice HTTP ${response.status}: ${file}`);
            const bytes=await response.arrayBuffer();
            if(load.signal.aborted)return;
            clip={buffer:await this.context.decodeAudioData(bytes)};
          } else clip={media:await this.preloadMedia(url,load.signal)};
          if(!load.signal.aborted && this.loading===load)this.cache.set(file,clip);
          else if(clip.media){clip.media.removeAttribute('src');clip.media.load();}
        } catch(error) {if(!load.signal.aborted){failures.push(file);this.onError(error);}}
      }
    };
    try {await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));}
    finally {clearTimeout(timer);}
    return {ready:this.loading===load ? this.cache.size : 0,total:queue.length,failures,timedOut:load.signal.aborted};
  }
  preloadMedia(url,signal) {
    return new Promise((resolve,reject)=>{
      const media=this.mediaFactory();media.preload='auto';
      const cleanup=()=>{media.removeEventListener('canplaythrough',ready);media.removeEventListener('error',fail);signal.removeEventListener('abort',abort);};
      const ready=()=>{cleanup();resolve(media);};
      const fail=()=>{cleanup();media.removeAttribute('src');media.load();reject(new Error(`Cannot preload voice: ${url}`));};
      const abort=()=>{cleanup();media.removeAttribute('src');media.load();reject(new DOMException('Voice loading cancelled','AbortError'));};
      media.addEventListener('canplaythrough',ready);media.addEventListener('error',fail);signal.addEventListener('abort',abort,{once:true});
      media.src=url;media.load();
      if(signal.aborted)abort();else if(media.readyState>=4)ready();
    });
  }
  setVolume(value) {
    this.volume=Math.max(0,Math.min(1,value));
    if(this.gain)this.gain.gain.value=this.volume;
    if(this.current?.clip.media)this.current.clip.media.volume=this.volume;
  }
  setMuted(muted) {this.muted=muted;if(muted)this.stop();}
  setPaused(paused) {
    if(paused===this.paused)return;
    this.paused=paused;
    const current=this.current;
    if(!current)return;
    if(paused) {
      if(current.source){current.offset+=this.context.currentTime-current.started;current.source.onended=null;current.source.stop();current.source.disconnect();current.source=null;}
      current.clip.media?.pause();this.onState(false);
    } else this.start(current);
  }
  stop() {
    const current=this.current;this.current=null;
    if(current?.source){current.source.onended=null;current.source.stop();current.source.disconnect();}
    if(current?.clip.media){current.clip.media.pause();current.clip.media.onended=null;current.clip.media.onplaying=null;}
    this.onState(false);
  }
  play(file) {
    this.stop();
    const clip=this.cache.get(file);
    // Never fetch at an animation event: late audio would belong to an earlier frame or scene.
    if(!clip || this.muted || this.paused)return false;
    this.current={clip,offset:0,source:null};
    return this.start(this.current);
  }
  start(current) {
    if(current!==this.current || this.muted || this.paused)return false;
    const ended=()=>{if(this.current===current)this.stop();};
    if(current.clip.buffer) {
      if(this.context.state!=='running') {
        this.current=null;this.onError(new DOMException('Click the scene to enable audio','NotAllowedError'));return false;
      }
      if(current.offset>=current.clip.buffer.duration){ended();return false;}
      const source=this.context.createBufferSource();source.buffer=current.clip.buffer;source.connect(this.gain);
      current.source=source;current.started=this.context.currentTime;source.onended=ended;source.start(0,current.offset);this.onState(true);
    } else {
      const media=current.clip.media;media.volume=this.volume;
      if(!current.started){media.currentTime=0;current.started=true;}
      media.onended=ended;media.onplaying=()=>{if(this.current===current)this.onState(true);else media.pause();};
      media.play().catch(error=>{if(this.current===current){this.stop();if(error.name!=='AbortError')this.onError(error);}});
    }
    return true;
  }
}
