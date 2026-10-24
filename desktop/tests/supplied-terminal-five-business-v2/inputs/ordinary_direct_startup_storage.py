"""Unexecuted startup-storage source for the coherent direct-owner candidate.

Builds supplied-value buffers only; no DLL resolution or process/native IO call.
Original handle custody, fixed checked imports, alias ownership and executable
admission remain future integration obligations. Pointer values are not authority.
"""


def _need(value, code):
    if value is not True:
        raise ValueError('DIRECT_STARTUP_STORAGE:' + code)


def _handle(value):
    # Exclude null, pseudo handles and truncation. Actual original-handle
    # authority must come from the qualified owner, not this numeric predicate.
    return type(value) is int and 0 < value < (1 << 64) - 16


class _StartupStorage:
    """Strong storage exists before CreateProcessW can write its result slot.

    No method performs creation. A future owner must retain this instance even
    if creation returns ambiguously or later identity/bookkeeping fails.
    """
    def __init__(self, c, layouts, plans, plan, inherited_handles, job_handles):
        plan = plans._validate_fixed_plan(plan)
        _need(type(inherited_handles) is tuple and len(inherited_handles) == 3 and
              all(_handle(v) for v in inherited_handles) and len(set(inherited_handles)) == 3,
              'EXACT_STDIN_STDOUT_STDERR_HANDLES')
        _need(type(job_handles) is tuple and 1 <= len(job_handles) <= 5 and
              all(_handle(v) for v in job_handles) and len(set(job_handles)) == len(job_handles),
              'SUPPLIED_ORDERED_JOB_HANDLES')
        _need(not set(inherited_handles).intersection(job_handles), 'DISJOINT_HANDLE_ROLES')
        # This uses the fixed runtime's helper, not a caller-supplied command
        # resolver. Its loaded bytes/alias must join the future checked closure.
        import subprocess
        command = subprocess.list2cmdline(plan.argv)
        _need(type(command) is str and '\x00' not in command and len(command) <= 32766,
              'BOUNDED_MUTABLE_COMMAND')
        environment = ''.join(k+'='+v+'\x00' for k,v in plan.environment)+'\x00'
        _need(environment.endswith('\x00\x00') and not environment.endswith('\x00\x00\x00'),
              'DOUBLE_NUL_ENVIRONMENT')
        self._c, self._layouts, self._plan = c, layouts, plan
        self.command_buffer = c.create_unicode_buffer(command)
        # Fixed plans currently contain ASCII values. Size is explicitly the
        # full double-NUL block; do not silently append a third terminator.
        _need(all(ord(ch) < 128 for ch in environment), 'FIXED_ENVIRONMENT_CHARACTERS')
        self.environment_buffer = c.create_unicode_buffer(environment, len(environment))
        self.inherited_handles = (layouts['HANDLE'] * 3)(*inherited_handles)
        self.job_handles = (layouts['HANDLE'] * len(job_handles))(*job_handles)
        self.startup = layouts['STARTUPINFOEXW']()
        self.process_information = layouts['PROCESS_INFORMATION']()
        self.startup.StartupInfo.cb = c.sizeof(layouts['STARTUPINFOEXW'])
        self.startup.StartupInfo.dwFlags = 0x00000100
        self.startup.StartupInfo.hStdInput = inherited_handles[0]
        self.startup.StartupInfo.hStdOutput = inherited_handles[1]
        self.startup.StartupInfo.hStdError = inherited_handles[2]
        self.attribute_buffer = None
        self.attribute_state = 'NOT_ALLOCATED'
        self.attribute_updates = dict(HANDLE_LIST='NOT_ATTEMPTED', JOB_LIST='NOT_ATTEMPTED')
        self.creation_state = 'NOT_ATTEMPTED'
        self.storage_released = False

    def allocate_attribute_storage(self, required_bytes):
        # Proposed allocation guard for the fixed two-attribute profile. This
        # is not a change to any existing evidence/body/aggregate byte cap.
        _need(not self.storage_released and self.attribute_state == 'NOT_ALLOCATED' and
              self.creation_state == 'NOT_ATTEMPTED' and type(required_bytes) is int and
              1 <= required_bytes <= 65536, 'ATTRIBUTE_STORAGE')
        self.attribute_buffer = self._c.create_string_buffer(required_bytes)
        self.startup.lpAttributeList = self._c.cast(self.attribute_buffer, self._layouts['LPVOID'])
        self.attribute_state = 'ALLOCATED'

    def begin_attribute_initialization(self):
        _need(not self.storage_released and self.attribute_state == 'ALLOCATED' and
              self.creation_state == 'NOT_ATTEMPTED', 'INITIALIZATION_BEGIN')
        self.attribute_state = 'INIT_PENDING'

    def observe_attribute_initialization(self, outcome):
        _need(not self.storage_released and self.attribute_state == 'INIT_PENDING' and
              type(outcome) is str and outcome in ('INITIALIZED','FAILED','UNRESOLVED'),
              'ATTRIBUTE_INITIALIZATION')
        self.attribute_state = outcome

    def mark_creation_attempt(self):
        _need(not self.storage_released and self.attribute_state == 'INITIALIZED' and
              self.creation_state == 'NOT_ATTEMPTED' and
              all(value == 'UPDATED' for value in self.attribute_updates.values()),
              'SINGLE_CREATION_ATTEMPT')
        self.creation_state = 'ATTEMPTED'

    def begin_attribute_update(self, name):
        _need(not self.storage_released and self.attribute_state == 'INITIALIZED' and
              self.creation_state == 'NOT_ATTEMPTED' and type(name) is str and
              name in ('HANDLE_LIST','JOB_LIST') and
              self.attribute_updates[name] == 'NOT_ATTEMPTED' and
              not any(v in ('PENDING','UNRESOLVED') for v in self.attribute_updates.values()),
              'ATTRIBUTE_UPDATE_BEGIN')
        self.attribute_updates[name] = 'PENDING'

    def observe_attribute_update(self, name, outcome):
        _need(not self.storage_released and self.attribute_state == 'INITIALIZED' and
              self.creation_state == 'NOT_ATTEMPTED' and type(name) is str and
              name in ('HANDLE_LIST','JOB_LIST') and
              self.attribute_updates[name] == 'PENDING' and type(outcome) is str and
              outcome in ('UPDATED','FAILED','UNRESOLVED'), 'ATTRIBUTE_UPDATE')
        self.attribute_updates[name] = outcome

    def observe_creation_return(self, outcome):
        _need(not self.storage_released and self.creation_state == 'ATTEMPTED' and
              type(outcome) is str and outcome in ('RETURNED_TRUE','RETURNED_FALSE','UNRESOLVED'),
              'CREATION_RETURN')
        self.creation_state = outcome

    def begin_attribute_destruction(self):
        _need(not self.storage_released and self.attribute_state == 'INITIALIZED' and
              self.creation_state in ('NOT_ATTEMPTED','RETURNED_TRUE','RETURNED_FALSE') and
              not any(v in ('PENDING','UNRESOLVED') for v in self.attribute_updates.values()),
              'ATTRIBUTE_DESTRUCTION_BEGIN')
        self.attribute_state = 'DESTROY_PENDING'

    def observe_attribute_destruction(self, outcome):
        _need(not self.storage_released and
              self.attribute_state == 'DESTROY_PENDING' and
              self.creation_state in ('NOT_ATTEMPTED','RETURNED_TRUE','RETURNED_FALSE') and
              not any(v in ('PENDING','UNRESOLVED') for v in self.attribute_updates.values()) and
              type(outcome) is str and
              outcome in ('DESTROYED','DESTROY_FAILED','DESTROY_UNRESOLVED'),
              'ATTRIBUTE_DESTRUCTION')
        self.attribute_state = outcome

    def release_backing_storage(self):
        # Never hide an unresolved native use by dropping strong backing values.
        # The retained PROCESS_INFORMATION slot is deliberately NOT released.
        known_uninitialized = (self.attribute_state in ('NOT_ALLOCATED','ALLOCATED','FAILED') and
                               self.creation_state == 'NOT_ATTEMPTED' and
                               all(v == 'NOT_ATTEMPTED' for v in self.attribute_updates.values()))
        known_destroyed = (self.attribute_state == 'DESTROYED' and
                           self.creation_state in ('NOT_ATTEMPTED','RETURNED_TRUE','RETURNED_FALSE') and
                           not any(v in ('PENDING','UNRESOLVED') for v in self.attribute_updates.values()))
        _need(not self.storage_released and (known_uninitialized or known_destroyed), 'STORAGE_LIFETIME')
        # Drop the complete STARTUPINFOEX reference graph, not only its named
        # buffer fields. External aliases remain a future owner/custody concern.
        self.startup = None
        self.attribute_buffer = None
        self.inherited_handles = None
        self.job_handles = None
        self.command_buffer = None
        self.environment_buffer = None
        self.storage_released = True
