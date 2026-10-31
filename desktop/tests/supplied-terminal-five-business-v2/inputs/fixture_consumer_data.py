"""Source-derived fake producer evidence. No MJS execution or native I/O."""
import copy
import json
import unittest

FIXED=r'C:\Claude\SIREN_WORK\terminal-fixed-directory-guard-v1-20261021\owned-cwd'
SOURCE='file:///C:/Claude/SIREN_WORK/terminal-operational-four-stage-candidate-v1-20261022-image/runtime/desktop/src/terminal/private-picker-close-observer.mjs'
BINDING={'mainPid':43210,'projectId':'project-1','windowId':'window-1','epoch':2,'pointerBits':64,'parentHwnd':0xfedcba9876543210}
STAGES=['prepare','write-join','retire-views','journal','window-close']

def encode(value):return (json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf8')
def status(count):return dict(failed=False,code=None,selectionCount=1,apiCount=1,matched=True,pending=False,settled=True,unmatched=False,records=count,ioBroken=False)
def fixture(kind='SELECT',binding=None):
    b=dict(BINDING if binding is None else binding)
    rows=[dict(version=1,sequence=1,stage='resolver-selected',failed=False,ordinal=1,branch='detached',projectId=b['projectId'],windowId=b['windowId'],epoch=b['epoch'],role='terminal',webContentsId=8),
          dict(version=1,sequence=2,stage='api-call-boundary',failed=False,ordinal=1,matched=True,mainPid=b['mainPid'],branch='detached',senderWebContentsId=8,parentWebContentsId=8,parentWebContentsStatus='VALUE',handleBytes=b['pointerBits']//8,handleHex=b['parentHwnd'].to_bytes(b['pointerBits']//8,'little').hex())]
    row=dict(version=1,sequence=3,stage='rejected' if kind=='REJECT' else 'fulfilled-projection',failed=False,ordinal=1,matched=True,apiCount=1,selectionCount=1)
    if kind!='REJECT':row.update(canceled=kind=='CANCEL',fileCount=0 if kind=='CANCEL' else 1,selectedPathPresent=kind!='CANCEL')
    if kind=='SELECT':row['selectedPath']=FIXED
    rows.append(row)
    prefix=b''.join(encode(r) for r in rows)
    rows.append(dict(version=1,sequence=4,stage='journal-final',failed=False,status=status(3),writtenRowsBeforeFooter=3,writtenBytesBeforeFooter=len(prefix),finalWriteOutcome='NOT_SELF_ATTESTED',flushOutcome='NOT_YET_ATTESTED',closeOutcome='NOT_YET_ATTESTED'))
    return assemble(rows,b)
def assemble(rows,b=None):
    b=BINDING if b is None else b
    body=b''.join(encode(r) for r in rows)
    j=dict(version=1,requested=True,completed=True,complete=True,pending=False,settled=True,matched=True,failed=False,code=None,attemptedRows=4,writtenRows=4,attemptedBytes=len(body),writtenBytes=len(body),writtenBytesKnown=True,rowLimitExceeded=False,byteLimitExceeded=False,finalWriteAttempted=True,finalWriteComplete=True,flushAttempted=True,flushSucceeded=True,closeAttempted=True,closeConfirmed=True,closeUnknown=False,descriptorAcquired=True,finalFailureCount=0,finalFailuresDropped=0)
    frame=dict(probe='siren-picker-final-close-v2',version=2,stage='MAIN_WINDOW_CLOSED',source=SOURCE,mainPid=b['mainPid'],armed=True,closed=True,captureFailurePresent=False,status=status(4),journal=j)
    stages=[dict(stage=s,elapsedMs=i,pendingWrites=0,hasProcessIdentity=True) for i,s in enumerate(STAGES)]
    return {'rows':rows,'journal':body,'frame':frame,'stages':stages,'binding':dict(b),'stderr':b''}
def streams(f):
    stdout=b''.join(b'SIREN_CLOSE_STAGE '+encode(r) for r in f['stages'])+encode(f['frame'])
    return f['journal'],stdout,f['stderr'],f['binding']

class Checks(unittest.TestCase):
    def setUp(self):self.assertIn('consume',CONSUMER,'missing closed receipt consumer')
    def call(self,f):return CONSUMER['consume'](*streams(f))
    def refused(self,f):
        with self.assertRaises(CONSUMER['Refused']):self.call(f)
    def test_complete_select_cancel_reject_are_distinct(self):
        for kind in ('SELECT','CANCEL','REJECT'):
            f=fixture(kind);result=self.call(f)
            self.assertTrue(result['observationComplete']);self.assertEqual(result['providerOutcome'],kind)
            self.assertEqual(result['selectedPathWitness'],kind=='SELECT');self.assertFalse(result['productAdmissionProved'])
            self.assertEqual(result['parentHwnd'],BINDING['parentHwnd']);self.assertEqual(result['reportedWebContentsId'],8)
    def test_import_and_consume_open_no_paths_and_sample_no_clock(self):
        self.assertEqual(self.call(fixture())['rows'],4)
        self.assertNotIn('open',CONSUMER)
    def test_all_finalization_fields_corruption_is_refused(self):
        original=fixture()
        for key,value in original['frame']['journal'].items():
            with self.subTest(key=key):
                f=copy.deepcopy(original)
                f['frame']['journal'][key]=not value if type(value) is bool else 1 if value is None else value+1
                self.refused(f)
        for key in ('extra',):
            f=fixture();f['frame']['journal'][key]=0;self.refused(f)
    def test_missing_each_finalization_field_is_refused(self):
        for key in fixture()['frame']['journal']:
            f=fixture();del f['frame']['journal'][key];self.refused(f)
    def test_final_status_and_footer_status_are_strict(self):
        for lane in ('frame','footer'):
            for key,value in status(4 if lane=='frame' else 3).items():
                f=fixture();s=f['frame']['status'] if lane=='frame' else f['rows'][3]['status']
                s[key]=not value if type(value) is bool else 1 if value is None else value+1
                if lane=='footer':f['journal']=b''.join(encode(r) for r in f['rows'])
                self.refused(f)
    def test_footer_prefix_and_total_actual_byte_counts(self):
        for key in ('writtenRowsBeforeFooter','writtenBytesBeforeFooter','finalWriteOutcome','flushOutcome','closeOutcome'):
            f=fixture();f['rows'][3][key]=0 if type(f['rows'][3][key]) is int else 'FALSE_CLAIM'
            f['journal']=b''.join(encode(r) for r in f['rows']);self.refused(f)
        f=fixture();f['journal']=b' '+f['journal'];self.refused(f)
    def test_extra_missing_partial_and_adverse_rows(self):
        for mode in ('extra','missing','partial','adverse','sequence','version'):
            f=fixture()
            if mode=='extra':f['journal']+=encode({'stage':'diagnostic-adverse'})
            elif mode=='missing':f['journal']=b''.join(encode(r) for r in f['rows'][:3])
            elif mode=='partial':f['journal']=f['journal'][:-1]
            elif mode=='adverse':f['rows'][2]['failed']=True;f['journal']=b''.join(encode(r) for r in f['rows'])
            else:f['rows'][1][mode]=99;f['journal']=b''.join(encode(r) for r in f['rows'])
            self.refused(f)
    def test_context_hwnd_width_value_pid_and_parent_join(self):
        for row,key,value in [(0,'projectId','wrong'),(0,'windowId','wrong'),(0,'epoch',3),(0,'role','workspace'),(0,'branch','attached'),(0,'webContentsId',True),(1,'mainPid',1),(1,'senderWebContentsId',9),(1,'parentWebContentsId',None),(1,'parentWebContentsStatus','ABSENT'),(1,'handleBytes',4),(1,'handleHex','0'*16),(1,'handleHex','01'*8)]:
            f=fixture();f['rows'][row][key]=value;f['journal']=b''.join(encode(r) for r in f['rows']);self.refused(f)
        b=dict(BINDING,pointerBits=32,parentHwnd=0xfedcba98)
        self.assertEqual(self.call(fixture(binding=b))['parentHwnd'],0xfedcba98)
    def test_binding_exact_types_and_no_js_rounding(self):
        for key,value in [('mainPid',True),('epoch',2.0),('pointerBits',64.0),('parentHwnd',float(BINDING['parentHwnd'])),('parentHwnd',True),('projectId',object()),('extra',1)]:
            f=fixture();f['binding'][key]=value;self.refused(f)
    def test_selected_wrong_ambiguous_or_malformed_is_refused(self):
        for key,value in [('selectedPath',FIXED+'x'),('selectedPath',FIXED.lower()),('selectedPath','\ud800'),('fileCount',2),('fileCount',True),('selectedPathPresent',False),('canceled',True)]:
            f=fixture();f['rows'][2][key]=value
            f['journal']=b''.join((json.dumps(r,ensure_ascii=True,separators=(',',':'))+'\n').encode('utf8') for r in f['rows']);self.refused(f)
    def test_duplicate_json_keys_in_rows_frame_stages(self):
        for lane in ('journal','frame','stages'):
            f=fixture();journal,stdout,stderr,binding=streams(f)
            if lane=='journal':journal=journal.replace(b'"version":1',b'"version":1,"version":1',1)
            elif lane=='frame':stdout=stdout.replace(b'"version":2',b'"version":2,"version":2',1)
            else:stdout=stdout.replace(b'"elapsedMs":0',b'"elapsedMs":0,"elapsedMs":0',1)
            with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout,stderr,binding)
    def test_nan_infinity_invalid_encoding_and_surrogate(self):
        for raw in (b'\xff\n',b'{"v":NaN}\n',b'{"v":Infinity}\n',b'{"v":1e9999}\n',b'{"v":"\\ud800"}\n'):
            f=fixture();f['journal']=raw;self.refused(f)
    def test_stream_late_adverse_markers_anywhere(self):
        for marker in ('SIREN_PICKER_FINAL_ADVERSE','SIREN_CLOSE_FAILURE','SIREN_CLOSE_ROLLBACK_FAILURE'):
            for lane in ('stdout','stderr'):
                f=fixture();journal,stdout,stderr,binding=streams(f)
                if lane=='stdout':stdout+=('prefix '+marker+' late\n').encode()
                else:stderr+=('prefix '+marker+' late\n').encode()
                with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout,stderr,binding)
    def test_final_newline_required_in_both_nonempty_streams(self):
        for lane in ('stdout','stderr'):
            f=fixture();journal,stdout,stderr,binding=streams(f)
            if lane=='stdout':stdout=stdout[:-1]
            else:stderr=b'partial'
            with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout,stderr,binding)
    def test_old_duplicate_wrong_source_pid_and_frame_markers(self):
        for mode in ('v1','source','pid','duplicate','stderr','confusion'):
            f=fixture()
            if mode=='v1':f['frame']['version']=1;f['frame']['probe']='siren-picker-final-close-v1'
            elif mode=='source':f['frame']['source']=SOURCE+'x'
            elif mode=='pid':f['frame']['mainPid']+=1
            journal,stdout,stderr,binding=streams(f)
            if mode=='duplicate':stdout+=encode(f['frame'])
            elif mode=='stderr':stderr=encode(f['frame'])
            elif mode=='confusion':stdout+=b'not a frame siren-picker-final-close-v2\n'
            with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout,stderr,binding)
    def test_shutdown_order_fields_progress_and_frame_position(self):
        for mode in ('order','missing','float','bool','identity','pending','backwards','framefirst'):
            f=fixture()
            if mode=='order':f['stages'][0],f['stages'][1]=f['stages'][1],f['stages'][0]
            elif mode=='missing':f['stages'].pop()
            elif mode=='float':f['stages'][0]['elapsedMs']=0.0
            elif mode=='bool':f['stages'][0]['pendingWrites']=False
            elif mode=='identity':f['stages'][0]['hasProcessIdentity']=False
            elif mode=='pending':f['stages'][-1]['pendingWrites']=1
            elif mode=='backwards':f['stages'][0]['elapsedMs']=99
            journal,stdout,stderr,binding=streams(f)
            if mode=='framefirst':stdout=encode(f['frame'])+b''.join(b'SIREN_CLOSE_STAGE '+encode(r) for r in f['stages'])
            with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout,stderr,binding)
    def test_raw_byte_bounds_and_exact_input_types(self):
        f=fixture();journal,stdout,stderr,binding=streams(f)
        for args in [(b'x'*11265,stdout,stderr,binding),(journal,b'x'*1048577,stderr,binding),(journal,stdout,b'x'*1048577,binding),(bytearray(journal),stdout,stderr,binding)]:
            with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](*args)
        self.assertEqual(CONSUMER['consume'](journal.decode(),stdout.decode(),'',binding)['providerOutcome'],'SELECT')
    def test_closed_row_and_frame_fields_and_exact_count_types(self):
        for row in range(4):
            f=fixture();f['rows'][row]['extra']=0;f['journal']=b''.join(encode(r) for r in f['rows']);self.refused(f)
            for key in tuple(fixture()['rows'][row]):
                f=fixture();del f['rows'][row][key];f['journal']=b''.join(encode(r) for r in f['rows']);self.refused(f)
        for key in tuple(fixture()['frame']):
            f=fixture();del f['frame'][key];self.refused(f)
        for row,key in [(0,'version'),(0,'sequence'),(0,'ordinal'),(0,'epoch'),(0,'webContentsId'),(1,'mainPid'),(1,'handleBytes'),(2,'fileCount'),(3,'writtenRowsBeforeFooter')]:
            f=fixture();f['rows'][row][key]=True;f['journal']=b''.join(encode(r) for r in f['rows']);self.refused(f)
    def test_decode_depth_escaped_markers_and_complete_stream_bounds(self):
        f=fixture();journal,stdout,stderr,binding=streams(f)
        for bad in [b'{"nested":'+b'['*17+b'0'+b']'*17+b'}\n',b'{"probe":"siren-picker-final-close-v9"}\n']:
            with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout+bad,stderr,binding)
        escaped=encode(f['frame']).replace(b'siren-picker-final-close-v2',b'siren-picker-final-close-v\\u0032')
        stages=b''.join(b'SIREN_CLOSE_STAGE '+encode(r) for r in f['stages'])
        self.assertTrue(CONSUMER['consume'](journal,stages+escaped,stderr,binding)['observationComplete'])
        with self.assertRaises(CONSUMER['Refused']):CONSUMER['consume'](journal,stdout+escaped,stderr,binding)
        padding=b'x'*(1048576-len(stdout)-1)+b'\n'
        self.assertTrue(CONSUMER['consume'](journal,stdout+padding,stderr,binding)['observationComplete'])
        self.assertTrue(CONSUMER['consume'](journal,stdout,b'x'*1048575+b'\n',binding)['observationComplete'])
    def test_context_limits_and_foreign_binding_key_are_refused_without_callbacks(self):
        b=dict(BINDING,projectId='x'*128,windowId='y'*128,epoch=9007199254740991)
        self.assertTrue(self.call(fixture(binding=b))['observationComplete'])
        for key,value in [('mainPid',0),('mainPid',4294967296),('projectId','x'*129),('projectId','a/b'),('epoch',9007199254740992),('parentHwnd',2**64),('parentHwnd',0)]:
            f=fixture();f['binding'][key]=value;self.refused(f)
        class Foreign:
            def __hash__(self):return 123
            def __eq__(self,other):raise AssertionError('foreign equality called')
            def __str__(self):raise AssertionError('foreign formatting called')
        f=fixture();f['binding'][Foreign()]=1;self.refused(f)
