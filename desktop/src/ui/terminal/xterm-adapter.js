// SOURCE_ONLY: constructors are injected; no xterm dependency, shell or bootstrap
// is activated here. Reviewed controls own paste; the view owns input and ACKs.
export function createXtermAdapter({Terminal,FitAddon,SearchAddon,ResizeObserver,requestFrame,cancelFrame}={}){
 if([Terminal,FitAddon,SearchAddon,ResizeObserver,requestFrame,cancelFrame].some(value=>typeof value!=='function'))throw TypeError('XTERM_ADAPTER_REQUIRED');
 let active=null;
 const search=Object.freeze({findNext(query){const cell=active;if(!cell||cell.disposed||!cell.opened||typeof query!=='string'||!query||query.length>4096)return false;try{return cell.search.findNext(query)===true;}catch{return false;}}});
 function terminalFactory(options={}){
  if(active)throw Error('DISPLAY_ACTIVE');
  const cell={terminal:null,fit:null,search:null,addons:[],container:null,observer:null,frame:null,opened:false,disposed:false};active=cell;
  function dispose(){
   if(cell.disposed)return;cell.disposed=true;
   if(cell.frame!==null){const frame=cell.frame;cell.frame=null;try{cancelFrame(frame.id);}catch{}}
   try{cell.observer?.disconnect();}catch{}
   try{if(cell.terminal)cell.terminal.options.disableStdin=true;}catch{}
   // Keep this cell reserved while external disposal callbacks run.
   try{cell.terminal?.dispose();}catch{}
   for(const addon of cell.addons)try{addon.dispose();}catch{}
   if(active===cell)active=null;
  }
  let terminal;
  try{terminal=new Terminal({...options,disableStdin:true,scrollback:10000,allowProposedApi:false,windowOptions:{},linkHandler:{activate(){},hover(){},leave(){}},logLevel:'off'});cell.terminal=terminal;}catch(error){dispose();throw error;}
  function fit(frame){
   if(cell.frame!==frame)return;cell.frame=null;if(cell.disposed||!cell.opened)return;
   try{
    const rect=cell.container.getBoundingClientRect();if(cell.disposed||!cell.opened||!(Number.isFinite(rect.width)&&Number.isFinite(rect.height)&&rect.width>0&&rect.height>0))return;
    const size=cell.fit.proposeDimensions();if(cell.disposed||!cell.opened||!size||!Number.isFinite(size.cols)||!Number.isFinite(size.rows))return;
    const cols=Math.min(500,Math.max(2,Math.floor(size.cols))),rows=Math.min(200,Math.max(1,Math.floor(size.rows)));
    if(cols!==terminal.cols||rows!==terminal.rows)terminal.resize(cols,rows);
   }catch{/* A hidden or retiring display must not dispatch guessed geometry. */}
  }
  function scheduleFit(){
   if(cell.disposed||!cell.opened||cell.frame!==null)return;
   const frame={id:null};cell.frame=frame;
   try{frame.id=requestFrame(()=>fit(frame));if(cell.disposed){try{cancelFrame(frame.id);}catch{}}}catch{if(cell.frame===frame)cell.frame=null;}
  }
  function loadAddon(Constructor){
   const addon=new Constructor();let retired=false;
   // Own disposal before activation: activation can retire the display before
   // xterm has finished adopting its addon. The wrapper joins both owners once.
   const owned={activate(value){return addon.activate(value);},dispose(){if(retired)return;retired=true;addon.dispose();}};
   if(cell.disposed){try{owned.dispose();}catch{}throw Error('DISPLAY_INACTIVE');}
   cell.addons.push(owned);terminal.loadAddon(owned);
   if(cell.disposed)throw Error('DISPLAY_INACTIVE');return addon;
  }
  const emulator={
   get options(){return terminal.options;},
   open(container){
    if(cell.disposed||cell.opened)throw Error('DISPLAY_INACTIVE');cell.container=container;
    try{
     cell.fit=loadAddon(FitAddon);cell.search=loadAddon(SearchAddon);terminal.open(container);
     if(cell.disposed)throw Error('DISPLAY_INACTIVE');cell.opened=true;
     const observer=new ResizeObserver(scheduleFit);
     if(cell.disposed){try{observer.disconnect();}catch{}throw Error('DISPLAY_INACTIVE');}
     cell.observer=observer;observer.observe(container);
     if(cell.disposed)throw Error('DISPLAY_INACTIVE');scheduleFit();
    }catch(error){dispose();throw error;}
   },
   write(data,callback){if(cell.disposed)throw Error('DISPLAY_INACTIVE');return terminal.write(data,callback);},
   onData(callback){if(cell.disposed)throw Error('DISPLAY_INACTIVE');return terminal.onData(callback);},
   onResize(callback){if(cell.disposed)throw Error('DISPLAY_INACTIVE');return terminal.onResize(callback);},
   clear(){if(cell.disposed)throw Error('DISPLAY_INACTIVE');return terminal.clear();},dispose
  };
  return Object.freeze(emulator);
 }
 return Object.freeze({terminalFactory,search});
}
