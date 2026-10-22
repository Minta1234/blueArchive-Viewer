export function dialogueText(text) {
  return text.replace(/<br\s*\/?>/gi,'\n').replace(/<\/?(?:color|size|b|i)(?:=[^>]*)?>/gi,'')
    .replace(/\[(?:[0-9a-f]{6}|-|\/?)\]/gi,'');
}
import {chainMatrix,transform,multiply,inverse} from './interaction.mjs';

export function renderCaption(element,row,layout,view,width,height,zoom=1) {
  if(!row){element.hidden=true;element.textContent='';return;}
  const text=dialogueText(row.text);
  element.hidden=false;
  let label=element.firstElementChild;
  if(!label){label=document.createElement('span');element.replaceChildren(label);}
  if(label.textContent!==text)label.textContent=text;

  if(row.isStand) {
    const scale = Math.max(0.65, Math.min(1.2, height / 1080));
    element.style.left = '7%';
    element.style.bottom = '12%';
    element.style.top = 'auto';
    element.style.transform = 'none';
    element.style.fontSize = `${Math.round(22 * scale)}px`;
    element.style.lineHeight = `${Math.round(30 * scale)}px`;
    element.style.letterSpacing = '0.5px';
    element.style.maxWidth = `${Math.round(480 * scale)}px`;
    element.style.color = '#253545';
    element.style.setProperty('--balloon','url("ui/Lobby_balloon.png")');
    element.style.setProperty('--slice','84 50 60 80');
    element.style.setProperty('--border-width',`${24*scale}px ${18*scale}px ${20*scale}px ${24*scale}px`);
    element.style.setProperty('--pad-left',`${22*scale}px`);
    element.style.setProperty('--pad-right',`${-22*scale}px`);
    element.style.setProperty('--pad-bottom',`${18*scale}px`);
    element.style.setProperty('--pad-top',`${-18*scale}px`);
    element.style.setProperty('--flip-x',1);
    element.style.setProperty('--flip-y',1);
    return;
  }

  if(row.isBackground && row.point && view.width) {
    const scale = Math.max(0.6, Math.min(1.2, height / 1080));
    const screenX = 50 + (row.point.x - view.x) / (view.width / zoom) * 100;
    const screenY = 50 - (row.point.y - view.y) / (view.height / zoom) * 100;
    element.style.left = `${Math.max(5, Math.min(85, screenX))}%`;
    element.style.top = `${Math.max(10, Math.min(85, screenY - 5))}%`;
    element.style.bottom = 'auto';
    element.style.transform = 'translate(-40%, -100%)';
    element.style.fontSize = `${Math.round(20 * scale)}px`;
    element.style.lineHeight = `${Math.round(28 * scale)}px`;
    element.style.letterSpacing = '0.5px';
    element.style.maxWidth = `${Math.round(380 * scale)}px`;
    element.style.color = '#253545';
    element.style.setProperty('--balloon','url("ui/Lobby_balloon.png")');
    element.style.setProperty('--slice','84 50 60 80');
    element.style.setProperty('--border-width',`${22*scale}px ${16*scale}px ${18*scale}px ${22*scale}px`);
    element.style.setProperty('--pad-left',`${20*scale}px`);
    element.style.setProperty('--pad-right',`${-20*scale}px`);
    element.style.setProperty('--pad-bottom',`${16*scale}px`);
    element.style.setProperty('--pad-top',`${-16*scale}px`);
    element.style.setProperty('--flip-x',1);
    element.style.setProperty('--flip-y',1);
    return;
  }

  const box=layout?.dialogBoxes.find(box=>box.type===row.dialogType) || layout?.dialogBoxes[0];
  if(!box || !view.uiWidth){element.textContent=text;return;}
  let matrix=chainMatrix(box.label.transformChain);
  if(row.applyPosition) {
    const chain=box.transformChain.map((t,index)=>index===0 ? {...t,position:{...t.position,x:row.posX,y:row.posY}} : t);
    matrix=multiply(multiply(chainMatrix(chain),inverse(chainMatrix(box.transformChain))),matrix);
  }
  const point=transform(matrix,{x:0,y:0});
  const scale=height/view.uiHeight*zoom,color=box.label.mColor,padding=box.background.padding;
  element.style.left=`${50+point.x/view.uiWidth*zoom*100}%`;
  element.style.bottom=`${50+point.y/view.uiHeight*zoom*100}%`;
  element.style.top='auto';
  element.style.fontSize=`${box.label.mFontSize*scale}px`;
  element.style.lineHeight=`${(box.label.mFontSize+box.label.mSpacingY)*scale}px`;
  element.style.letterSpacing=`${box.label.mSpacingX*scale}px`;
  element.style.maxWidth=`${(box.label.mOverflowWidth || 680)*scale}px`;
  element.style.color=`rgb(${color.r*255} ${color.g*255} ${color.b*255})`;
  element.style.transform=`translate(${-(box.label.mPivot%3)*50}%,${(2-Math.floor(box.label.mPivot/3))*50}%)`;
  const thought=box.background.mSpriteName==='Lobby_balloon2';
  const borders=thought ? [85,50,55,130] : [84,50,60,80];
  element.style.setProperty('--balloon',`url("ui/${thought ? 'Lobby_balloon2' : 'Lobby_balloon'}.png")`);
  element.style.setProperty('--slice',borders.join(' '));
  element.style.setProperty('--border-width',borders.map(value=>`${value*scale}px`).join(' '));
  for(const side of ['left','right','bottom','top'])element.style.setProperty(`--pad-${side}`,`${(side==='left' || side==='bottom' ? padding[side] : -padding[side])*scale}px`);
  element.style.setProperty('--flip-x',[1,3].includes(box.background.mFlip) ? -1 : 1);
  element.style.setProperty('--flip-y',[2,3].includes(box.background.mFlip) ? -1 : 1);
  element.dataset.row=String(row.rowIndex);
}
