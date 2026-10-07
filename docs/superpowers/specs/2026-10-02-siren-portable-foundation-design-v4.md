# SIREN Desktop Portable — specificație propusă pentru fundație

Data: 2 octombrie 2026. Autor: /root. Revizia 4. Utilizatorul a confirmat specificația prezentată prin „Aprob planul”, în răspunsul la revizuirea specificației; planul scris nu exista încă. Sunt adăugate cerințele explicite: buton „Check for Updates”, distribuție propusă prin GitHub și actualizarea repository-ului. Răspunsul ulterior confirmă „Pachete publice semnate, sursă privată”. Această revizie consemnează aceste completări; utilizatorul cere și un modul Disaster Recovery pentru crash; planul de implementare scris trebuie revizuit înainte de execuție. Reviziile 1, 2 și 3 se păstrează nemodificate. Nu există încă implementare desktop sau updater livrat.

## Intenția și deciziile confirmate

SIREN trebuie să devină un instrument desktop complex pentru documentarea și revizuirea agenților, accesibil și unui utilizator care nu programează. Utilizatorul a ales distribuția portabilă înaintea unei ediții web, cere actualizări de securitate, protecția programului și login și urmărește capacitatea de a analiza sute de mii de linii de cod. Interfața calmă, temele, mai multe ferestre Code/Docs, comparația versiunilor, schemele și exporturile rămân relevante.

Răspunsuri explicite primite în această conversație: **cont online, cu lucru offline după activare**; **30 de zile offline**, cu reînnoire când există conexiune și păstrarea salvării/exportului dacă activarea expiră.

Clarificare ulterioară explicită: **dependențe open source, SIREN rămâne privat**. Se păstrează codul propriu privat și se reduc dependențele justificate, fără a elimina obligațiile componentelor terțe. Sublime Portable este reper de experiență; nucleul său comercial nu este o bibliotecă open source pe care o integrăm. Utilizatorul permite dependențe când sunt utile și dezvoltare proprie când este justificată de nevoile SIREN; criteriul este independența și potrivirea, nu numărul zero de biblioteci.

Propunerea tehnică este Windows x64 întâi, Electron pentru interfața existentă, stocare pe disc și un mecanism de distribuție verificată. Windows și versiunile runtime suportate se fixează și se verifică în plan; prima probă de acceptare identifică exact OS-ul și hardware-ul. Nu se presupune suport pentru toate versiunile Windows, macOS sau Linux.

## Împărțirea în livrări

1. **Fundația portabilă, această specificație:** pornire fără setup, separarea programului de date, importul unei copii a workspace-ului existent, limite între interfață și funcțiile native, login/activare și contractul updater-ului. Sub-livrările interne pentru shell/stocare, autentificare și update se verifică separat, apoi împreună. Un shell fără autentificarea și actualizarea reale rămâne prototip, nu ediție finală cu aceste funcții.
2. **Code pentru proiecte mari, specificație distinctă:** editor virtualizat, indexare în fundal, stocare separată a surselor, comparație și hărți la cerere. Se lucrează în ediția desktop; ambalarea nu ține loc de optimizare.
3. **Documentarea proiectelor/agenților mari:** legături între surse, module, agenți, Docs și release-uri; navigare și explicații cu origine verificabilă. Extinderile se proiectează după probele editorului și indexului.
4. **Ediția web și colaborarea:** amânate. Componentele de editor/Docs/analiză rămân separabile de adaptorul desktop pentru a permite reutilizarea.

## Situația de la care pornim

Aplicația instalată este v1.131.0/R78, 13.626.609 bytes, SHA-256 `5FCE39D9AFC9D8D9A7367647A23AA5B07A00C61BDC357E369805D0BD3754FAA4`, reconfirmat prin citire în această etapă. Fișierul live și release-urile istorice nu sunt modificate pentru acest design. Workspace-ul nu este un repository Git; documentul nu este pretins ca fiind comis în Git.

