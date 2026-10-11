// Inert fixed comparison DATA. Does not alter the retained original fixture.
import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';

export const coldCmdletComparisonCases=Object.freeze([
 Object.freeze({armId:'original-start-sleep',mode:'original',control:'start-sleep'}),
 Object.freeze({armId:'qualified-start-sleep',mode:'module-qualified',control:'start-sleep'}),
 Object.freeze({armId:'original-write-output',mode:'original',control:'write-output'}),
 Object.freeze({armId:'qualified-write-output',mode:'module-qualified',control:'write-output'}),
]);

export function createComparedCmdletFixture({projectDirectory,token,control,mode}={}){
 if(mode!=='original'&&mode!=='module-qualified')throw TypeError('Fixed comparison mode required');
 const original=createSingleCmdletFixture({projectDirectory,token,control});
 if(mode==='original')return original;
 const name=control==='start-sleep'?'Start-Sleep':'Write-Output';
 const target='\r\n'+name+' ';
 if(original.script.split(target).length!==2)throw Error('Original fixed target changed');
 return Object.freeze({...original,variant:original.variant+'_MODULE_QUALIFIED',
  script:original.script.replace(target,'\r\nMicrosoft.PowerShell.Utility\\'+name+' ')});
}

// The dedicated qualified worker has no caller-selectable mode or target.
export function createQualifiedSingleCmdletFixture({projectDirectory,token,control}={}){
 return createComparedCmdletFixture({projectDirectory,token,control,mode:'module-qualified'});
}
