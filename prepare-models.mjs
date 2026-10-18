import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextureAtlas, AtlasAttachmentLoader, SkeletonBinary } from '@esotericsoftware/spine-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, '../Live2D_Export');
const records = fs.readFileSync(path.join(assets, 'manifest.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const files = [...new Set(records.map(r => r.output))];
const models = [], failures = [];
for (const relative of files.filter(p => p.endsWith('.skel'))) {
  const directory = path.posix.dirname(relative);
  const candidates = files.filter(p => p.endsWith('.atlas') && path.posix.dirname(p) === directory);
  for (const shared of files.filter(p => p.endsWith('.atlas') && path.posix.basename(p, '.atlas') === path.posix.basename(relative, '.skel'))) {
    if (!candidates.includes(shared)) candidates.push(shared);
  }
  candidates.sort((a, b) => Number(b === relative.replace(/\.skel$/, '.atlas')) - Number(a === relative.replace(/\.skel$/, '.atlas')));
  let parsed, atlasPath, lastError;
  for (const candidate of candidates) {
    try {
      const atlas = new TextureAtlas(fs.readFileSync(path.join(assets, candidate), 'utf8'));
      parsed = new SkeletonBinary(new AtlasAttachmentLoader(atlas)).readSkeletonData(fs.readFileSync(path.join(assets, relative)));
      atlasPath = candidate;
      break;
    } catch (error) { lastError = error.message; }
  }
  if (!parsed) { failures.push({ skeleton: relative, error: lastError || 'No atlas' }); continue; }
  models.push({ id: relative.slice(0, -5), name: path.posix.basename(relative, '.skel'),
    folder: path.posix.basename(directory), category: relative.split('/')[0],
    skeleton: relative, atlas: atlasPath, version: parsed.version,
    animations: parsed.animations.map(a => ({ name: a.name, duration: a.duration })),
    skins: parsed.skins.map(s => s.name),
    events: parsed.events.map(e => ({ name: e.name, stringValue: e.stringValue, audioPath: e.audioPath })),
    width: parsed.width, height: parsed.height, x: parsed.x, y: parsed.y });
}
fs.mkdirSync(path.join(here, 'data'), { recursive: true });
fs.writeFileSync(path.join(here, 'data/models.json'), JSON.stringify(models));
fs.writeFileSync(path.join(here, 'data/model-parse-errors.json'), JSON.stringify(failures, null, 2));
console.log(JSON.stringify({ models: models.length, lobbies: models.filter(m => m.category === 'SpineLobbies').length,
  failures: failures.length, lobbyFailures: failures.filter(f => f.skeleton.startsWith('SpineLobbies')) }, null, 2));
if (failures.length) process.exitCode = 1;
