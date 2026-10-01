# Electron/Chromium pentru SIREN portabil — decizie și limite

Data: 2 octombrie 2026. Autor: /root. Cercetare și consemnarea unei decizii a utilizatorului; nu raport independent de securitate, benchmark sau aprobare de publicare.

## Decizia

La întrebarea dacă ar fi mai bine să renunțăm la Chromium, recomandarea prezentată a fost păstrarea Electron cu Chromium inclus pentru prima distribuție portabilă, cu izolare, patchuri și nucleu SIREN separat. Utilizatorul a confirmat: „ok ramanem pe recomandare”. Alegerea motorului este confirmată. Login-ul online cu 30 de zile offline și faptul că SIREN rămâne privat cu dependențe open source provin din răspunsurile anterioare explicite. Nu atribuim acestui răspuns aprobarea întregii specificații, a unui plan nescris sau a unei lansări.

## Comparația relevantă

| Variantă | Motor și patchuri | Implicație pentru portabilitate |
| --- | --- | --- |
| Electron inclus | Chromium inclus; publisher-ul SIREN distribuie patchurile runtime-ului | Pachet autonom de motorul web al sistemului; mărimea și consumul se măsoară |
| Tauri + WebView2 Evergreen, Windows | Tot motor Chromium prin Edge/WebView2; runtime actualizat separat | Runtime necesar pe sistem, cu verificarea disponibilității; nu este alternativa fără Chromium |
| Tauri + WebView2 Fixed Version, Windows | Runtime inclus; publisher-ul distribuie patchurile | Autonomie a runtime-ului, cu costul distribuției lui |
| GUI complet nativă fără webview | Elimină motorul web dacă toate funcțiile sunt adaptate corespunzător | Cost de migrare pentru Docs, diagrame, exporturi și UI; fără avantaj de securitate sau performanță dovedit în SIREN |

[Electron Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox) explică izolarea renderer-ului și dependența patchurilor de publisher-ul aplicației. [Tauri](https://github.com/tauri-apps/tauri) identifică WebView2 pe Windows. [Microsoft Evergreen versus Fixed Version](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version) descrie modurile de distribuție și actualizare. Actualizările Evergreen presupun disponibilitatea mecanismului de update și a conexiunii; nu se promite patch instantaneu pe un PC offline.

## Consecințe pentru design

Interfața nu primește acces general la disc, shell sau acreditări. Sandbox-ul, context isolation și Node integration oprită sunt cerințe ale viitoarei implementări. Datele importate și linkurile sunt tratate ca neîncrezute; Python importat nu este executat. Testele trebuie să observe refuzul operațiilor native neautorizate și defectele plantate, nu numai existența opțiunilor de configurare.

Updater-ul SIREN trebuie să distribuie și runtime-ul inclus. Inventarul build-ului identifică versiunile Electron/Chromium/Node și componentele/licențele distribuite. Actualizarea programului nu depinde de un login valid; verificarea pachetului și recuperarea după eșec păstrează proiectele și drafturile. Nu există încă updater implementat sau serviciu de producție.

Scalabilitatea se tratează prin editor, analiză în fundal și stocare, cu măsurători separate. Nu atribuim latența T256 motorului Chromium fără profilare și nu declarăm noile ținte de volum drept limite deja susținute. Protecția împachetării ori alegerea unei GUI native nu garantează că sursa distribuită nu poate fi inspectată.

## Artefacte și următoarea etapă

Specificarea completă actualizată este `docs/superpowers/specs/2026-10-02-siren-portable-foundation-design-v2.md`. Prima versiune a specificației se păstrează nemodificată. Revizuirea specificației complete precedă planul; revizuirea planului și alegerea metodei precedă implementarea. Nicio aplicație live, dependență de produs, serviciu extern sau listă de defecte nu este schimbată prin această consemnare.
