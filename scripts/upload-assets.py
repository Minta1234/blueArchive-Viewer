"""Upload the original archive to a dedicated branch in bounded Git pushes."""
import argparse,json,os,shutil,subprocess,tempfile
from pathlib import Path

def run(directory,*args,capture=False):
 result=subprocess.run(['git','-C',str(directory),*args],check=True,text=True,
                       stdout=subprocess.PIPE if capture else None)
 return result.stdout.strip() if capture else ''

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--models',type=Path,required=True)
 parser.add_argument('--audio',type=Path,required=True)
 parser.add_argument('--dry-run',action='store_true')
 args=parser.parse_args()
 repo=Path(__file__).resolve().parent.parent
 target=repo.parent/(repo.name+'-assets-upload')
 assert target.parent==repo.parent and target!=repo
 records=[]
 for source in args.models.rglob('*'):
  if source.is_file() and source.suffix in ('.png','.skel','.atlas'):
   assert not source.is_symlink()
   records.append((source,'models/'+source.relative_to(args.models).as_posix(),source.stat().st_size))
 for source in args.audio.glob('*.ogg'):
  assert not source.is_symlink()
  records.append((source,'audio/'+source.name,source.stat().st_size))
 assert records and len({r[1] for r in records})==len(records)
 assert max(r[2] for r in records)<100*1024*1024
 records.sort(key=lambda r:('CH0335_home/' not in r[1],'SpineLobbies/' not in r[1],r[1]))
 total=sum(r[2] for r in records)
 print(json.dumps({'files':len(records),'bytes':total,'branch':'assets','directory':str(target)}),flush=True)
 if args.dry_run:return
 remote=run(repo,'remote','get-url','origin',capture=True)
 if not (target/'.git').exists():
  if target.exists() and any(target.iterdir()):raise RuntimeError('Upload directory is not empty')
  target.mkdir(exist_ok=True)
  run(target,'init','-b','assets');run(target,'remote','add','origin',remote)
 else:
  assert run(target,'remote','get-url','origin',capture=True)==remote
  assert run(target,'branch','--show-current',capture=True)=='assets'
 for name,value in [('core.compression','1'),('pack.window','0'),('gc.auto','0')]:run(target,'config','--local',name,value)
 for name in ['user.name','user.email']:
  value=run(repo,'config',name,capture=True)
  run(target,'config','--local',name,value)
 (target/'README.md').write_text('# Blue Archive viewer assets\n\nOriginal exported Spine models, atlases, textures and voice clips.\nThe viewer source and GitHub Pages deployment live on the main branch.\n',encoding='utf8')
 (target/'.gitattributes').write_text('* -delta\n',encoding='ascii')
 for source,relative,size in records:
  dest=target/relative
  if not dest.exists():
   dest.parent.mkdir(parents=True,exist_ok=True)
   try:os.link(source,dest)
   except OSError:shutil.copy2(source,dest)
  assert dest.stat().st_size==size
 existing=set(run(target,'ls-files',capture=True).splitlines())
 pending=[r for r in records if r[1] not in existing]
 sent=sum(r[2] for r in records if r[1] in existing)
 if existing:run(target,'push','--quiet','origin','HEAD:assets')
 batch=[];size=0;number=0
 def push_batch(batch):
  nonlocal sent,number
  number+=1
  paths=[r[1] for r in batch]+['README.md','.gitattributes']
  with tempfile.NamedTemporaryFile(dir=target,suffix='.pathspec',delete=False) as spec:
   spec.write(b'\0'.join(path.encode('utf8') for path in paths)+b'\0');specpath=Path(spec.name)
  try:run(target,'add','--pathspec-from-file='+str(specpath),'--pathspec-file-nul')
  finally:specpath.unlink()
  print(f'Committing batch {number}: {len(batch)} files, {sum(r[2] for r in batch)/1048576:.1f} MiB',flush=True)
  run(target,'commit','--quiet','-m',f'Add original viewer assets batch {number}')
  print(f'Pushing batch {number}...',flush=True)
  run(target,'push','--quiet','origin','HEAD:assets')
  sent+=sum(r[2] for r in batch)
  print(f'Uploaded {sent}/{total} bytes ({sent/total:.1%})',flush=True)
 for record in pending:
  if batch and size+record[2]>600*1024*1024:push_batch(batch);batch=[];size=0
  batch.append(record);size+=record[2]
 if batch:push_batch(batch)
 manifest={'formatVersion':1,'complete':True,'files':len(records),'bytes':total,
           'inventory':[{'path':r[1],'bytes':r[2]} for r in records]}
 (target/'asset-manifest.json').write_text(json.dumps(manifest,separators=(',',':')),encoding='utf8')
 run(target,'add','asset-manifest.json')
 if subprocess.run(['git','-C',str(target),'diff','--cached','--quiet']).returncode:
  run(target,'commit','--quiet','-m','Record complete asset inventory')
 run(target,'push','--quiet','origin','HEAD:assets')
 print('ASSETS_COMPLETE '+run(target,'rev-parse','HEAD',capture=True),flush=True)

if __name__=='__main__':main()
