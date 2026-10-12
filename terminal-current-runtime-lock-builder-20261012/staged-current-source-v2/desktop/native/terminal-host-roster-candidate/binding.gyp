{
  "targets": [
    {
      "target_name": "siren_terminal_host_roster_candidate",
      "sources": [
        "ownership.cc"
      ],
      "defines": [
        "NAPI_VERSION=10",
        "_WIN32_WINNT=0x0A00",
        "WIN32_LEAN_AND_MEAN",
        "NOMINMAX"
      ],
      "win_delay_load_hook": "true",
      "libraries": [
        "kernel32.lib",
        "advapi32.lib"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "AdditionalOptions": [
            "/std:c++20"
          ]
        }
      }
    }
  ]
}