Implementarea curentă are limite proprii: hartă Python la 100.000 caractere sau 3.000 linii, maximum 120 blocuri; colorare la 100.000 caractere; import Code la 2 MiB; sursă Docs/bibliotecă la 500.000 caractere; bibliotecă la 4 MiB UTF-8; recuperarea cumulată a drafturilor la 2 MiB. Acestea rămân valabile până la schimbări efective verificate. T256, latența inserării native masive, rămâne deschis. Niciun defect existent nu se închide prin scrierea acestui document.

## Alegerea distribuției

**Alegere confirmată: Electron și folder/ZIP portabil, cu Chromium inclus.** După evaluarea riscurilor motorului, utilizatorul a răspuns explicit: „ok ramanem pe recomandare”. Se reutilizează interfața HTML/CSS/JS. Pachetul și memoria de bază mai mari se măsoară, iar actualizarea runtime-ului inclus este responsabilitatea SIREN. Actualizarea Chrome sau Edge instalat separat nu actualizează Electron inclus în SIREN.

Tauri nu elimină Chromium pe Windows: folosește Microsoft WebView2. Evergreen poate primi patchuri independent de aplicație, dar depinde de runtime-ul sistemului; Fixed Version inclus în pachet mută din nou responsabilitatea patchurilor la publisher. Aceasta rămâne o alternativă pentru o reevaluare viitoare, nu o a doua implementare în prima ediție. O interfață complet nativă ar necesita înlocuiri sau adaptări substanțiale pentru Docs, Mermaid, exporturi și interacțiunile existente; nu este justificată de măsurătorile actuale. Un launcher/helper nativ mic poate servi pornirii și actualizării fără rescrierea interfeței.

Nucleul SIREN și formatele proiectelor rămân independente de Electron; interfața accesează funcțiile native numai prin contractele adaptorului. Editorul virtualizat, indexarea în fundal și stocarea separată pentru surse mari fac parte din etapa de scalabilitate. Alegerea motorului singură nu rezolvă T256 și nu dovedește suportul pentru sute de mii de linii.

Electron este open source sub MIT, dar include Chromium/Node și alte componente; nu înseamnă puține componente totale sau o singură licență în distribuție. Tauri este open source sub MIT/Apache-2.0, cu webview-ul platformei și propriul lanț de dependențe. Se compară inventarul și runtime-ul necesar, nu doar numărul de pachete declarate direct. Nu se adaugă un framework UI nou pentru simpla ambalare a interfeței actuale. Cercetarea detaliată este în `docs/research/2026-10-02-siren-sublime-dependencies-licensing.md`.

Pachetul se extrage într-un director în care utilizatorul are drept de scriere. Pornirea nu cere instalarea unei platforme de dezvoltare. Un folder protejat sau un suport read-only produce un mesaj clar și posibilitatea de alegere a unei locații de date; aplicația nu solicită automat privilegii de administrator.

## Independența și dezvoltarea proprie

Nucleul specific SIREN se dezvoltă și se controlează intern: legăturile sursă–Docs–agent–release, explicațiile pentru un utilizator care nu programează, revizuirea/comparația, modelul de proiect și ferestrele Code/Docs. Componentele terțe se folosesc prin adaptoare mici și modele de date deținute de SIREN. Un serviciu de autentificare sau un editor nu devine autoritatea asupra proiectelor; înlocuirea lui trebuie să păstreze datele și identitățile.

