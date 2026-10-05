import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
test('a source-only document keeps its existing source outline instead of gaining an empty reading page',async()=>{
 const window={},document={createElement:()=>{throw Error('Empty reading page must not be created');}};
 runInNewContext(await readFile(new URL('../src/ui/docs/reader.js',import.meta.url),'utf8'),{window,document});
 window.SirenNativeDocsReader.render({parent:{},outline:{},blocks:[{kind:'knowledge',rows:[{sourceRef:{version:1}}]}]});
});
