# SIREN Round 14 — apply order

Apply these scripts in the stated order to a private copy of `FROZEN_R14_BASE.html`.
Each script checks its exact input SHA-256, asserts every replacement anchor's exact occurrence
count before writing, writes a same-directory temporary file, and renames it atomically.

| # | Job | Script | Script SHA-256 | Input application SHA-256 | Output application SHA-256 |
|---:|:---:|---|---|---|---|
| 1 | 1 | `R14_01_inline_marker_open.js` | `CE62D7EF4232D6C34488979A5FABE803BD32EFBAAE57AAF4DA9EFBDDEC2C7E56` | `60585A8B7764AE989F96BE07447878F6CDBFF9796A36484BDC7AE52A6479E77A` | `FE8715E1C7F2CD5F942D8097C74089B27A272A39F6CC839D975A64EB3D49BEEC` |
| 2 | 2 | `R14_02_marker_after_drag.js` | `74119ECCF5323102608CF4D2B3789581531985426CACD2E62C1A77CD515D2138` | `FE8715E1C7F2CD5F942D8097C74089B27A272A39F6CC839D975A64EB3D49BEEC` | `D3123A9C9358386C4ACA4D236A20EB92199EC2EF712768074F706CA4EE7161EC` |
| 3 | 3 | `R14_03_marker_not_drag_surface.js` | `743FC5B70F2EC0C9ACD24DCB2735D7A1DE2F5422EC85C760B62A2F3A33BB1DCF` | `D3123A9C9358386C4ACA4D236A20EB92199EC2EF712768074F706CA4EE7161EC` | `DD662E4A2C68759DC669D92CE39C30D23191A4A8F28FBB97E33E32E6073C275C` |
| 4 | 4 | `R14_04_remove_visibility_refusal.js` | `318C1BC1159A95B395EA35DEA150DE038C2FF6609DA85FE3C311C8B7A80C1F82` | `DD662E4A2C68759DC669D92CE39C30D23191A4A8F28FBB97E33E32E6073C275C` | `9BE2CDC19A183A777A9C7DEF70CCDEEC6BF57338D811B4BA18E24527C7A3314A` |
| 5 | 5 | `R14_05_preserve_build_draft.js` | `1902280216BD165046DFC919DF22FA46A9DCF27DC59F856CC679B9AE9237CBBC` | `9BE2CDC19A183A777A9C7DEF70CCDEEC6BF57338D811B4BA18E24527C7A3314A` | `7A87A3F1E956FE7E6BF5A46FE5365B0F38805A6A0400599106AEA1691679F1AA` |
| 6 | 6 | `R14_06_release_tab.js` | `EA1F23B9612200323BD8A2368604D46176A9CA680BCC586073EE655CF64358AE` | `7A87A3F1E956FE7E6BF5A46FE5365B0F38805A6A0400599106AEA1691679F1AA` | `6F309203CFB51A19EECF11AF68531448C3A26082E9DDC7677F6237724A9FE064` |
| 7 | 7 | `R14_07_escape_yields.js` | `CAD6045CCA49E34748AC03FBD386F1DF5E7BE2D4092EA08D358E0E2F1DE869D1` | `6F309203CFB51A19EECF11AF68531448C3A26082E9DDC7677F6237724A9FE064` | `9E7DB5F87F39BA8C0FA597C81CE0A5FE6981EFDBA62523D7C5FE161F3299E41F` |
| 8 | 8 | `R14_08_enable_reference_jump.js` | `C46E70E169532108844AFCDBFC3748E7B075355B800AF58934A3CEAB7D942658` | `9E7DB5F87F39BA8C0FA597C81CE0A5FE6981EFDBA62523D7C5FE161F3299E41F` | `0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97` |

Final application size: **8,599,649 bytes**.

## Anchor report

No text anchor moved: every replacement anchor in all eight scripts matched exactly once on its
pinned input. Two location/timing descriptions in the brief needed factual clarification, without
loosening an anchor:

- item 6's unique Tab branch begins on base line 22650, one line before the approximate 22651
  location in the brief;
- item 2's suppression window is 400 ms after pointer-up, so the meaningful sideways test must
  click inside 400 ms; a 500 ms check would already be outside the guard.

During the first dry run, item 4's post-condition was tightened from a file-wide census of nested
animation frames (the file has two) to the unique `landWorkpaperDiagramNode` settling pair. This was
a verifier correction, not application anchor drift; the app was not written until the corrected
post-condition passed.

## Replay and refusal evidence

- A fresh replay from the frozen base applied all eight scripts in order and produced the exact
  final SHA-256 above; it was byte-identical to the independently built private copy.
- Each script was then invoked against the final SHA (therefore the wrong input for every script).
  All eight exited non-zero, and the target remained byte-identical at
  `0C17FB6673FD1FC5DE24CC5C474B49EAE85505589E373E7ABA870BE345338F97`.
