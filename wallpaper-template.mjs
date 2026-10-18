export const wallpaperHTML=()=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blue Archive Interactive Wallpaper</title><link rel="stylesheet" href="caption.css"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080c12;color:#edf6ff;font-family:Segoe UI,sans-serif}canvas{display:block;width:100%;height:100%;touch-action:none}#message{position:fixed;inset:0;display:grid;place-content:center;padding:25px;background:#0c1520;text-align:center}#message[hidden],#hint[hidden]{display:none}#hint{position:fixed;left:18px;bottom:16px;padding:9px 14px;border-radius:5px;background:#071321bb;font-size:12px;pointer-events:none}</style></head><body><canvas id="canvas" aria-label="Interactive character wallpaper"></canvas><audio id="voice" preload="auto"></audio><div id="subtitle" class="game-caption" aria-live="polite" hidden></div><div id="message" role="status">Loading character…</div><div id="hint" hidden>Click to talk · Hold and drag the head to pat · Drag other regions to move the gaze</div><script src="spine-webgl.min.js"></script><script src="data.js"></script><script src="wallpaper.js"></script></body></html>`;

export function wallpaperProject(model,preview=false) {
  return {title:`Blue Archive — ${model.displayName || model.folder} Interactive`,type:'web',file:'index.html',
    ...(preview ? {preview:'preview.jpg'} : {}),
    description:'Offline interactive Spine wallpaper with original animation settings, voice events and Japanese dialogue.',
    general:{properties:{
      soundenabled:{order:0,text:'Character voice',type:'bool',value:true},
      volume:{order:1,text:'Volume',type:'slider',value:80,min:0,max:100},
      interactive:{order:2,text:'Mouse interaction',type:'bool',value:true},
      zoom:{order:3,text:'Zoom',type:'slider',value:1,min:0.6,max:1.8,fraction:true,precision:2},
      showhint:{order:4,text:'Show controls',type:'bool',value:false}
    }}};
}

export const wallpaperReadme=(model,voices,drags)=>`# ${model.folder} — Wallpaper Engine

Extract this ZIP into its own folder. Drag index.html into Create Wallpaper in Wallpaper Engine.
Keep every file together. This wallpaper works offline without the viewer or Node.js.

Click the character to talk. Hold and drag the head to pat, or drag other available regions.
The scene must finish its intro before interactions become available.
Voice, volume, interaction, zoom and control hints are available in wallpaper properties.
Wallpaper Engine FPS and pause/resume callbacks are supported.

Includes ${voices} original voice files and ${drags} original drag controls.
Dialogue remains in the original Japanese; viewer controls are English.

This is a reconstruction using original assets and recovered settings/formulas.
Unity timelines, post-processing, gyro, account/season conditions, all random-idle behavior,
and full NGUI text/tween behavior are not reproduced. It is not verified as 100% identical.
Wallpaper Engine native-host testing is still pending.

Import guide: https://docs.wallpaperengine.io/en/web/first/gettingstarted.html
`;
