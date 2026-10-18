"""Keep the original scene coordinates needed by both browser runtimes."""
import json
from pathlib import Path
root=Path(__file__).parent/'data'
source=json.loads((root/'scene-layouts.json').read_text(encoding='utf8'))
configs=json.loads((root/'interactions.json').read_text(encoding='utf8'))
def chain(value):
 return [{key:t[key] for key in ('name','position','rotation','scale')} for t in value]
models={}
for model,scene in source['models'].items():
 controller=configs[model]['controller'].get('pathId')
 touches=[]
 for touch in scene['bodyTouches']:
  if touch['SpineCharacter']['pathId']!=controller or not touch.get('m_Enabled'):continue
  for collider in touch['colliders']:
   if collider.get('m_Enabled') and all(t.get('active',True) for t in collider['transformChain']):
    touches.append({**{k:collider[k] for k in ('type','m_Size','m_Center') if k in collider},'transformChain':chain(collider['transformChain'])})
 boxes=[]
 for dialog in scene['dialogs'][:1]:
  for box in dialog['DialogBoxes']:
   label,bg=box.get('Text'),box.get('Bg')
   if not label or not bg:continue
   boxes.append({'type':box['Type'],'transformChain':chain(box['GameObject']['transformChain']),
     'label':{**{k:label[k] for k in ('mFontSize','mColor','mPivot','mOverflowWidth','mSpacingX','mSpacingY')},'transformChain':chain(label['transformChain'])},
     'background':{**{k:bg[k] for k in ('mSpriteName','mFlip','mPivot')},'padding':{side:bg[side+'Anchor']['absolute'] for side in ('left','right','bottom','top')}}})
 models[model]={'bodyTouches':touches,'dialogBoxes':boxes}
record=source['uiRoot']['records'][0]
out={'formatVersion':1,'uiRoot':{k:record[k] for k in ('manualWidth','manualHeight','fitWidth','fitHeight','scalingStyle')},'models':models}
assert out['uiRoot']['manualWidth']==2960 and out['uiRoot']['manualHeight']==1440
assert models['SpineLobbies/CH0335_home/CH0335_home']['bodyTouches'][0]['m_Size']['x']==600
(root/'scenes.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('Prepared',len(models),'scene layouts')
