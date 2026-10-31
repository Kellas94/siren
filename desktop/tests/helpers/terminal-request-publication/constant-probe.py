"""Test-only status adapter; never serialize a possibly nonstandard consumer value."""
from pathlib import Path
import importlib.util
import json
import sys

source = Path(__file__).resolve().with_name('consumer.py')
spec = importlib.util.spec_from_file_location('request_publication_repair_consumer', source)
consumer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(consumer)
try:
    value = consumer.read_committed(Path(sys.argv[1]), sys.argv[2], 21744)
    result = dict(status='pending' if value is None else 'committed')
except BaseException as error:
    result = dict(status='error', error=dict(type=type(error).__name__, message=str(error)))
print(json.dumps(result, allow_nan=False))
