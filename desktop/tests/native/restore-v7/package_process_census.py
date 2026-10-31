"""Configured bounded CIM with raw stdout/stderr retained for every sample."""
from pathlib import Path
import time
import producer_collector as collect
OUT=None
DEADLINE=None
SERIAL=0
def configure(powershell,out,deadline):
    global OUT,DEADLINE
    collect.POWERSHELL=Path(powershell);OUT=Path(out);DEADLINE=deadline
    collect.no_links(OUT.parent);OUT.mkdir()
def census(scopeFile):
    global SERIAL
    collect.need(OUT is not None and DEADLINE is not None,'EXPLICIT_CENSUS_CONFIGURATION_REQUIRED')
    remaining=DEADLINE-time.monotonic();collect.need(remaining>0,'CENSUS_WHOLE_OPERATION_DEADLINE')
    SERIAL+=1
    return collect.census(scopeFile,OUT,'sample-'+str(SERIAL),min(10,remaining))
