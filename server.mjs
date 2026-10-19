import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {exportWallpaper,exportRoot} from './export-wallpaper.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.resolve(here, '../Live2D_Export');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.atlas': 'text/plain', '.skel': 'application/octet-stream',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.md': 'text/plain; charset=utf-8', '.zip':'application/zip', '.otf':'font/otf' };

export function resolveRequest(raw,siteRoot=here) {
  const name = decodeURIComponent(raw.split('?')[0]);
  if (name.includes('\0') || name.includes('\\') || name.split('/').includes('..')) throw new Error('Invalid path');
  const root = siteRoot!==here ? siteRoot : name.startsWith('/assets/') ? assets : name.startsWith('/exports/') ? exportRoot : here;
  const relative = siteRoot!==here ? name.slice(1) || 'index.html' : name.startsWith('/assets/') ? name.slice(8) : name.startsWith('/exports/') ? name.slice(9) : name.slice(1) || 'index.html';
  const target = path.resolve(root, relative);
  if (path.relative(root, target).startsWith('..') || path.isAbsolute(path.relative(root, target))) throw new Error('Invalid path');
  return { root, target };
}

export function createServer({staticSite=false}={}) {
  const siteRoot=staticSite ? path.join(here,'dist') : here;
  let exporting=false;
  return http.createServer(async (req, res) => {
    if(!staticSite && req.url==='/api/export' && req.method==='POST'){
      const reply=(status,data)=>res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(data));
      if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '') || req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'Export requires the local viewer origin'});
      if(!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))return reply(415,{error:'Expected JSON'});
      if(exporting)return reply(409,{error:'Another export is running'});
      let raw='',size=0;
      try{
        for await(const chunk of req){size+=chunk.length;if(size>8*1024*1024){reply(413,{error:'Export request too large'});return;}raw+=chunk.toString('utf8');}
        const body=JSON.parse(raw);
        if(!body || typeof body.modelId!=='string')return reply(400,{error:'Expected modelId'});
        if(exporting)return reply(409,{error:'Another export is running'});
        exporting=true;
        try{return reply(200,await exportWallpaper(body.modelId,{preview:body.preview}));}
        finally{exporting=false;}
      }catch(error){return reply(400,{error:error.message});}
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
    if (req.url === '/favicon.ico') { res.writeHead(204).end(); return; }
    try {
      const { root, target } = resolveRequest(req.url,siteRoot);
      const real = await fsp.realpath(target);
      if (path.relative(root, real).startsWith('..')) { res.writeHead(403).end(); return; }
      const stat = await fsp.stat(real);
      if (!stat.isFile()) { res.writeHead(404).end(); return; }
      let start = 0, end = stat.size - 1, status = 200;
      if (req.headers.range) {
        const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        if (!range) { res.writeHead(416).end(); return; }
        start = Number(range[1]); end = range[2] ? Number(range[2]) : end;
        if (start > end || end >= stat.size) { res.writeHead(416).end(); return; }
        status = 206;
        res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      res.writeHead(status, { 'Content-Type': mime[path.extname(real)] || 'application/octet-stream',
        'Content-Length': stat.size ? end - start + 1 : 0, 'Accept-Ranges': 'bytes',
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD' || !stat.size) { res.end(); return; }
      const stream = fs.createReadStream(real, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 400).end('File unavailable');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const staticSite=process.argv.includes('--static'),server=createServer({staticSite});
  const port = Number(process.env.PORT || (staticSite ? 4318 : 4317));
  server.on('error', error => { console.error(`Cannot start viewer: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Blue Archive viewer: http://127.0.0.1:${port}`));
}
