# SIREN — Sublime Portable, dependențe și licențe

Data: 2 octombrie 2026. Autor: /root. Stare: cercetare documentară și criterii de selecție; nu este un audit complet al pachetului SIREN existent ori al unui build desktop. Nicio bibliotecă sau dependență de produs nu este instalată prin această cercetare.

## Cerința clarificată

Utilizatorul cere dependențe open source, cât mai puține și justificate, și evitarea problemelor de licențiere. A clarificat explicit: **„Dependențe open source; SIREN rămâne privat”**. Nu există autorizare pentru publicarea sursei SIREN. Login-ul online și cele 30 de zile offline rămân alese.

Clarificarea următoare permite dependențe utile și dezvoltare proprie pentru independență și potrivirea cu nevoile produsului. Recomandarea este nucleu SIREN propriu plus componente permisive înlocuibile, cu alegeri între dezvoltare internă și reutilizare justificate pentru fiecare domeniu. Nu interpretăm această preferință ca cerință de a rescrie criptografia ori întregul motor UI/editor.

## Ce putem confirma despre Sublime

[Pagina oficială](https://www.sublimetext.com/download) oferă distribuția portabilă Windows. [EULA](https://www.sublimetext.com/eula) descrie produsul comercial și restricțiile distribuției. Nucleul Sublime Text nu este oferit ca bibliotecă open source pentru integrarea în SIREN; evaluarea gratuită nu conferă dreptul de redistribuire a produsului în aplicația noastră.

[Descrierea tehnică a dezvoltatorilor](https://www.sublimetext.com/blog/articles/hardware-accelerated-rendering) documentează un framework UI propriu, randare software care utilizează Skia și o cale GPU OpenGL. [Documentația GPU curentă](https://www.sublimetext.com/docs/gpu_rendering.html) confirmă modurile software/OpenGL. Articolul tehnic este din 2021: nu îl tratăm ca inventar exhaustiv al implementării build-ului din 2026 și nu extrapolăm cifrele de performanță la SIREN.

[Depozitul oficial Packages](https://github.com/sublimehq/Packages) publică definiții de sintaxă. Publicarea acestor fișiere și API-ul Python pentru extensii nu înseamnă că motorul editorului, UI-ul sau updater-ul sunt publicate sub aceeași licență. Nu avem sursa updater-ului intern sau un inventar verificat al tuturor DLL-urilor build-ului Sublime curent.

Concluzia aplicată: experiența „extrage și pornește”, fișierele de date separate și actualizarea din aplicație sunt repere de produs reutilizabile în design. Nu propunem copierea sau redistribuirea programului, a framework-ului propriu ori a motorului Sublime. Un proiect nativ scris integral de noi ar crește considerabil munca de UI/editor/export și responsabilitatea de mentenanță; nu rezultă ca necesar pentru portabilitate.

## Candidați pentru SIREN

| Componentă | Licența proiectului verificată upstream | Rol și limită |
| --- | --- | --- |
| [Electron](https://github.com/electron/electron/blob/main/LICENSE) | MIT pentru Electron | Reutilizează HTML/CSS/JS și include Chromium/Node; licența framework-ului nu acoperă automat toate componentele incluse |
| [Tauri](https://github.com/tauri-apps/tauri) | MIT/Apache-2.0 | Wrapper open source; folosește webview-ul platformei, inclusiv WebView2 pe Windows; nu este un produs fără runtime ori fără dependențe transitive |
| [CodeMirror 6](https://codemirror.net/) / [view LICENSE](https://github.com/codemirror/view/blob/main/LICENSE) | MIT pentru proiect/modulele citate | Editor candidat pentru etapa de scalabilitate; trebuie inventariate modulele exacte incluse |
| [Mermaid](https://github.com/mermaid-js/mermaid/blob/develop/LICENSE) | MIT pentru Mermaid | Diagrame, deja relevant în SIREN; bundle-ul real include alte componente care cer propriile verificări |

Acestea sunt licențe upstream ale proiectelor citate, nu verdict pentru o combinație de versiuni încă neconstruită. CodeMirror homepage a avut eroare la fetch direct; descrierea indexată oficială și licența modulului view au fost disponibile. Licențele urmează versiunile/artefactele efectiv distribuite, nu doar numele unui proiect.

[Documentația Tauri](https://v2.tauri.app/distribute/windows-installer/#webview2-installation-options) descrie dependența WebView2 și opțiunea de a include un runtime fix. [Distribuția Microsoft WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution) este o componentă separată de wrapper-ul Tauri: termeni, disponibilitate și responsabilitate de patch trebuie evaluate separat. Tauri mic pe un PC cu runtime existent nu demonstrează un pachet complet autonom mic.

## Recomandarea și politica de dependențe

Electron rămâne candidatul pragmatic pentru reutilizarea SIREN și un runtime inclus, însă nu este o alegere minimală ca pachet sau număr total de componente. Tauri merită comparat dacă prioritatea este reducerea runtime-ului distribuit, cu acceptarea dependenței de webview-ul Windows. Nu există încă benchmark sau inventar al două build-uri comparabile care să permită un verdict numeric.

Nu adăugăm un framework UI nou doar pentru a ambala aplicația. Nucleul existent, editorul ales și Mermaid au scopuri distincte; toolkit-urile și SDK-urile opționale se adaugă numai pentru o nevoie concretă. Reducerea dependențelor nu justifică rescrierea criptografiei sau a validării OAuth: pentru acelea se folosesc implementări menținute și verificate.

Politica propusă preferă MIT, BSD, ISC și Apache-2.0 pentru componentele adăugate. Fiecare dependență trebuie să aibă rol, sursă upstream, versiune fixată, licență, obligații de distribuție și responsabilitate de patch. Componentele cu condiții suplimentare se analizează explicit înainte de includere. Nu se pretinde că orice licență open source are aceleași condiții ori că eticheta „MIT” a framework-ului este verdictul întregului pachet.

Build-ul trebuie să producă un inventar al componentelor (SBOM sau echivalent), notice-urile/licențele necesare și să includă binarele runtime, componentele aduse indirect, modulele modificate, fonturile, iconurile și resursele exporturilor. Instrumentele folosite numai la build se disting de ce primește utilizatorul, cu verificarea condițiilor lor relevante. Un element distribuit neidentificat sau fără licență verificată blochează publicarea, nu este omis din raport.

Codul propriu pentru Docs/agenți, navigare, comparație și date rămâne controlat intern. Editorul/parserul/runtime-ul se izolează prin interfețe înlocuibile. Un fork ori modul nativ propriu este justificat de o funcție lipsă sau de o limitare măsurată, cu licențele păstrate și mentenanța asumată. Aceasta oferă independență fără a declara reutilizarea o problemă în sine. Sursele terților se distribuie/oferă dacă termenii lor o cer, chiar dacă sursa SIREN rămâne privată.

SIREN poate rămâne privat folosind componente permisive în condițiile lor; nu promitem „zero probleme de licensing” fără verificarea versiunilor și pachetului efectiv livrat. Licențele/notice-urile trebuie păstrate, iar drepturile asupra programului propriu și ale componentelor terțe rămân distincte. Această cercetare nu stabilește că întregul HTML v1.131.0 a trecut un audit de licențe și nici că orice viitor build Electron/Tauri va trece automat.

## Efect asupra designului

Specificația propusă pentru fundația portabilă păstrează contul online și offline-ul de 30 zile și adaugă cerința de dependențe open source cu inventar complet al distribuției. Protecția sursei SIREN nu poate însemna eliminarea notice-urilor terților sau pretinderea proprietății asupra lor. Alegerea runtime-ului rămâne propunere supusă revizuirii, nu o dependență deja instalată sau o arhitectură aprobată.
