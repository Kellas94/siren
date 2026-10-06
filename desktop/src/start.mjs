// Keep the protection process outside ordinary application module evaluation.
if(process.argv.some(arg=>arg.startsWith('--siren-pin-worker'))){
 await import('./account/pin-worker.mjs');
}else{
 await import('./main.mjs');
}
