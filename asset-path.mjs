export function assetURL(relative,base) {
  if(typeof relative!=='string' || relative.startsWith('/') || /[\\\0]/.test(relative)
    || relative.split('/').some(part=>part==='..' || part==='.' || part===''))throw new Error('Unsafe asset path');
  return base.replace(/\/?$/,'/')+relative.split('/').map(encodeURIComponent).join('/');
}
