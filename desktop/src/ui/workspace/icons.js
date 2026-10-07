(() => {
  'use strict';
  // Local vector artwork; the SVG namespace identifies elements, not a network resource.
  const iconPaths={
    diagrams:[
      ['M9 13v6a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2v-6M20 21v6',1,false],
      ['M6 4h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z',1,true],
      ['M27 4h7a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z',1,true],
      ['M16 27h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3Z',1,true]
    ],
    docs:[
      ['M14 4h15a3 3 0 0 1 3 3v22',.45,false],
      ['M9 9h13l7 7v18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3ZM22 9v7h7',1,true],
      ['M12 21h11M12 26h11M12 31h7',1,false]
    ],
    present:[
      ['M9 3h25a3 3 0 0 1 3 3v19',.45,false],
      ['M6 8h25a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3Z',1,true],
      ['M18.5 30v7M11 37h15M9 15h9M9 20h6M23 23v-4M28 23v-9',1,false]
    ]
  };
  window.SirenModuleIcon=(card,surface)=>{
    const holder=document.createElement('span');holder.className='home-module-icon';holder.setAttribute('aria-hidden','true');card.append(holder);
    if(surface==='code'){holder.textContent='⌘';return;}
    const namespace='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(namespace,'svg');
    for(const [name,value] of Object.entries({viewBox:'0 0 40 40',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round',focusable:'false'}))svg.setAttribute(name,value);
    for(const [d,opacity,filled] of iconPaths[surface]){
      const path=document.createElementNS(namespace,'path');path.setAttribute('d',d);path.setAttribute('opacity',String(opacity));
      if(filled){path.setAttribute('fill','currentColor');path.setAttribute('fill-opacity','.1');}
      svg.append(path);
    }
    holder.append(svg);
  };

})();
