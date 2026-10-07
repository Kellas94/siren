{
 'targets': [{
  'target_name': 'terminal_host_guard', 'sources': ['host.cc'],
  'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX'],
  'win_delay_load_hook': 'true', 'libraries': ['kernel32.lib'],
  'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
 }, {
  'target_name': 'terminal_host_guard_negative', 'sources': ['host.cc'],
  'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX', 'SIREN_TEST_DISABLE_HOST_MONITOR=1'],
  'win_delay_load_hook': 'true', 'libraries': ['kernel32.lib'],
  'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
 }, {
  'target_name': 'terminal_host_guard_stop_failure', 'sources': ['host.cc'],
  'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX', 'SIREN_TEST_FAIL_SECOND_STOP=1'],
  'win_delay_load_hook': 'true', 'libraries': ['kernel32.lib'],
  'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
 }, {
  'target_name': 'terminal_host_guard_legacy_stop_failure', 'sources': ['host.cc'],
  'defines': ['NAPI_VERSION=10', '_WIN32_WINNT=0x0A00', 'WIN32_LEAN_AND_MEAN', 'NOMINMAX', 'SIREN_TEST_FAIL_SECOND_STOP=1', 'SIREN_TEST_LEGACY_STOP_LATCH=1'],
  'win_delay_load_hook': 'true', 'libraries': ['kernel32.lib'],
  'msvs_settings': {'VCCLCompilerTool': {'AdditionalOptions': ['/std:c++20']}}
 }]
}