| Domeniu | Alegerea inițială propusă | Când dezvoltăm sau extindem intern |
| --- | --- | --- |
| Code–Docs–agenți și versiuni | Implementare proprie | Sunt funcțiile și regulile specifice produsului |
| Ferestre, teme și fluxuri de revizuire | UI propriu existent | Extindere pentru nevoile validate ale SIREN |
| Editor pentru cod mare | Componentă permisivă evaluată, candidat CodeMirror | Adaptoare/extensii proprii; un editor complet propriu numai dacă o nevoie importantă nu poate fi satisfăcută și există probe care justifică costul |
| Parser și index de cod | Parser menținut plus model/index SIREN | Fork limitat ori modul nativ când corectitudinea sau profilarea justifică schimbarea, cu licența și diferențele păstrate |
| Diagrame | Mermaid existent plus navigare/hărți SIREN | Renderer specializat numai pentru o limitare observată, nu o rescriere preventivă a tuturor diagramelor |
| Auth, TLS și criptografie | Standarde și implementări menținute | UI și politica de activare proprii; primitivele de securitate nu se rescriu pentru a reduce artificial dependențele |
| Distribuție și date | Launcher, adaptor, contracte și formate SIREN | Folosirea bibliotecilor verificate unde scade riscul; update-ul portable rămâne un mecanism care trebuie calificat explicit |

Fiecare alegere între dezvoltare proprie și reutilizare trebuie să numească nevoia, componentele existente evaluate, licențele, costul de mentenanță/patch, bugetul de performanță și modul de înlocuire. Numărul direct de biblioteci, singur, nu stabilește independența. Nicio rescriere mare a editorului, UI-ului sau parserului nu intră în fundația portabilă doar fiindcă utilizatorul a permis dezvoltare proprie.

## Componente și limite de încredere

| Componentă | Rol | Limita de acces |
| --- | --- | --- |
| Interfață SIREN locală | Docs, Code, diagrame, prezentare și export | Fără acces general la Node, shell sau disc |
| Adaptor desktop | Deschidere/salvare și proiecte selectate | Comenzi definite, parametri și origine verificate |
| Stocare de proiect | Stare, surse, drafturi și recuperare | Separată de fișierele programului |
| Autentificare/activare | Cont și drept de acces offline | Fără încărcarea surselor sau a documentelor |
| Launcher/updater | Selectarea și schimbarea versiunii programului | Pachete semnate; exclude datele și proiectele |
| Analiză Code viitoare | Index și scheme din sursa aleasă | Fără executarea codului importat |

Interfața se încarcă din resurse incluse printr-un protocol local controlat. Se păstrează CSP restrictiv; Node integration este oprită, izolarea contextului și sandbox-ul renderer-ului sunt activate. Mesajele către adaptor au contracte precise, identifică expeditorul și revalidează permisiunea la executare. Nu se expune renderer-ului un apel generic pentru execuție, citire/scriere arbitrară sau navigare externă.

Fișierele și documentele importate sunt date neîncrezute. HTML, nume de fișiere și linkuri nu pot activa funcții native. Rutele de proiect se normalizează și se verifică față de directoarele alese, inclusiv legături/reparse points și schimbări între verificare și utilizare. Parserul static Python nu conferă drept de executare. O funcție viitoare de rulare a codului cere design și izolare distincte.

## Programul și datele portabile

Directorul portabil conține un punct de pornire, versiuni ale aplicației, `Data/` pentru preferințe/sesiuni/recuperare și `Projects/` pentru proiectele păstrate în pachet. Directoarele externe selectate explicit rămân externe; mutarea pachetului nu mută acele fișiere. La transfer, legăturile lipsă sunt afișate și pot fi refăcute, fără asociere arbitrară după nume.

Datele și resursele programului au directoare și drepturi distincte. Actualizarea nu scrie în `Data/` sau `Projects/`. Nu se plasează proiecte în directorul temporar în care un executable portable își poate extrage runtime-ul.

Prima etapă poate păstra modelul de workspace existent pe disc, fără a pretinde stocare deja scalabilă pentru sute de mii de linii. Adaptorul acceptă salvări cu verificarea versiunii de bază, un singur scriitor pentru workspace, jurnal/recuperare și readback. Dacă discul este plin, blocat sau inaccesibil, draftul rămâne recuperabil și interfața nu raportează salvare reușită. Ferestrele Code/Docs păstrează autoritatea comună a draftului și salvarea explicită în Docs.

