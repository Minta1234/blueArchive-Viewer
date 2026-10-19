import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {unzipSync,strFromU8} from 'fflate';
import {assetURL} from './asset-path.mjs';
import {exportInBrowser} from './browser-export.mjs';
import {gameViewport} from './interaction.mjs';
import {createServer} from './server.mjs';

test('asset paths remain inside the selected public archive',()=>{
  assert.equal(assetURL('SpineLobbies/Model name/a.png','https://example.com/assets'),'https://example.com/assets/SpineLobbies/Model%20name/a.png');
  for(const path of ['../outside','/outside','a/../b','a\\b','a\0b','https://other.test/file','a//b'])assert.throws(()=>assetURL(path,'./'),/Unsafe/);
});

test('static Pages build has English controls, relative paths and browser export settings',async()=>{
  const html=await fs.readFile('dist/index.html','utf8');
  assert.match(html,/lang="en"/);assert.match(html,/Export Wallpaper Engine/);assert.match(html,/Head pat/);
  for(const file of ['dist/index.html','dist/app.js','dist/wallpaper.js'])assert.doesNotMatch(await fs.readFile(file,'utf8'),/[\u0e00-\u0e7f]/);
  assert.ok(!html.includes('src="/'));assert.ok(!html.includes('node_modules'));
  const script=await fs.readFile('dist/site-config.js','utf8');
  const config=JSON.parse(script.slice(script.indexOf('=')+1).trim().replace(/;$/,''));
  assert.equal(config.exportMode,'browser');assert.match(config.assetBase,/raw\.githubusercontent\.com\/Minta1234\/blueArchive-Viewer\/assets\/models\/$/);
  for(const file of ['app.js','wallpaper.js','vendor/spine-webgl.min.js','ui/GameJP-Medium.otf','ui/Lobby_balloon.png'])assert.ok((await fs.stat('dist/'+file)).size>100);
  await assert.rejects(fs.stat('dist/audio'));
  await assert.rejects(fs.stat('dist/data/original-lobby-configs.json'));
});

test('deployed catalog retains every readable model and all lobby interaction configs',async()=>{
  const read=async file=>JSON.parse(await fs.readFile('dist/data/'+file,'utf8'));
  const models=await read('models.json'),configs=await read('interactions.json'),scenes=await read('scenes.json'),dialogues=await read('dialogues.json');
  assert.equal(models.length,931);assert.equal(models.filter(m=>m.category==='SpineLobbies').length,294);
  for(const model of models.filter(m=>m.category==='SpineLobbies')){assert.ok(configs[model.id]);assert.ok(scenes.models[model.id]);}
  const id='SpineLobbies/CH0335_home/CH0335_home';
  assert.equal(dialogues.byModel[id].characterId,10135);assert.equal(dialogues.byModel[id].groups[0].rows[0].text,'心配しないでください。');
  assert.deepEqual(gameViewport(16/9),{width:2960,height:1665});
});

test('static preview serves only the deploy artifact and never invokes a Node export API',async()=>{
  const server=createServer({staticSite:true});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/lang="en"/);
    assert.equal((await fetch(base+'/app.js')).status,200);
    assert.equal((await fetch(base+'/server.mjs')).status,404);
    assert.equal((await fetch(base+'/audio/original.ogg')).status,404);
    assert.equal((await fetch(base+'/api/export',{method:'POST'})).status,405);
  }finally {await new Promise(resolve=>server.close(resolve));}
});

test('browser-only ZIP preserves binary assets, original dialogue, local runtime and voice selection',async()=>{
  const originalFetch=globalThis.fetch,requests=[];
  const binary=Uint8Array.from({length:70000},(_,i)=>i%256),image=new Uint8Array([137,80,78,71,13,10,26,10]);
  const assets=new Map([
    ['https://assets.example.test/models/test/model.skel',binary],
    ['https://assets.example.test/models/test/model.atlas',new TextEncoder().encode('page.png\nsize: 1,1\n')],
    ['https://assets.example.test/models/test/page.png',image],
    ['https://assets.example.test/audio/original.ogg',new TextEncoder().encode('OggS-original')]
  ]);
  for(const file of ['caption.css','ui/Lobby_balloon.png','ui/Lobby_balloon2.png','ui/GameJP-Medium.otf','wallpaper.js','vendor/spine-webgl.min.js','vendor/SPINE-RUNTIME-LICENSE.txt'])assets.set('https://site.example.test/project/'+file,new Uint8Array(await fs.readFile('dist/'+file)));
  globalThis.fetch=async url=>{requests.push(String(url));return assets.has(String(url)) ? new Response(assets.get(String(url))) : new Response('',{status:404});};
  const scene={model:{id:'test',folder:'test',skeleton:'test/model.skel',atlas:'test/model.atlas',events:[]},config:{drags:[]},layout:{bodyTouches:[]},workScene:{actors:[{stateName:'Sleep'}]},
    atlas:{pages:[{name:'page.png'}]},skeleton:{data:{animations:[{timelines:[{events:[{stringValue:'OriginalVoice',data:{name:'Talk'}}]}]}]}}};
  const args={scene,voices:{OriginalVoice:'audio/original.ogg',Unused:'audio/not-selected.ogg'},dialogue:{groups:[{rows:[{text:'心配しないでください。'}]}]},uiRoot:{manualWidth:2960,manualHeight:1440},
    assetBase:'https://assets.example.test/models/',audioBase:'https://assets.example.test/',siteBase:'https://site.example.test/project/',preview:'data:image/jpeg;base64,/9j/2Q=='};
  try{
    const result=await exportInBrowser(args),files=unzipSync(new Uint8Array(await result.blob.arrayBuffer()));
    assert.equal(result.filename,'test-WallpaperEngine.zip');assert.equal(result.audioFiles,1);
    const payload=JSON.parse(strFromU8(files['data.js']).slice('window.WALLPAPER_DATA='.length).trim().replace(/;$/,''));
    assert.deepEqual(Buffer.from(payload.binary,'base64'),Buffer.from(binary));
    assert.deepEqual(files['textures/page.png'],image);
    assert.equal(payload.dialogue.groups[0].rows[0].text,'心配しないでください。');
    assert.deepEqual(payload.workScene,scene.workScene);
    assert.ok(files['ui/GameJP-Medium.otf'].length>7000000);assert.ok(files['preview.jpg']);
    const project=JSON.parse(strFromU8(files['project.json']));assert.equal(project.file,'index.html');assert.equal(project.preview,'preview.jpg');
    assert.equal(project.general.properties.interactive.value,true);
    assert.match(strFromU8(files['index.html']),/lang="en"/);
    assert.ok(!requests.some(url=>url.includes('/api/export') || url.includes('not-selected')));
    assert.ok(!strFromU8(files['wallpaper.js']).includes('127.0.0.1'));
    assets.delete('https://assets.example.test/models/test/page.png');
    await assert.rejects(exportInBrowser(args),/Download failed \(404\)/);
  }finally{globalThis.fetch=originalFetch;}
});
