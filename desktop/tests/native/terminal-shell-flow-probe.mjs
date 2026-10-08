// Fixed probe source/data only. Never runs PowerShell or imports native code.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const markers=Object.freeze({start:'SIREN_FIXED_FLOW_START_8264',done:'SIREN_FIXED_FLOW_DONE_5381',fresh:'SIREN_FIXED_FLOW_FRESH_9072'});
const encoded=s=>'(-join ([char[]]@('+[...s].map(c=>c.charCodeAt(0)).join(',')+')))';
export function fixedShellFlowProbe(){
 const script=`# Fixed reviewed CI probe. No project code, downloads or credentials.
$ErrorActionPreference = 'Stop'
$fixture = Join-Path $PSScriptRoot 'fixed-shell-flow-child.exe'
Start-Process -FilePath $fixture -ArgumentList @('root', ('"' + $PSScriptRoot + '"')) -WindowStyle Hidden
$readyWait = [Diagnostics.Stopwatch]::StartNew()
while (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'fixed-flood-go.request'))) {
    if ($readyWait.ElapsedMilliseconds -ge 30000) { throw 'FIXED_FLOOD_START_DEADLINE' }
    Start-Sleep -Milliseconds 10
}
[Console]::WriteLine('')
[Console]::WriteLine(${encoded(markers.start)})
$watch = [Diagnostics.Stopwatch]::StartNew()
$generated = [long]0
$blocks = [long]0
$block = ('x' * 8190) + "\`r\`n"
while ($watch.ElapsedMilliseconds -lt 60000) {
    if ($generated + 8192 -le 134217728) {
        [Console]::Write($block)
        $generated += 8192
        $blocks += 1
    }
    Start-Sleep -Milliseconds 5
}
$record = @{ schema=1; admitted=$false; elapsedMs=$watch.ElapsedMilliseconds; generatedAsciiBytes=$generated; blocks=$blocks; byteCap=134217728; minimumMs=60000 }
$pending = Join-Path $PSScriptRoot 'fixed-flood-result.json.pending'
$stream = [IO.File]::Open($pending, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
    $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes(($record | ConvertTo-Json -Compress))
    $stream.Write($bytes, 0, $bytes.Length)
} finally { $stream.Dispose() }
[IO.File]::Move($pending, (Join-Path $PSScriptRoot 'fixed-flood-result.json'))
[Console]::WriteLine('')
[Console]::WriteLine(${encoded(markers.done)})
`;
 const freshCommand='[Console]::WriteLine(\'\'); [Console]::WriteLine('+encoded(markers.fresh)+')\r';
 return Object.freeze({script,markers,minimumFloodMs:60000,naturalDeadlineMs:110000,generatedByteCap:128*1024*1024,freshCommand});
}
export function deriveShellFlowLongFixture(source){
 assert.equal(createHash('sha256').update(source).digest('hex'),'a978af9537ff1c50cdb99849bca18f1f3dbf8181ccfdce41ad7448ab0a2f680a','FIXTURE_SOURCE_DRIFT');
 const anchor='Thread.Sleep(12000);return 0;';assert.equal(source.split(anchor).length,3,'LONG_FIXTURE_ANCHOR_DRIFT');
 // Separate source, including its unused historical owner mode. Original is
 // unchanged and its twelve-second observations retain their original gates.
 return source.replaceAll(anchor,'Thread.Sleep(110000);return 0;');
}
export class ShellFlowMarkerScanner {
 #markers;#seen=new Set();#line='';#overflow=false;#next=0;#gaps=0;#escape='';#escapeLength=0;
 constructor(value){
  assert.deepEqual(Object.keys(value).sort(),['done','fresh','start']);
  for(const s of Object.values(value))assert.match(s,/^[A-Z0-9_]{1,100}$/);
  this.#markers=Object.freeze({...value});
 }
 append(sequence,data){
  assert.ok(Number.isSafeInteger(sequence)&&sequence>=0&&typeof data==='string'&&data.isWellFormed());
  if(sequence!==this.#next){this.#line='';this.#overflow=true;this.#escape='';this.#gaps++;}
  this.#next=sequence+Buffer.byteLength(data);assert.ok(Number.isSafeInteger(this.#next));
  for(const c of data){
   if(this.#escape){
    this.#escapeLength++;
    if(this.#escapeLength>512)this.#overflow=true;
    if(this.#escape==='esc')this.#escape=c==='['?'csi':c===']'?'osc':'';
    else if(this.#escape==='csi'){if(c>='@'&&c<='~')this.#escape='';}
    else if(this.#escape==='osc'){if(c==='\x07')this.#escape='';else if(c==='\x1b')this.#escape='oscEsc';}
    else if(this.#escape==='oscEsc')this.#escape=c==='\\'?'':'osc';
    continue;
   }
   if(c==='\x1b'){this.#escape='esc';this.#escapeLength=0;continue;}
   if(c==='\r'||c==='\n'){
    if(!this.#overflow)for(const [key,marker] of Object.entries(this.#markers))if(this.#line===marker)this.#seen.add(key);
    this.#line='';this.#overflow=false;continue;
   }
   if(this.#line.length+c.length<=512&&!this.#overflow)this.#line+=c;else{this.#line='';this.#overflow=true;}
  }
 }
 seen(key){assert.ok(Object.hasOwn(this.#markers,key));return this.#seen.has(key);}
 stats(){return Object.freeze({bufferedCharacters:this.#line.length,gaps:this.#gaps,nextSequence:this.#next,seen:Object.freeze([...this.#seen])});}
}
