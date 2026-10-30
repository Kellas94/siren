from pathlib import Path
import importlib.util,json,sys
p=Path(__file__).with_name('consumer.py');s=importlib.util.spec_from_file_location('request_publication_test_consumer',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
try:
 v=m.read_committed(Path(sys.argv[1]),sys.argv[2],21744)
 print(json.dumps(dict(status='pending' if v is None else 'committed',value=v)))
except BaseException as e:print(json.dumps(dict(status='error',error=dict(type=type(e).__name__,message=str(e)))))
