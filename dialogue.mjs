export function dialogueText(text) {
  return text.replace(/<br\s*\/?>/gi,'\n').replace(/<\/?(?:color|size|b|i)(?:=[^>]*)?>/gi,'')
    .replace(/\[(?:[0-9a-f]{6}|-|\/?)\]/gi,'');
}
import {chainMatrix,transform,multiply,inverse} from './interaction.mjs';


export function renderCaption(element,row,layout,view,width,height,zoom=1) {
  if(!row){element.hidden=true;element.textContent='';return;}
  const text=dialogueText(row.text),box=layout?.dialogBoxes.find(box=>box.type===row.dialogType) || layout?.dialogBoxes[0];
  element.hidden=false;
  if(!box || !view.uiWidth){element.textContent=text;return;}
  let label=element.firstElementChild;
  if(!label){label=document.createElement('span');element.replaceChildren(label);}
  if(label.textContent!==text)label.textContent=text;
  let matrix=chainMatrix(box.label.transformChain);
  if(row.applyPosition) {
    const chain=box.transformChain.map((t,index)=>index===0 ? {...t,position:{...t.position,x:row.posX,y:row.posY}} : t);
    matrix=multiply(multiply(chainMatrix(chain),inverse(chainMatrix(box.transformChain))),matrix);
  }
  const point=transform(matrix,{x:0,y:0});
  const scale=height/view.uiHeight*zoom,color=box.label.mColor,padding=box.background.padding;
  element.style.left=`${50+point.x/view.uiWidth*zoom*100}%`;
  element.style.bottom=`${50+point.y/view.uiHeight*zoom*100}%`;
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