Migrarea inițială folosește exportul explicit din SIREN existent și importul într-un proiect nou. Nu citește sau modifică automat profilul browserului. Copia se validează, iar sursele, identitățile și snapshoturile release-urilor se compară cu exportul. Migrarea nu modifică retroactiv aprobările. Formatul vechi rămâne exportabil pentru datele pe care le reprezintă; sursele viitoare peste vechile plafoane nu se trunchiază ca să încapă într-un export vechi.

## Disaster Recovery

Utilizatorul cere explicit un modul de recuperare în caz de crash. Fundația include un catalog local de puncte de recuperare verificate, draft privat recuperabil, detectarea pornirilor neîncheiate curat și Recovery Mode pentru o sesiune/proiect care nu mai poate fi deschis normal. Recuperarea acoperă crash, oprire/power loss în timpul scrierii, date/catalog corupte și pornire/update eșuat, cu verificarea procesului și a tranzacției reale.

Interfața arată ce versiune/draft poate fi recuperat și până la ce moment; nu promite recuperarea modificărilor care nu au ajuns în stocarea verificată. Restaurarea creează o copie nouă verificată și păstrează originalul, inclusiv fișierele corupte. Codul recuperat dintr-un draft nu este salvat implicit în Docs. Dacă toate copiile sunt invalide, se oferă export explicit al fișierelor deteriorate și un mesaj corect, fără „recuperare reușită” fictivă.

Recovery Mode oferă alegerea unei copii/unui alt proiect, export și acces la login/update, fără redeschiderea automată a sesiunii care repetă crash-ul. Recuperarea/exportul datelor deținute rămân disponibile când activarea expiră. Backups/checkpoints sunt separate de fișierele programului, au retenție și feedback pentru disc plin; un update nu le șterge. Rapoartele de diagnostic sunt locale, redactate și exportate numai explicit; nu există upload automat de cod, tokenuri sau crash reports.

Acceptarea cere opriri forțate ale proceselor candidate deținute, fault injection la scriere/rename/catalog/apply, corupere reală de fixture, restaurare/redeschidere și comparație exactă a surselor/identităților/hash-urilor. O verificare care observă numai exit code, prezența unui backup sau mesajul „restored” nu califică modulul.

## Login și activare offline

Un cont online acordă drept de utilizare; nu este un mecanism de criptare a proiectelor. Conturile, facturarea, limitele de dispozitive și administrarea organizațiilor sunt produse diferite; prima etapă nu inventează abonamente sau limite comerciale.

Fluxul propus folosește OIDC/OAuth Authorization Code cu PKCE S256 într-un browser extern, cu `state` și `nonce` legate de încercarea curentă. Callback-ul desktop ascultă temporar numai pe o adresă IP loopback și un port disponibil; se închide la rezultat/anulare/timeout. Această rută evită necesitatea înregistrării unui protocol Windows prin setup. Expeditorul, issuer-ul, audience-ul și semnătura/expirarea răspunsurilor sunt validate prin bibliotecă menținută; nu se implementează criptografie proprie.

Parola nu trece prin interfața SIREN. Nu se distribuie un client secret, cheia serverului de activare sau cheia de publicare. Configurația emitentului și a redirect-ului este stabilită de publisher, nu furnizată de un document importat. Identitatea OIDC singură nu este dovada unui drept comercial; dacă este necesar un drept separat, serviciul de activare îl validează pe server.

După activare, serverul emite un permis offline semnat, pentru **30 de zile** de la timpul serverului. Permisul include contul, instalarea, produsul, data emiterii, expirarea și identificatorul cheii. Nu conține codul utilizatorului. Aplicația verifică permisul local și încearcă reînnoirea când există conexiune, înainte de expirare. Permisul offline este separat de durata access token-ului OAuth.

