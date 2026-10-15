// Private fixed launch registration: never exposed over IPC/preload/CLI/environment.
let initializer=null,consumed=false;
export function configureDesktopLaunch(value){if(consumed||initializer!==null||typeof value!=='function')throw TypeError('One fixed private initializer required');initializer=value;}
export function takeDesktopLaunch(){if(consumed)throw TypeError('Desktop launch already consumed');consumed=true;const value=initializer;initializer=null;return value;}
