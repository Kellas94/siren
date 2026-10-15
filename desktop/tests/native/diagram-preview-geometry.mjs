// CSS-grid measurement for owned native QA. No DOM is read on import.
export function captureNativeDiagramGeometry(){
 const rect=element=>{if(!element)return null;const r=element.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const shown=element=>element&&!element.hidden&&getComputedStyle(element).display!=='none';
 const main=document.querySelector('main'),panel=document.querySelector('.diagram-preview-panel'),notice=document.getElementById('diagramChangesNotice'),mainStyle=main&&getComputedStyle(main),panelStyle=panel&&getComputedStyle(panel);
 return {width:innerWidth,height:innerHeight,main:rect(main),layout:rect(document.getElementById('diagramLayout')),panel:rect(panel),viewport:rect(document.getElementById('diagramViewport')),toolbar:rect(document.querySelector('.diagram-toolbar')),status:rect(document.getElementById('viewStatus')),notice:shown(notice)?rect(notice):null,middle:['diagramBuildPanel','diagramStylePanel'].map(id=>document.getElementById(id)).filter(shown).map(rect),mainPaddingBottom:parseFloat(mainStyle?.paddingBottom),mainBorderBottom:parseFloat(mainStyle?.borderBottomWidth),mainRowGap:parseFloat(mainStyle?.rowGap),panelRowGap:parseFloat(panelStyle?.rowGap)};
}
export function isNativeDiagramGeometry(r){
 try{
  const epsilon=2,near=(a,b)=>Math.abs(a-b)<=epsilon,finite=n=>typeof n==='number'&&Number.isFinite(n),valid=q=>q&&['left','top','right','bottom','width','height'].every(k=>finite(q[k]))&&q.width>0&&q.height>0&&near(q.right-q.left,q.width)&&near(q.bottom-q.top,q.height);
  if(!r||!finite(r.width)||!finite(r.height)||r.width<=0||r.height<=0||!['mainPaddingBottom','mainBorderBottom','mainRowGap','panelRowGap'].every(k=>finite(r[k])&&r[k]>=0))return false;
  if(![r.main,r.layout,r.panel,r.viewport,r.toolbar,r.status].every(valid)||!Array.isArray(r.middle)||r.middle.length>1||r.middle.some(q=>!valid(q))||(r.notice&&!valid(r.notice)))return false;
  const {main,layout,panel,viewport:v,toolbar,status}=r,lastMain=r.notice??status,lastPanel=r.middle[0]??toolbar;
  return near(layout.bottom,main.bottom-r.mainPaddingBottom-r.mainBorderBottom)&&near(layout.top-lastMain.bottom,r.mainRowGap*(r.notice?1:2))&&near(panel.top,layout.top)&&near(panel.bottom,layout.bottom)&&near(v.left,panel.left)&&near(v.right,panel.right)&&near(v.bottom,panel.bottom)&&near(v.top-lastPanel.bottom,r.panelRowGap*(r.middle.length?1:2))&&v.height>=toolbar.height&&v.top>=0&&v.left>=0&&v.bottom<=r.height+epsilon&&v.right<=r.width+epsilon;
 }catch{return false;}
}
