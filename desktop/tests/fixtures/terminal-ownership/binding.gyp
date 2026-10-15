{
  'targets': [{
    'target_name': 'terminal_ownership_probe',
    'sources': ['primitives.cc'],
    'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX'],
    'win_delay_load_hook': 'true',
    'libraries': ['kernel32.lib'],
    'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
  }, {
    'target_name': 'terminal_job_lifetime',
    'sources': ['lifetime.cc'],
    'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX'],
    'win_delay_load_hook': 'true',
    'libraries': ['kernel32.lib'],
    'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
  }, {
    'target_name': 'terminal_job_lifetime_negative',
    'sources': ['lifetime.cc'],
    'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX', 'SIREN_LIFETIME_FAULT_RETAIN_OWNER=1'],
    'win_delay_load_hook': 'true',
    'libraries': ['kernel32.lib'],
    'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
  }]
}
