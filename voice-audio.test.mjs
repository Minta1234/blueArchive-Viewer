import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneVoiceAudio,sceneVoiceFiles} from './voice-audio.mjs';

function fixture(options={}) {
  const starts=[],errors=[],requests=[];
  const context={state:'running',currentTime:0,destination:{},
    createGain:()=>({connect(){},gain:{value:1}}),
    decodeAudioData:async()=>({duration:10}),
    resume:async()=>{context.state='running';},
    createBufferSource:()=>({connect(){},disconnect(){},stop(){},start(...args){starts.push(args);}})};
  const audio=new SceneVoiceAudio({contextFactory:()=>context,protocol:'https:',
    fetcher:async file=>{requests.push(file);return new Response(new Uint8Array([1]));},
    onError:error=>errors.push(error),...options});
  return {audio,context,starts,errors,requests};
}

test('voice event payloads are deduplicated; predecoded playback never downloads at an animation event',async()=>{
  const data={animations:[{timelines:[{events:[{stringValue:'line',data:{name:'Talk'}},{stringValue:'line',data:{name:'Talk'}}]},{}]}]};
  assert.deepEqual(sceneVoiceFiles(data,{line:'voice.ogg'}),['voice.ogg']);
  const {audio,requests,starts,context}=fixture();
  assert.equal((await audio.prepare(['voice.ogg','voice.ogg'])).ready,1);
  assert.equal(audio.play('voice.ogg'),true);
  context.currentTime=2;audio.setPaused(true);audio.setPaused(false);
  assert.deepEqual(starts,[[0,0],[0,2]]);
  audio.setMuted(true);assert.equal(audio.play('voice.ogg'),false);
  assert.equal(audio.play('missing.ogg'),false);
  assert.deepEqual(requests,['voice.ogg']);
});

test('a model switch discards a decode that finishes after the new scene is ready',async()=>{
  let finishDecode;
  const {audio,context}=fixture();
  context.decodeAudioData=()=>new Promise(resolve=>{finishDecode=resolve;});
  const old=audio.prepare(['old.ogg']);
  while(!finishDecode)await new Promise(resolve=>setImmediate(resolve));
  context.decodeAudioData=async()=>({duration:10});
  await audio.prepare(['new.ogg']);finishDecode({duration:10});await old;
  assert.deepEqual([...audio.cache.keys()],['new.ogg']);
  assert.equal(audio.play('old.ogg'),false);
});

test('failed voices are reported; a locked audio context cannot queue stale playback',async()=>{
  const {audio,context,errors,starts}=fixture({fetcher:async()=>new Response('',{status:404})});
  const result=await audio.prepare(['missing.ogg']);
  assert.deepEqual(result.failures,['missing.ogg']);assert.equal(errors.length,1);
  audio.cache.set('ready.ogg',{buffer:{duration:10}});context.state='suspended';
  assert.equal(audio.play('ready.ogg'),false);assert.equal(audio.current,null);
  audio.unlock();await Promise.resolve();assert.equal(starts.length,0);
  assert.equal(audio.play('ready.ogg'),true);
});

test('offline file wallpapers preload media without fetch and release sources on reset',async()=>{
  class Media extends EventTarget {
    constructor(){super();this.readyState=0;this.loads=0;}
    load(){this.loads++;if(this.src)queueMicrotask(()=>{this.readyState=4;this.dispatchEvent(new Event('canplaythrough'));});}
    removeAttribute(){this.src='';}
    play(){this.onplaying?.();return Promise.resolve();}
    pause(){}
  }
  const media=new Media();
  const {audio,requests}=fixture({protocol:'file:',mediaFactory:()=>media});
  assert.equal((await audio.prepare(['audio/line.ogg'])).ready,1);
  audio.play('audio/line.ogg');assert.equal(media.currentTime,0);assert.equal(requests.length,0);
  audio.reset();assert.equal(media.src,'');assert.equal(audio.cache.size,0);
});
