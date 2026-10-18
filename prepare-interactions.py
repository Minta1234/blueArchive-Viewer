"""Join original serialized clip/prefab references; preserve their provenance."""
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).parent / 'data'
source = json.loads((ROOT / 'original-lobby-configs.json').read_text(encoding='utf-8'))
models = json.loads((ROOT / 'models.json').read_text(encoding='utf-8'))


def key(ref):
    return ref['file'] + ':' + ref['pathId'] if ref else None


assets = {key(a): a for a in source['assets']}
result = {}
for model in models:
    if model['category'] != 'SpineLobbies':
        continue
    folder = 'Assets/_MX/' + str(PurePosixPath(model['skeleton']).parent)
    candidates = [a for a in source['assets'] if 'skeletonJSON' in a and a.get('assetPath', '').startswith(folder + '/')]
    if not candidates:
        continue
    skeleton_data = candidates[0]
    clips = {key(a): a for a in source['assets'] if a.get('ClipName') and key(a.get('skeletonDataAsset')) == key(skeleton_data)}
    prefabs = []
    for prefab in source['prefabs']:
        for controller in prefab['components']:
            if 'spineClipPool' in controller and key(controller.get('skeletonDataAsset')) == key(skeleton_data):
                drags = [c for c in prefab['components'] if 'IngClip' in c and c.get('SpineController', {}).get('pathId') == controller['pathId']]
                prefabs.append((prefab, controller, drags))
    if prefabs:
        prefab, controller, drags = max(prefabs, key=lambda p: len(p[2]))
        result[model['id']] = {'sourceBundle': prefab['sourceBundle'], 'prefabPaths': prefab['prefabPaths'],
            'skeletonData': skeleton_data, 'clips': clips, 'controller': controller, 'drags': drags}
    else:
        result[model['id']] = {'sourceBundle': skeleton_data['sourceBundle'], 'skeletonData': skeleton_data,
                              'clips': clips, 'controller': {}, 'drags': []}

(ROOT / 'interactions.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
assert result['SpineLobbies/Airi_home/Airi_home']['drags']
assert any(a['ClipName'] == 'Pat_01_M' and a['Track'] == 1 for a in result['SpineLobbies/Airi_home/Airi_home']['clips'].values())
print(json.dumps({'models_with_original_config': len(result), 'with_drag': sum(bool(c['drags']) for c in result.values())}))
