"""Physical portable-host boundaries, using fresh ordinary files, never SIREN."""
from pathlib import Path
import hashlib,json,os,runpy,tempfile,unittest
from unittest.mock import patch

MODULE=Path(__file__).with_name('portable_support.py')

class PortableBoundaryTests(unittest.TestCase):
    def setUp(self):
        if not MODULE.is_file():self.fail('PORTABLE_SUPPORT_NOT_IMPLEMENTED')
        self.api=runpy.run_path(str(MODULE))
        self.temp=tempfile.TemporaryDirectory(prefix='siren-portable-boundary-')
        self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
    def test_copy_excludes_whole_mutable_roots_before_recursion(self):
        app=self.root/'app';app.mkdir();(app/'source.mjs').write_bytes(b'original')
        output=app/'evidence'/'new';output.mkdir(parents=True)
        (output/'secret.bin').write_bytes(b'old evidence must not enter app')
        (app/'dist').mkdir();(app/'dist'/'program.bin').write_bytes(b'package')
        copy=output/'app';receipt=self.api['copy_app'](app,copy)
        self.assertEqual((copy/'source.mjs').read_bytes(),b'original')
        self.assertFalse((copy/'evidence').exists());self.assertFalse((copy/'dist').exists())
        self.assertEqual([x['relativePath'] for x in receipt['files']],['source.mjs'])
    def test_source_copy_refuses_overwrite(self):
        app=self.root/'app';app.mkdir();target=self.root/'target';target.mkdir()
        with self.assertRaisesRegex(ValueError,'FRESH_COPY_TARGET_REQUIRED'):self.api['copy_app'](app,target)
    def test_copy_refuses_target_nested_in_live_source(self):
        app=self.root/'app';app.mkdir()
        with self.assertRaisesRegex(ValueError,'COPY_RECURSION_REFUSED'):self.api['copy_app'](app,app/'inside')
    def test_snapshot_detects_added_directory(self):
        tree=self.root/'tree';tree.mkdir();(tree/'a').write_bytes(b'a')
        before=self.api['snapshot'](tree);(tree/'empty').mkdir()
        self.assertNotEqual(before,self.api['snapshot'](tree))
    def test_snapshot_detects_byte_drift_without_length_change(self):
        tree=self.root/'tree';tree.mkdir();(tree/'a').write_bytes(b'a')
        before=self.api['snapshot'](tree);(tree/'a').write_bytes(b'b')
        self.assertNotEqual(before,self.api['snapshot'](tree))
    def test_snapshot_refuses_link_without_reading_target(self):
        tree=self.root/'tree';tree.mkdir();target=self.root/'outside';target.write_bytes(b'private')
        try:os.symlink(target,tree/'link')
        except OSError:self.skipTest('OS refused creation of test link')
        with self.assertRaisesRegex(ValueError,'LINK_REFUSED'):self.api['snapshot'](tree)
    def junction_diagnostic(self,ancestor):
        import _winapi
        target=self.root/'target-Ș-😀';target.mkdir();secret=target/'payload.bin';secret.write_bytes(b'owned control bytes')
        link=self.root/'junction-Ș-😀';_winapi.CreateJunction(str(target),str(link))
        requested=link/'payload.bin' if ancestor else link
        observed=link.lstat()
        with patch.object(Path,'open',side_effect=AssertionError('REFUSED_PATH_MUST_NOT_BE_OPENED')) as opened:
            with self.assertRaisesRegex(ValueError,'LINK_REFUSED') as caught:self.api['pin'](requested)
            self.assertEqual(opened.call_count,0)
        code,separator,raw=str(caught.exception).partition(' ')
        self.assertEqual(code,'LINK_REFUSED');self.assertTrue(separator,'MISSING_REFUSED_PATH_DIAGNOSTIC')
        detail=json.loads(raw)
        self.assertEqual(detail['requestedPath'],str(requested));self.assertEqual(detail['refusedPath'],str(link))
        self.assertEqual(detail['fileAttributes'],observed.st_file_attributes);self.assertTrue(detail['fileAttributes']&1024)
        self.assertEqual(detail['fileMode'],observed.st_mode);self.assertEqual(detail['reparseTag'],observed.st_reparse_tag)
        self.assertFalse(detail['requestedPathTruncated']);self.assertFalse(detail['refusedPathTruncated'])
        self.assertEqual(secret.read_bytes(),b'owned control bytes');self.assertLess(len(str(caught.exception)),3000)
        print(json.dumps({'control':'ancestor' if ancestor else 'direct','message':str(caught.exception),'noFileOpenBeforeRefusal':True,'targetUnchanged':True},ensure_ascii=True))
    def test_direct_junction_refusal_retains_exact_diagnostic(self):self.junction_diagnostic(False)
    def test_ancestor_junction_refusal_retains_exact_diagnostic(self):self.junction_diagnostic(True)
    def test_refusal_diagnostic_fits_retained_primary_budget(self):
        import _winapi
        target=self.root/'target';target.mkdir();link=self.root/'junction';_winapi.CreateJunction(str(target),str(link))
        observed=link.lstat();ordinary=self.root.lstat();requested=self.root/('Ș😀'*2000)
        with patch.object(Path,'lstat',lambda node: observed if node==requested else ordinary),patch.object(Path,'open',side_effect=AssertionError('NO_FILE_READ')):
            with self.assertRaisesRegex(ValueError,'LINK_REFUSED') as caught:self.api['safe'](requested)
        code,separator,raw=str(caught.exception).partition(' ')
        self.assertTrue(separator,'MISSING_BOUNDED_REFUSAL_DIAGNOSTIC');detail=json.loads(raw)
        self.assertTrue(detail['requestedPathTruncated']);self.assertTrue(detail['refusedPathTruncated'])
        self.assertTrue(str(requested).startswith(detail['requestedPath']));self.assertLessEqual(len(detail['requestedPath']),512)
        self.assertLessEqual(len(json.dumps(detail['requestedPath'],ensure_ascii=True)),1024);self.assertLess(len(str(caught.exception)),3000)
        print(json.dumps({'control':'synthetic-long-path-stat','messageCharacters':len(str(caught.exception)),'retentionCharacters':3000,'pathWasNotPhysicallyCreated':True,'noFileOpen':True}))
    def test_escaped_and_supplementary_path_diagnostics_fit_primary_budget(self):
        import _winapi
        target=self.root/'target';target.mkdir();link=self.root/'junction';_winapi.CreateJunction(str(target),str(link))
        observed=link.lstat();ordinary=self.root.lstat();records=[]
        for label,value in [('escaped-control',chr(1)*2000),('supplementary','😀'*2000),('backslash',('x'+os.sep)*2000)]:
            requested=self.root/value
            with patch.object(Path,'lstat',lambda node: observed if node==requested else ordinary),patch.object(Path,'open',side_effect=AssertionError('NO_FILE_READ')):
                with self.assertRaisesRegex(ValueError,'LINK_REFUSED') as caught:self.api['safe'](requested)
            message=str(caught.exception);self.assertLess(len(message),3000,label)
            detail=json.loads(message.partition(' ')[2])
            for field in ['requestedPath','refusedPath']:
                self.assertTrue(str(requested).startswith(detail[field]));self.assertLessEqual(len(json.dumps(detail[field],ensure_ascii=True)),1024)
            self.assertTrue(detail['requestedPathTruncated']);self.assertTrue(detail['refusedPathTruncated'])
            records.append({'kind':label,'messageCharacters':len(message),'pathWasNotPhysicallyCreated':True})
        print(json.dumps({'control':'serialized-path-budget','records':records,'retentionCharacters':3000,'noFileOpen':True}))
    def test_ancestor_refusal_precedes_descendant_metadata_query(self):
        import _winapi
        target=self.root/'metadata-target-Ș-😀';target.mkdir();secret=target/'payload.bin';secret.write_bytes(b'owned metadata control')
        link=self.root/'metadata-junction-Ș-😀';_winapi.CreateJunction(str(target),str(link))
        original=Path.lstat
        for leaf in ['payload.bin','missing.bin']:
            with self.subTest(leaf=leaf):
                requested=link/leaf;queries=[]
                def checked_lstat(node,*args,**kwargs):
                    node=Path(node);queries.append(str(node))
                    if node!=link and node.is_relative_to(link):raise AssertionError('DESCENDANT_METADATA_QUERY_BEFORE_LINK_REFUSAL')
                    return original(node,*args,**kwargs)
                caught=None
                with patch.object(Path,'lstat',checked_lstat),patch.object(Path,'open',side_effect=AssertionError('NO_FILE_OPEN_BEFORE_REFUSAL')) as opened:
                    try:self.api['safe'](requested)
                    except BaseException as error:caught=error
                    self.assertEqual(opened.call_count,0)
                descendant=any(Path(node)!=link and Path(node).is_relative_to(link) for node in queries)
                print(json.dumps({'control':'actual-ancestor-metadata-boundary','leaf':leaf,'metadataQueries':queries,'descendantQueryAttempted':descendant,'exceptionType':type(caught).__name__,'exceptionMessage':str(caught),'instrumentation':'Path.lstat intercepted before original OS call; actual owned junction'},ensure_ascii=True))
                self.assertIsInstance(caught,ValueError)
                detail=json.loads(str(caught).partition(' ')[2])
                self.assertEqual(detail['requestedPath'],str(requested));self.assertEqual(detail['refusedPath'],str(link))
                self.assertFalse(descendant);self.assertEqual(queries[-1],str(link))
                self.assertEqual(secret.read_bytes(),b'owned metadata control')
    def runtime_tree(self,label='prefix'):
        root=self.root/label;root.mkdir();(root/'python.exe').write_bytes(b'selected executable bytes')
        (root/'python312.dll').write_bytes(b'ordinary DLL');(root/'Lib').mkdir();(root/'Lib'/'owned.py').write_bytes(b'ordinary module')
        return root
    def runtime_snapshot(self,root,selected=None):
        # RED binds the same full-prefix snapshot used by the published pipeline.
        function=self.api.get('python_runtime_snapshot',lambda base,exe:self.api['snapshot'](base))
        return function(root,selected or root/'python.exe')
    def simulated_aliases(self,root,specs,action):
        import stat,types
        lstat=Path.lstat;opened=Path.open;queries={};readlinks=[];alias_opens=[]
        for name in specs:(root/name).write_bytes(b'unselected placeholder; simulated link metadata')
        def observe(node,*args,**kwargs):
            node=Path(node);spec=specs.get(node.name) if node.parent==root else None
            if spec is None:return lstat(node,*args,**kwargs)
            queries[node.name]=queries.get(node.name,0)+1
            if spec.get('absentAfter') and queries[node.name]>1:raise FileNotFoundError(str(node))
            modified=spec.get('modifiedNs',1000)
            if callable(modified):modified=modified(queries[node.name])
            return types.SimpleNamespace(st_mode=spec.get('mode',stat.S_IFLNK|0o777),st_file_attributes=spec.get('attributes',1056),st_reparse_tag=spec.get('tag',stat.IO_REPARSE_TAG_SYMLINK),st_size=0,st_mtime_ns=modified)
        def readlink(node,*args,**kwargs):
            node=Path(node);self.assertEqual(node.parent,root);self.assertIn(node.name,specs);readlinks.append(node.name)
            target=specs[node.name]['target']
            return target(len(readlinks)) if callable(target) else target
        def open_file(node,*args,**kwargs):
            node=Path(node)
            if node.parent==root and node.name in specs:alias_opens.append(str(node));raise AssertionError('LAUNCH_ALIAS_BYTES_MUST_NOT_BE_OPENED')
            return opened(node,*args,**kwargs)
        try:
            with patch.object(Path,'lstat',observe),patch.object(os,'readlink',readlink),patch.object(Path,'open',open_file):value=action()
        finally:self.assertEqual(alias_opens,[])
        return value,readlinks
    def test_python_runtime_known_alias_is_metadata_only(self):
        root=self.runtime_tree()
        value,links=self.simulated_aliases(root,{'python3.exe':{'target':'python.exe'}},lambda:self.runtime_snapshot(root))
        self.assertEqual(value['excludedRootEntries'],['python3.exe']);self.assertNotIn('python3.exe',[row['relativePath'] for row in value['files']])
        row=value['metadataOnlyLaunchAliases'][0]
        self.assertEqual(row['relativePath'],'python3.exe');self.assertEqual(row['targetText'],'python.exe');self.assertEqual(row['reparseTag'],2684354572)
        self.assertEqual(links,['python3.exe','python3.exe']);self.assertEqual((root/'python.exe').read_bytes(),b'selected executable bytes')
        print(json.dumps({'control':'known-python-launcher-policy','physicalFileSymlinkCreated':False,'metadataSimulatedFromHostedValues':True,'aliasBytesOpened':False,'metadataCheckedBeforeAndAfter':True}))
    def test_python_runtime_absolute_device_target_and_two_aliases(self):
        root=self.runtime_tree();target=chr(92)*2+'?'+chr(92)+str(root/'python.exe')
        value,links=self.simulated_aliases(root,{'python3.exe':{'target':target},'python3.12.exe':{'target':'PYTHON.EXE'}},lambda:self.runtime_snapshot(root))
        self.assertEqual(len(value['metadataOnlyLaunchAliases']),2);self.assertEqual(len(links),4)
    def test_python_runtime_prefixed_basename_refused(self):
        root=self.runtime_tree();target=chr(92)*2+'?'+chr(92)+'python.exe'
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_TARGET_REFUSED'):
            self.simulated_aliases(root,{'python3.exe':{'target':target}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_ordinary_prefix_remains_fully_hashed(self):
        root=self.runtime_tree();value=self.runtime_snapshot(root)
        self.assertEqual({row['relativePath'] for row in value['files']},{'python.exe','python312.dll','Lib/owned.py'})
        self.assertEqual(value['metadataOnlyLaunchAliases'],[])
    def test_python_runtime_regular_alias_name_is_not_excluded(self):
        root=self.runtime_tree();(root/'python3.exe').write_bytes(b'ordinary executable copy')
        with patch.object(os,'readlink',side_effect=AssertionError('REGULAR_FILE_NOT_A_LINK')):value=self.runtime_snapshot(root)
        self.assertIn('python3.exe',[row['relativePath'] for row in value['files']]);self.assertEqual(value['metadataOnlyLaunchAliases'],[])
    def test_python_runtime_outside_alias_target_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_TARGET_REFUSED'):self.simulated_aliases(root,{'python3.exe':{'target':str(self.root/'outside.exe')}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_alias_chain_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_TARGET_REFUSED'):self.simulated_aliases(root,{'python3.exe':{'target':'python3.12.exe'}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_ambiguous_target_spelling_refused(self):
        for number,target in enumerate(['C:python.exe','./python.exe','sub/../python.exe']):
            with self.subTest(target=target):
                root=self.runtime_tree('prefix-'+str(number))
                with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_TARGET_REFUSED'):self.simulated_aliases(root,{'python3.exe':{'target':target}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_directory_reparse_substitute_refused(self):
        import stat
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_REPARSE_REFUSED'):self.simulated_aliases(root,{'python3.exe':{'target':'python.exe','mode':stat.S_IFDIR|0o777,'tag':stat.IO_REPARSE_TAG_MOUNT_POINT}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_inconsistent_or_unexpected_file_reparse_refused(self):
        import stat
        for number,changes in enumerate([{'tag':stat.IO_REPARSE_TAG_MOUNT_POINT},{'attributes':1072},{'attributes':32}]):
            with self.subTest(changes=changes):
                root=self.runtime_tree('prefix-'+str(number))
                with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_REPARSE_REFUSED'):self.simulated_aliases(root,{'python3.exe':dict(target='python.exe',**changes)},lambda:self.runtime_snapshot(root))
    def test_python_runtime_unknown_link_name_still_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'LINK_REFUSED'):self.simulated_aliases(root,{'untrusted.pyd':{'target':'python.exe'}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_alias_metadata_drift_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_METADATA_DRIFT'):self.simulated_aliases(root,{'python3.exe':{'target':'python.exe','modifiedNs':lambda count:1000+count}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_selected_launch_alias_refused(self):
        root=self.runtime_tree();(root/'python3.exe').write_bytes(b'not the selected runtime path')
        with self.assertRaisesRegex(ValueError,'SELECTED_PYTHON_EXE_REQUIRED'):self.runtime_snapshot(root,root/'python3.exe')
    def test_python_runtime_alias_presence_drift_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_METADATA_DRIFT'):self.simulated_aliases(root,{'python3.exe':{'target':'python.exe','absentAfter':True}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_raw_target_drift_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'PYTHON_ALIAS_METADATA_DRIFT'):self.simulated_aliases(root,{'python3.exe':{'target':lambda count:'python.exe' if count==1 else 'PYTHON.EXE'}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_selected_file_link_refused(self):
        root=self.runtime_tree()
        with self.assertRaisesRegex(ValueError,'LINK_REFUSED'):self.simulated_aliases(root,{'python.exe':{'target':'python312.dll'}},lambda:self.runtime_snapshot(root))
    def test_python_runtime_root_junction_refused(self):
        import _winapi
        root=self.runtime_tree();link=self.root/'prefix-junction';_winapi.CreateJunction(str(root),str(link))
        with self.assertRaisesRegex(ValueError,'LINK_REFUSED'):self.runtime_snapshot(link,link/'python.exe')
    def test_python_runtime_selected_bytes_drift_refused(self):
        root=self.runtime_tree();function=self.api['python_runtime_snapshot'];original=function.__globals__['snapshot']
        def changed(base,**kwargs):
            value=original(base,**kwargs);(root/'python.exe').write_bytes(b'changed selected executable');return value
        with patch.dict(function.__globals__,{'snapshot':changed}):
            with self.assertRaisesRegex(ValueError,'SELECTED_PYTHON_RUNTIME_DRIFT'):self.runtime_snapshot(root)
    def stage(self):
        stage=self.root/'stage';stage.mkdir();host=stage/'host.py';host.write_bytes(b'host')
        runtime=self.root/'python.exe';runtime.write_bytes(b'exe')
        source={'schema':1,'reviewMode':'AUTOMATED_OBSERVATIONS_REQUIRE_EXTERNAL_DATA_REVIEW','stage':'producer',
                'python':self.api['pin'](runtime),'files':[self.api['pin'](host)],'inputTrees':[]}
        return stage,host,runtime,source
    def test_automatic_stage_does_not_claim_peer_review(self):
        stage,host,runtime,source=self.stage()
        self.api['validate_stage'](source,stage,host,runtime,'producer')
        self.assertNotIn('author',source)
    def test_fabricated_peer_mode_refused(self):
        stage,host,runtime,source=self.stage();source['reviewMode']='INDEPENDENT_PASS'
        with self.assertRaisesRegex(ValueError,'AUTOMATED_STAGE_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_wrong_stage_refused(self):
        stage,host,runtime,source=self.stage()
        with self.assertRaisesRegex(ValueError,'AUTOMATED_STAGE_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'restore')
    def test_wrong_runtime_refused(self):
        stage,host,runtime,source=self.stage();runtime.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'SELF_RUNTIME_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_missing_host_pin_refused(self):
        stage,host,runtime,source=self.stage();source['files']=[]
        with self.assertRaisesRegex(ValueError,'SELF_RUNTIME_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_prior_attempt_refused(self):
        stage,host,runtime,source=self.stage();(stage/'host-attempt.json').write_bytes(b'{}')
        with self.assertRaisesRegex(ValueError,'FRESH_STAGE_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_output_already_present_refused(self):
        stage,host,runtime,source=self.stage();(stage/'operation').mkdir()
        with self.assertRaisesRegex(ValueError,'FRESH_STAGE_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_schema_boolean_refused(self):
        stage,host,runtime,source=self.stage();source['schema']=True
        with self.assertRaisesRegex(ValueError,'AUTOMATED_STAGE_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_read_json_preserves_filetime_exactly(self):
        file=self.root/'identity.json';file.write_bytes(b'{"creationFiletime":134367170745635464}')
        self.assertEqual(self.api['read'](file)['creationFiletime'],134367170745635464)
    def test_duplicate_json_keys_refused(self):
        file=self.root/'identity.json';file.write_bytes(b'{"status":"ADVERSE","status":"COMPLETE"}')
        with self.assertRaisesRegex(ValueError,'DUPLICATE_JSON_KEY'):self.api['read'](file)
    def test_manifest_refuses_unpinned_file(self):
        stage,host,runtime,source=self.stage();(stage/'unrecorded.py').write_bytes(b'code')
        with self.assertRaisesRegex(ValueError,'STAGE_FILE_SET_REQUIRED'):self.api['validate_stage'](source,stage,host,runtime,'producer')
    def test_outer_go_requires_actual_assigned_pid(self):
        self.assertIn('validate_outer_go',self.api,'OUTER_HELD_GO_NOT_IMPLEMENTED')
        go={'pid':123,'assignment':{'assignedActualHeldHandlePID':123,'limitKillOnJobClose':True}}
        self.api['validate_outer_go'](go,123)
    def test_outer_go_rejects_other_host(self):
        self.assertIn('validate_outer_go',self.api,'OUTER_HELD_GO_NOT_IMPLEMENTED')
        with self.assertRaisesRegex(ValueError,'OUTER_HELD_GO_REQUIRED'):self.api['validate_outer_go']({'pid':124,'assignment':{'assignedActualHeldHandlePID':123,'limitKillOnJobClose':True}},123)
    def test_outer_go_rejects_boolean_pid(self):
        self.assertIn('validate_outer_go',self.api,'OUTER_HELD_GO_NOT_IMPLEMENTED')
        with self.assertRaisesRegex(ValueError,'OUTER_HELD_GO_REQUIRED'):self.api['validate_outer_go']({'pid':True,'assignment':{'assignedActualHeldHandlePID':1,'limitKillOnJobClose':True}},1)
    def test_outer_go_rejects_uncontained_host(self):
        self.assertIn('validate_outer_go',self.api,'OUTER_HELD_GO_NOT_IMPLEMENTED')
        with self.assertRaisesRegex(ValueError,'OUTER_HELD_GO_REQUIRED'):self.api['validate_outer_go']({'pid':123,'assignment':{'assignedActualHeldHandlePID':123,'limitKillOnJobClose':False}},123)

if __name__=='__main__':unittest.main(verbosity=2)