Tokenurile și materialul de activare se păstrează în stocare protejată de OS și nu intră în proiecte, exporturi, crash reports sau loguri. Copierea pachetului pe alt PC/alt cont Windows cere o nouă autentificare; portabilitatea datelor nu înseamnă portabilitatea acreditărilor. Indisponibilitatea stocării protejate refuză păstrarea secretelor în text simplu și oferă autentificare pentru sesiunea curentă.

Stări explicite: **neactivat**, **activat online**, **activat offline până la o dată**, **reautentificare necesară**, **acces revocat cunoscut**. La expirare ori revocare, modul de recuperare permite citirea/exportul proiectelor deținute și salvarea muncii deja începute, cu permisiunile existente; nu șterge datele și nu închide brusc editorul. Nu începe noi sesiuni normale de lucru până la reactivare.

Revocarea făcută pe server nu poate fi aflată instantaneu de un PC offline. Schimbarea suspectă a ceasului cere revalidare online, cu recuperarea disponibilă. Un utilizator care controlează OS-ul poate manipula clientul; verificarea locală și fereastra offline nu sunt o garanție imposibil de ocolit. Logout-ul elimină sesiunea și permisul local, fără ștergerea proiectelor; revocarea serverului se confirmă numai când cererea online reușește.

## Check for Updates și distribuția GitHub

Utilizatorul cere explicit un buton **Check for Updates**. Se include în About/Help și în paleta de comenzi, cu acces prin tastatură și mesaje distincte pentru verificare, versiune curentă, update disponibil, descărcare, gata de repornire și verificare eșuată/offline. O eroare de rețea, rate limit ori lipsa configurării nu se prezintă ca „ești la zi”. Butonul lansează aceeași verificare semnată ca verificarea automată; nu descarcă/instalează executabile nevalidate și nu repornește forțat o sesiune cu drafturi.

**Pachete publice semnate, sursă privată** este alegerea explicită. Repository-ul sursei identificat și verificat este `Kellas94/siren`, privat, cu branch implicit `main`. Distribuția se propune prin **GitHub Releases într-un repository separat pentru binare publice**, cu manifest, semnătură, pachet ZIP, note și notice-uri necesare. Numele repository-ului de distribuție se stabilește în execuție după verificarea disponibilității; nu se pretinde că există deja un feed. Clientul descarcă fără token GitHub de acces la sursă; activarea SIREN controlează utilizarea oficială, nu confidențialitatea binarului public.

GitHub este transportul de distribuție. Clientul verifică semnătura publisher-ului, identitatea produsului/canalului/platformei, versiunea, dimensiunea și hash-ul înainte de aplicare. Configurația feed-ului este deținută de publisher și nu poate fi înlocuită prin cod/document importat. Un ZIP sursă generat automat de GitHub nu este pachetul SIREN și nu se distribuie drept update. Pachetele test și cheile test nu califică o lansare de producție.

Actualizarea repository-ului privat este autorizată separat. Se pregătesc schimbările într-o ramură/PR, se păstrează istoria și evidențele și se precizează exact ce s-a sincronizat. Fișierul live, cheile, profilurile și proiectele reale ale utilizatorului nu sunt publicate. Nu se declară sincronizat întregul istoric local doar pe baza adăugării documentelor desktop. Regula veche „no git” pentru handback-urile de patch nu blochează instrucțiunea explicită de actualizare a repository-ului, dar disciplina de proveniență rămâne.

