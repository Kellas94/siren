"""Unexecuted fixed command/environment source for the five-edge migration.

No imports, path lookup, filesystem access, shell, launch or arbitrary command.
The two proposed external scripts are not installed or supplied by this module.
These immutable values are plan data, not source/custody/native authority.
"""
_ROOT = r'C:\Claude\SIREN_WORK\terminal-operational-four-stage-candidate-v1-20261022'
_WORK = r'C:\Claude\SIREN_WORK'
_IMAGE = _ROOT + '-image'
_RUNTIME = _IMAGE + r'\runtime'
_PYTHON = _WORK + r'\source-sync-ci-evidence-retention-20261016\runtime\python\python.exe'
_NODE = _WORK + r'\source-sync-ci-evidence-retention-20261016\runtime\node\node.exe'
_ELECTRON = _RUNTIME + r'\electron\electron.exe'
_PYTHON_FLAGS = ('-B', '-I', '-S', '-X', 'utf8')
_CREATION_FLAGS = 0x00000004 | 0x00000400 | 0x00080000 | 0x08000000
_ROLES = (('owner','T0','C0'), ('outer','C0','outer'), ('inner','outer','inner'),
          ('electron','inner','electron'), ('ui','inner','ui'))


def _need(value, code):
    if value is not True:
        raise ValueError('FIXED_DIRECT_PLAN:' + code)


def _environment():
    # Exact maintained C.owned_environment values, preserving absent directories
    # before O's own freshness checks. Constructing this tuple creates nothing.
    profile = _ROOT + r'\owned-profile'
    return tuple(sorted((
        ('SystemRoot', r'C:\Windows'), ('WINDIR', r'C:\Windows'),
        ('PATH', r'C:\Windows\System32'), ('TEMP', _ROOT+r'\temp'),
        ('TMP', _ROOT+r'\temp'), ('USERPROFILE', profile),
        ('APPDATA', profile+r'\AppData\Roaming'),
        ('LOCALAPPDATA', profile+r'\AppData\Local'),
        ('HOMEDRIVE', 'C:'), ('HOMEPATH', profile[2:]),
    ), key=lambda row:row[0].casefold()))


def _argv(edge):
    if edge == 'owner':
        return (_PYTHON,) + _PYTHON_FLAGS + (_ROOT+r'\run_owned_capture_owner_v1.py', '--capture-owner')
    if edge == 'outer':
        return (_PYTHON,) + _PYTHON_FLAGS + (_ROOT+r'\run-controller.py', '--run')
    if edge == 'inner':
        return (_PYTHON,) + _PYTHON_FLAGS + (_ROOT+r'\run-owned-inner.py', '--owned-inner')
    if edge == 'electron':
        return (_ELECTRON, _RUNTIME+r'\desktop', '--disable-backgrounding-occluded-windows',
                '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
                '--user-data-dir='+_ROOT+r'\data', '--siren-test-root='+_ROOT+r'\data',
                '--enable-logging=file', '--log-file='+_ROOT+r'\execution\electron-startup.log')
    if edge == 'ui':
        return (_NODE, '--import', 'file:///C:/Claude/SIREN_WORK/preload-owned-ui-main-v1-20261022.mjs',
                _ROOT+r'\ui-worker-v2\owned-ui-worker.mjs', '--owned-ui')
    raise ValueError('FIXED_DIRECT_PLAN:EDGE')


class _FixedPlan(tuple):
    __slots__ = ()

    def __new__(cls, edge):
        _need(type(edge) is str and edge in tuple(row[0] for row in _ROLES), 'EDGE')
        roles = next(row for row in _ROLES if row[0] == edge)
        argv = _argv(edge)
        # Metadata only: inherited240/210-second budgets do not adopt new
        # external-owner or whole-attempt cleanup deadlines.
        duration = 240 if edge == 'inner' else 210 if edge in ('electron','ui') else None
        return tuple.__new__(cls, (edge, roles[1], roles[2], argv[0], argv, _ROOT,
                                   _environment(), _CREATION_FLAGS, duration))

    @property
    def edge(self):return self[0]
    @property
    def parent(self):return self[1]
    @property
    def child(self):return self[2]
    @property
    def application(self):return self[3]
    @property
    def argv(self):return self[4]
    @property
    def cwd(self):return self[5]
    @property
    def environment(self):return self[6]
    @property
    def creation_flags(self):return self[7]
    @property
    def maintained_parent_budget_seconds(self):return self[8]


def _validate_fixed_plan(plan):
    _need(type(plan) is _FixedPlan and len(plan) == 9, 'PLAN_TYPE')
    def exact(a,b):
        if type(a) is not type(b):return False
        if type(a) in (tuple,_FixedPlan):
            return len(a)==len(b) and all(exact(x,y) for x,y in zip(a,b))
        return a==b
    _need(type(plan.edge) is str and exact(plan,_FixedPlan(plan.edge)), 'FIXED_PLAN_VALUE')
    _need(all(type(value) is str and '\x00' not in value for value in plan.argv), 'ARGV_VALUE')
    _need(all(type(k) is str and type(v) is str and '\x00' not in k+v and '=' not in k
              for k,v in plan.environment), 'ENVIRONMENT_VALUE')
    return plan
