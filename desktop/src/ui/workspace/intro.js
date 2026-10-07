(() => {
  'use strict';
  const boot=window.sirenDesktopBootstrap;
  const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let started=false;
  const retire=()=>{const plate=document.getElementById('sirenIntroOverlay');if(plate){plate.hidden=true;plate.setAttribute('aria-hidden','true');}};
  // Only a native startup flag can request the introduction. Returning Home or
  // manual Lock does not replay it. No application/project initialization here.
  window.sirenDesktopStartOpening=()=>{
    if(started||boot?.mode!=='locked'||boot?.opening!=='intro'||reduced()){retire();return false;}
    started=true;const plate=document.getElementById('sirenIntroOverlay');plate.hidden=false;
    plate.setAttribute('aria-hidden','false');plate.classList.add('is-playing');
    setTimeout(retire,1050);return true;
  };
  window.sirenHomeCloseVault=async()=>{
    const vault=document.getElementById('sirenLockVault');vault.hidden=false;
    if(!reduced())await new Promise(resolve=>setTimeout(resolve,420));
  };
  if(boot?.mode!=='locked'||boot?.opening!=='intro'||reduced())retire();
})();