Surse: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) și [release assets API](https://docs.github.com/en/rest/releases/assets). API-ul poate necesita autentificare pentru resurse private; repo-ul binar public evită includerea unei acreditări comune în client.

## Actualizare și security patches

Actualizările programului și ale runtime-ului sunt pachete complete în prima etapă. Publicarea include manifest și payload semnate, versiune, platformă/arhitectură, hash și mărime. Clientul are cheile publice de încredere; cheile private sunt păstrate în afara pachetului, a surselor și a logurilor de build. HTTPS protejează transportul, iar verificarea semnăturii autentifică artefactul. Hash-ul singur și câmpul „autor” nu autentifică publisher-ul.

Clientul verifică versiuni când este conectat și poate descărca în fundal. Aplicarea se face prin „Repornește și actualizează” sau la următoarea pornire. Nu se forțează oprirea unei sesiuni cu drafturi nesalvate. Descărcarea update-urilor de securitate nu depinde de validitatea login-ului, pentru a nu bloca repararea unui client expirat.

Payload-urile se păstrează în directoare de versiune distincte de date. Un launcher selectează versiunea validată; helper-ul așteaptă închiderea tuturor instanțelor SIREN ale acelei distribuții și schimbă selecția versiunii prin tranzacție recuperabilă. Update-ul launcher-ului/helper-ului se aplică printr-un proces separat după închiderea executable-ului vizat. Nu se termină procese după nume sau PID fără verificarea proprietarului, a căii și a identității procesului.

Extractorul refuză path traversal, căi absolute, ieșire prin linkuri/reparse points, coliziuni de nume și fișiere în directoarele de date. Pachetul incomplet, semnătura invalidă, arhitectura greșită, lipsa spațiului sau drepturilor de scriere lasă versiunea curentă utilizabilă. Jurnalul separă descărcat, verificat, pregătit, aplicat și pornire confirmată. Un simplu exit code zero al helper-ului nu dovedește instalarea.

Se păstrează o versiune precedentă validată și backup înaintea unei migrări de date. Revenirea include date compatibile dacă schema s-a schimbat. O versiune vulnerabilă interzisă de politica semnată nu este oferită ca recuperare normală; alternativa este pachetul reparat și exportul datelor. Cheile au procedură de rotație și revocare; o cheie nouă nu este acceptată doar pentru că apare în răspunsul serverului.

Mentenanța urmărește SIREN, Electron/Chromium/Node și dependențele. Versiunile sunt fixate într-un lockfile și inventariate în build, cu notificări de vulnerabilități și release-uri suportate. Un patch relevant intră prioritar în triere și în verificarea compatibilității; nu se promite un termen de remediere nemăsurat. OS-ul rămâne actualizat prin propriul mecanism, separat de SIREN.

## Protecția programului și limitele ei

Componentele noi trebuie să fie open source, cu preferință pentru licențe permisive MIT/BSD/ISC/Apache-2.0 și cu condițiile versiunii incluse verificate. Se inventariază dependențele directe, cele aduse indirect, runtime-ul binar, fonturile/iconurile și resursele exporturilor. Build-ul produce SBOM sau inventar echivalent și notice-uri; un element distribuit neidentificat ori fără termeni verificați blochează publicarea. Instrumentele doar de build se disting de artefactul distribuit. O licență a framework-ului nu este o calificare a întregului pachet, iar „open source” nu elimină toate obligațiile.

Distribuția de producție conține bundle-ul necesar rulării, nu repository-ul de dezvoltare, teste, loguri interne, source maps sau secrete. Licențele și atribuirea dependențelor rămân incluse conform cerințelor lor; sursele componentelor terțe se distribuie ori se oferă atunci când termenii aplicabili le cer. Minificarea și împachetarea reduc inspectarea facilă; nu sunt criptare și nu fac logica secretă.

ASAR integrity și verificarea semnăturilor protejează integritatea pachetului oficial. Dezactivarea instrumentelor de debugging în build-ul de producție reduce expunerea accidentală, dar nu este graniță de securitate. Obfuscarea opțională se poate evalua după stabilitate, cu măsurarea costului și fără împiedicarea diagnosticului intern al patch-urilor.

**Nu se promite că nimeni nu poate copia sau inspecta codul distribuit.** Electron livrează JavaScript, iar un binar nativ poate fi inspectat/decompilat. Login-ul controlează accesul oferit de clientul oficial și serviciile online, fără a transforma clientul într-un depozit de secrete. Logica ce trebuie să rămână strict nedistribuită trebuie păstrată pe server; această alegere schimbă capacitatea de lucru offline și nu intră automat în prima ediție. Încărcarea codului agenților pe server nu este autorizată prin alegerea unui login.

## Date și interfață

Proiectele sunt locale implicit. Singurul trafic automat propus este autentificarea/activarea și verificarea/descărcarea update-urilor către destinații cunoscute. Nu se transmite cod sau conținut Docs, nu se adaugă telemetry ori upload de crash reports prin presupunere. Jurnalele tehnice locale sunt limitate și redactează tokenuri, coduri OAuth și conținut de proiect; un raport de diagnostic se exportă explicit după revizuire.

Login-ul și starea update-ului apar discret în cont/About, cu o notificare contextuală când trebuie o acțiune. Starea offline afișează data până la care este validă. Nu se adaugă permanent panouri tehnice în spațiul central. Fereastra Code, Docs, shortcut-urile și temele se păstrează; credentialele nu sunt vizibile în renderer. Logout-ul unui utilizator nu expune automat proiectele acestuia într-un alt cont SIREN; accesul la proiect se alege explicit, iar contul SIREN nu este prezentat drept criptare a discului.

## Ținta de scalabilitate pentru următoarea specificație

Repere propuse pentru verificare: **300.000 de linii într-o sursă** și **1.000.000 de linii cumulate într-un proiect**, cu un corpus de 100.000 și unul de 500.000 de linii pentru explorarea degradării. Sunt ținte de engineering, nu limite deja susținute. Dimensiunile în bytes, lungimea liniilor, numărul de simboluri, hardware-ul și memoria fac parte din fiecare fixture.

Editorul trebuie să afișeze porțiunea vizibilă, să păstreze Undo prin modificări și să permită tastare/Find fără a aștepta indexarea. Analiza are bugete, progres, anulare și ignoră rezultate din generații depășite. Sursele mari se păstrează separat de metadata Docs; căutarea folosește un index. Schemele arată module/clase/funcții la cerere, cu limite explicate. Nu se încearcă randarea unui singur Mermaid cu sute de mii de noduri.

Performanța se măsoară separat pentru deschidere, tastare, lipire, scroll, căutare, indexare, A/B și recuperare. Corectitudinea cere bytes/hash exact, Unicode/CRLF, surse invalide și linii foarte lungi, salvare explicită și recuperare după întrerupere. Pragurile de timp/memorie se stabilesc după baseline pe hardware identificat și înainte de verdictul candidate-ului. Nu se măresc arbitrar toate plafoanele vechi și nu se declară „scalabil” doar pentru că fișierul s-a deschis.

## Acceptarea primei ediții portabile

| Domeniu | Proba necesară |
| --- | --- |
| Distribuție | ZIP extras într-un folder cu spații/Unicode, pornire fără setup pe OS/runtime identificat; read-only și lipsă permisiuni tratate explicit |
| Date | Import din export real, surse și snapshoturi exacte, salvare/readback, draft recuperat după întrerupere, disc plin și conflict fără fals succes |
| Portabilitate | Mutarea întregului pachet pe alt PC, proiecte intacte, login nou, referințe externe lipsă vizibile |
| Autentificare | Flux real cu issuer de test, PKCE/callback greșit/replay/expirare/anulare refuzate; fără tokenuri în loguri sau export |
| Disaster Recovery | Crash/power loss, date/catalog corupte, Recovery Mode, copie restaurată fără suprascriere și byte/hash/source identity readback |
| Offline | Permis valid 30 zile, expirare/ceas schimbat/revocare cunoscută, outage de server și recuperare/export fără pierdere |
| Update | Versiune veche → nouă, semnătură greșită, payload corupt/întrerupt, path traversal, proces blocant, oprire în timpul aplicării, readback și recuperare |
| Granițe native | Document/link/IPC ostil nu accesează shell, secrete sau fișiere neautorizate; codul importat nu este executat |
| Dependențe/licențe | Inventar complet al pachetului, versiuni și licențe reale, notice-uri prezente, fără secrete/source maps sau componente comerciale introduse fără analiza termenilor |
| Regresii | Code/Docs cu mai multe ferestre, A/B, salvare și release-uri, diagrame/export, Dark și Warm Light, pointer și tastatură |

Probele negative trebuie să producă refuzul sau recuperarea așteptată; un test care nu poate observa un fault plantat nu califică funcția. Se păstrează originalele, rulările eșuate și identitatea exactă a artefactului verificat. Review-ul independent, atunci când este cerut de convențiile proiectului, trebuie primit efectiv înaintea livrării; coordonatorul nu scrie aprobări în numele evaluatorilor.

Un issuer de test, chei de test și hosting local nu sunt login/publisher de producție. Prima publicare necesită emitent real configurat, endpoint-uri și chei de semnare de producție, distribuție și rollback verificate. Nu se creează conturi externe, nu se cumpără servicii/certificate și nu se publică pachete prin această etapă de design. Live v1.131.0 rămâne fallback-ul nemodificat până la admiterea unei ediții noi prin fluxul calificat.

## Surse primare consultate

- [Electron Process Sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox), [Tauri architecture](https://github.com/tauri-apps/tauri) și [WebView2 Evergreen versus Fixed Version](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version): proprietarul patchurilor și motorul efectiv folosit pe Windows. Nota suplimentară este `docs/research/2026-10-02-siren-chromium-portable-decision.md`.
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security): runtime actualizat și separarea interfeței de funcțiile native. Măsurile de mai sus sunt cerințe propuse, nu un audit trecut.
- [Electron ASAR Archives](https://www.electronjs.org/docs/latest/tutorial/asar-archives) și [ASAR Integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity): împachetarea și integritatea sunt diferite de confidențialitatea codului.
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage): stocare protejată de OS; pe Windows nu protejează de alte aplicații care rulează ca același utilizator. Mutarea acreditărilor pe alt PC nu este o funcție promisă.
- [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html) și [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html): autentificarea aplicațiilor native, PKCE și protecția fluxului OAuth. Permisul offline de 30 zile este o alegere de produs SIREN, nu durata impusă de aceste standarde.
- [electron-builder v26 targets](https://www.electron.build/v26/docs/targets/) și [auto-update](https://www.electron.build/v26/docs/features/auto-update/): portable și NSIS au mecanisme diferite; auto-update portable cere implementare explicită.
- [CodeMirror viewport](https://codemirror.net/docs/guide/#viewport): candidat pentru următoarea etapă de editor. Nu dovedește capacitatea întregului SIREN la dimensiunile propuse.
- [Licența Electron](https://github.com/electron/electron/blob/main/LICENSE), [Tauri](https://github.com/tauri-apps/tauri), [CodeMirror view](https://github.com/codemirror/view/blob/main/LICENSE) și [Mermaid](https://github.com/mermaid-js/mermaid/blob/develop/LICENSE): licențe upstream ale proiectelor/modulelor citate; verificarea distribuției efective rămâne necesară.
- [Sublime EULA](https://www.sublimetext.com/eula) și [framework-ul UI propriu](https://www.sublimetext.com/blog/articles/hardware-accelerated-rendering): motivul pentru care păstrăm experiența portable ca reper fără a redistribui motorul Sublime.

## Pasul următor

Specificația și completările explicite sunt consemnate; planul scris este `docs/superpowers/plans/2026-10-02-siren-portable-foundation-v2.md`. Revizuirea planului și confirmarea metodei de execuție preced implementarea. Planul și metoda de execuție trebuie revizuite înaintea scaffolding-ului, instalării dependențelor ori scrierii codului produsului. Specificația pentru scalabilitate se pregătește separat după stabilirea fundației și a baseline-urilor, fără a amâna optimizarea desktop până la o ediție web.
