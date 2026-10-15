// Pure, pinned text derivation of a NEW native variant. Never compile/load/run.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(value).digest('hex');
const BASE_SOURCE='f0557cefb26dc337f4acfbc2f8e3302822f2f3f2371a9842e6c9c8b5cf536d3c';
const BASE_BINDING='559f2a28158cc4695324494e526114627696589c6f91514687d8f9138bc95ce0';
const environment=String.raw`bool SystemEnvironmentDirectory(UINT (WINAPI *read)(LPWSTR,UINT),std::wstring& value){
 std::vector<wchar_t> path(32768);UINT n=read(path.data(),static_cast<UINT>(path.size()));
 if(n==0||n>=path.size())return false;
 value.assign(path.data(),n);return FixedPath(value,true)&&value.find(L';')==std::wstring::npos;
}
bool CreatorEnvironment(std::vector<wchar_t>& result,const std::wstring& privateDirectory){
 // No parent environment reads, mutation, PATH/TEMP fallback or private keys.
 std::wstring windows,system;
 if(!SystemEnvironmentDirectory(GetSystemWindowsDirectoryW,windows)||!SystemEnvironmentDirectory(GetSystemDirectoryW,system)||!FixedPath(privateDirectory,true))return false;
 const std::vector<std::wstring> entries={
  L"ComSpec="+system+L"\\cmd.exe",
  L"ELECTRON_RUN_AS_NODE=1",
  L"PATH="+system+L";"+windows,
  L"SystemRoot="+windows,
  L"TEMP="+privateDirectory,
  L"TMP="+privateDirectory,
  L"windir="+windows
 };
 result.clear();
 for(size_t i=0;i<entries.size();++i){
  if(i&&CompareStringOrdinal(entries[i-1].c_str(),-1,entries[i].c_str(),-1,TRUE)!=CSTR_LESS_THAN)return false;
  if(result.size()+entries[i].size()+2>65536)return false;
  result.insert(result.end(),entries[i].begin(),entries[i].end());result.push_back(0);
 }
 result.push_back(0);return true;
}
`;
export function deriveMinimalCreatorOwnership({source,binding}={}){
 assert.equal(typeof source,'string','CREATOR_ENV_INPUT_DRIFT');assert.equal(typeof binding,'string','CREATOR_ENV_INPUT_DRIFT');
 assert.equal(digest(source),BASE_SOURCE,'CREATOR_ENV_INPUT_DRIFT');assert.equal(digest(binding),BASE_BINDING,'CREATOR_ENV_INPUT_DRIFT');
 const pattern=/bool CreatorEnvironment\([\s\S]*?(?=struct Attributes)/g;
 assert.equal([...source.matchAll(pattern)].length,1,'CREATOR_ENV_ANCHOR_DRIFT');
 let derived=source.replace(pattern,()=>environment);
 const call='CreatorEnvironment(environment)';assert.equal(derived.split(call).length,2,'CREATOR_ENV_ANCHOR_DRIFT');derived=derived.replace(call,'CreatorEnvironment(environment,directory)');
 derived='// Minimal-environment variant; separate source/artifact qualification required.\n'+derived;
 const build=JSON.parse(binding);build.targets[0].target_name='siren_terminal_ownership_minimal_env';
 return Object.freeze({source:derived,binding:build,baseSha256:BASE_SOURCE,baseBindingSha256:BASE_BINDING,sha256:digest(derived),environmentKeys:Object.freeze(['ComSpec','ELECTRON_RUN_AS_NODE','PATH','SystemRoot','TEMP','TMP','windir']),compiled:false,admitted:false});
}
