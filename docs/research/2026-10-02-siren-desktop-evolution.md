# SIREN desktop — evaluare și loturi de evoluție

## Clarificare ulterioară: capacitate desktop și multi-monitor

Utilizatorul a acceptat direcția generală și cere creșterea capacității dincolo de cazul de stres 80k linii, cu monitorizare bytes/caractere/complexitate. Docs, Code și Present trebuie să fie detașabile în ferestre native și utilizabile simultan pe monitoare diferite. Cerința de scop este acceptată; designurile noi de mai jos sunt propuneri scrise pentru review, nu implementări sau capacități calificate.

- `docs/superpowers/specs/2026-10-02-siren-large-sources-design.md`: SourceRepository, model incremental/editor virtualizat, analiză/diff anulabile, legături Docs și tranzacții recovery. 100k/300k linii reprezentative, 32 MiB/sursă și 256 MiB de surse/proiect sunt ținte propuse, nu plafoane deja livrate.
- `docs/superpowers/specs/2026-10-02-siren-native-workspaces-design.md`: registry nativ pe roluri, surse/save coordonate, mai multe Code/Docs, Presenter/Audience, Lock și Quit în toate ferestrele, geometrie/DPI/monitor scos. UI păstrează bara comună și comenzi contextuale; AI rămâne ultimul.

Extinderea pe toate ariile are probe distincte:

| Arie | Capacitate și dezvoltare de urmărit | Dovada necesară |
| --- | --- | --- |
| Code | Import/editare/find/diff/index al surselor mari; grafic pentru selecție | Text/hash exact după save/restart și crash; latență, memorie totală și anulare; scripturi complexe, nu numai linii compacte |
| Docs și agenți | Liste/preview virtualizate, surse referite, navigare agent/release/versiune, ferestre multiple | Proiecte cu multe documente și legături; căutare globală, editare, conflicte și export fără multiplicarea textului |
| Diagrams | Coada de render anulabilă, limite explicite pentru layout/noduri/muchii; export vectorial | Familii Mermaid variate, grafuri dense, stiluri importate și teme, export SVG/PDF exact; păstrarea sursei la refuz |
| Present | Presenter/Audience native, pregătire limitată a slide-urilor vecine, media cu bugete | Deck-uri mari cu text/diagrame/imagini, fluiditate și export; note private, fullscreen/DPI și Lock pe fiecare ecran |
| Proiecte și căutare | Manifest/index versionat, filtre și rezultate la cerere | Find pe toate entitățile fără blocaj; rezultatele arată exact sursa și versiunea; anulează și respinge rezultate stale |
| Knowledge | Pachete oficiale/versionate opționale, citire la cerere și index local | Manualul Python ales explicit, licențe/notices, hashuri și versiune; fără încărcarea completă a manualului în fiecare fereastră |
| Recovery și update | Retenție pe vârstă/spațiu cu copii referite și verificări; release executabil atomic | Fault injection/disc plin/crash, nicio pierdere a ultimei copii bune; rollback/schema compatibile; calificare de semnătură distinctă |

Această matrice este roadmap. Nici ambalarea în Electron, nici modificarea unei constante nu închid aceste arii. Nu se afirmă că toate capacitățile de mai sus sunt implementate. Observațiile și eșecurile de la freeze-ul evaluării de mai jos rămân păstrate istoric.

Data: 2 octombrie 2026. Autor: /root. Document de evaluare și prioritizare, nu declarație de implementare sau aprobare pentru release. Clarificarea ulterioară a utilizatorului pune AI ultimul, opțional și ascuns fără configurare.

## Baza evaluată

Pachetul local `development-6d8d2781-d5dc-494b-b2ce-f19eb62b7e43`, sursă produs `b6249016cc9a001c646cc183f3c38884da678b1d`, renderer SHA256 `808e28032e63a54e6e7376118d9e275e404ffa940c9669038ffc4b12382d9ad8`, ASAR `53da590bd172987fb0102b183dde6e5c921b4af6a2ec8f34f1c8251d63a1e9f5`. Rapoartele agenților au autori, probe și limite distincte. Coordonatorul nu transformă observațiile lor în aprobări independente suplimentare.

PIN-ul local, separarea privilegiilor, checkpointurile și launcherul sunt fundație de dezvoltare. Pachetul nu este încă o ediție de producție admisă. Conturile online, aplicarea update-urilor semnate și testele pe PC curat rămân deschise.

## Cele 12 arii cerute

| Cerință | Situație concretă și următoarea livrare |
| --- | --- |
| 1. Code review | Audit separat pentru defecte și capacitate; constatări reproduse, candidați și limitări trebuie separate. Defectul de serializare descris mai jos este confirmat independent de coordonator. |
| 2. Desktop UI/UX | Audit pe capturi native proaspete. Propunere: navigare persistentă între Diagrams, Docs și Code; bară de sus cu contextul proiectului, căutare, ferestre și starea salvării. Acțiunile specifice rămân lângă conținut. |
| 3. Security | Pornirea scanării formale a eșuat la citirea unui fișier temporar Electron `DIPS-wal`, înainte de ID-ul autoritativ. Nu există verdict de scanare. Este necesară rezolvarea țintei stabile în fluxul pluginului, cu eșecul păstrat. Review-ul general nu îl înlocuiește. |
| 4. Biblioteci/versionare | Inventar JSON și raport independente, legate de pachet: Electron44.5.1, Chromium152.0.7977.130, Node intern24.21.0, Mermaid12.0.0, grammar Python Lezer1.1.19 modificată local. Nu există CPython/Pyodide sau manual Python offline inclus. Licențele necunoscute rămân marcate. |
| 5. AI/API | Ultima etapă. Cercetare dedicată `2026-10-02-siren-optional-ai.md`; fără credențială sau integrare implementată. |
| 6. Modularizare/update pe arii | Adaptoarele native sunt deja separate; rendererul pornește din baseline-ul HTML mare. Extrageri progresive cu contracte și teste; pachetul executabil se promovează atomic, cu rollback. Knowledge packs pot avea o schemă de versiune separată. |
| 7. Stress/limite | Probe sintetice distincte pentru parser, import, editor, salvare, recovery și multi-window. Limitele existente nu dispar prin ambalarea în Electron; 80k-line editing nu este admis pe baza probei adverse. |
| 8. Arii noi/knowledge | Navigare către sursa explicației, agenți/release-uri/versiuni, cod nelegat și comparație; knowledge packs curate și versionate, la cerere. Fără execuția implicită a codului importat. |
| 9. Disaster recovery/cleanup | Există deja pruning după verificare: 10 checkpointuri saved, un draft, current + 9 revizii mai vechi valide. Lipsesc bugetele de vârstă/spațiu și politica pentru copii emergency/corupte/pending. |
| 10. Research/recomandări | Inventar reproductibil, matrice de regresie pe module, diagnostice redactate, teste PC curat și migrare schema/rollback. Alegerea dependențelor se face după potrivire și probe, nu prin număr zero de biblioteci. |
| 11. Animație Lock | Direcție distinctă „vault”: salvare confirmată → acoperire și închidere vizuală → ecran PIN. Animația nu acordă acces și nu amână revocarea nativă; reduced motion folosește tranziție scurtă. Nu este încă implementată. |
| 12. Icon custom | Identitate SIREN simplă, lizibilă la dimensiuni mici; ICO pentru Windows și sursă vectorială. Verificare în launcher, executabil, taskbar, Alt+Tab și titlebar. Conceptul și integrarea sunt încă deschise. |

## Rapoarte separate și limite măsurate

- Inventar independent: `desktop/reviews/2026-10-02-dependency-inventory.md` și JSON asociat. Include 57 intrări npm, 22 Cargo și 780 componente din notices Chromium, cu proveniența și necunoscutele păstrate; acestea nu sunt 859 biblioteci directe SIREN.
- Audit UX independent: `desktop/reviews/2026-10-02-desktop-evolution-ux.md`, SHA256 `5b7981d2e0b7a3ab17d6ce79283f287908424b9a5f9452163647ce2080da772c`. 14 pași enumerați,13 capturi acceptate și un cadru intermediar exclus; dark1424×895 client pixels. Recomandă opțiuneaB: bară comună de context și controale contextuale grupate. Titlebar/taskbar/native menus, light/zoom/high contrast și screen reader nu sunt calificate. Coordonatorul a inspectat separat capturile03,09,14; nu pretinde o a doua calificare UX completă.
- Review și stress independent: `desktop/reviews/2026-10-02-desktop-evolution-bugs-scale.md`. Deschiderea surselor compacte de 80k/100k linii a durat 749/853ms; o sursă de 300k linii a fost deschisă ca draft, cu refuz explicit pentru hartă. Aceste probe nu califică editarea sau salvarea/restartul fișierelor mari.
- Introducerea efectivă a 80k linii într-un fixture cu 200 Docs a depășit timeoutul CDP de 20sec, iar diagnosticele rendererului au rămas fără răspuns. Cauza internă nu este încă localizată. Procesul deținut a fost închis; eșecul nu a fost repetat până la un PASS.
- 1.000 Docs cu surse de 20k caractere: register205–243ms și aproximativ177–189MB JS heap la eșantionare, pe un singur host. Nu sunt măsurători ale întregii memorii native sau ale tuturor fluxurilor Docs.
- Mermaid chain100/300 noduri:351/1136ms prin API-ul inclus; chain600/599edges a fost refuzat la pragul de500edges. Nu este un crash și nu califică diagrame dense sau exporturi.
- Salvare + checkpoint la8MiB:586–825ms în trei salvări sintetice,58.7MB retenție. Amplificarea copiilor complete este măsurată; coalescing/deltas cer verificarea contractului de crash recovery înainte de implementare.

## Defect confirmat la limita de serializare

`desktop/src/projects/store.mjs` acceptă un workspace JSON de 67.108.864 bytes. Un fixture valid cu caractere escape produce un snapshot serializat de 134.217.961 bytes, peste limita suplimentară de 134.217.728 impusă de `readProject`. `createProject` scrie și selectează revizia, apoi readback eșuează cu `Corrupt selected revision`; `listProjects` marchează copia nouă damaged.

Agentul a reprodus la `desktop/evidence/evolution-revision-boundary-2026-10-02T19-38-44.411Z/result.json`. Coordonatorul a executat independent aceeași probă o singură dată la `19-44-52.596Z`, cu același rezultat și hash al sursei `a6316abb4b20467293b59db21654e4d2d8893fb345f7a7a719cb1b1239837767`. Sunt date sintetice izolate. Exit0 al scriptului de măsurare nu înseamnă PASS al funcției testate.

Remedierea trebuie să armonizeze limita workspace cu toate envelope-urile de revision, pending și recovery și să respingă înainte de schimbarea pointerului orice snapshot nerecitibil. Testele trebuie să includă escape, control characters, Unicode, metadata maximă, create/save și păstrarea reviziei existente la refuz. Mărirea arbitrară a plafoanelor nu dovedește scalabilitate. Acest defect este deschis la freeze-ul evaluării.

## Ordinea loturilor

1. **Integritatea datelor:** defectele reproduse de salvare/readback, limite coerente, semnale clare de salvare/refuz, timeouturi păstrate și investigate. Calificare nativă și packaged înainte de alte schimbări de produs.
2. **Desktop workspace:** navigare persistentă, controale comune și ferestre Code/Docs restaurabile; focus, keyboard, resize/maximize și teme. Păstrăm o singură autoritate pentru draft și salvare.
3. **Recovery și întreținere:** bugete de spațiu/vârstă pentru copii verificate și rezolvate; review al retenției, mod read-only și export. Ultima copie bună, emergency neclarificat și datele corupte nu se șterg orb.
4. **Module și capacitate:** surse mari separate de workspace, editor care desenează doar zona vizibilă, indexare/anulare în fundal, hărți la cerere și actualizări atomice. Datele importate rămân date; procesul de analiză nu execută codul Python.
5. **Identitate și descoperire:** animație Lock, icon și guide/tour care explică funcțiile existente și limitele reale. Fără promisiuni despre funcții încă neimplementate.
6. **AI opțional:** configurare și capabilități ascunse fără activare, după celelalte loturi și designul separat.

Security și verificarea licențelor sunt condiții transversale; nu se declară închise prin ordonarea loturilor. Fiecare subsistem nou are propriul design/plan și probe; nu se rescrie tot produsul într-o singură schimbare greu de calificat.

## Modularizare și update

Recomandăm module interne pentru window manager, surse/drafturi, editor, analiză, Docs, diagrame/export, recovery, setări și integrări. Contractele includ identități stabile, versiuni de schemă, anulare și rezultate explicite; o eroare de analiză nu poate raporta salvarea ca reușită. Extragerile rendererului sunt progresive și păstrează baseline-ul și testele comportamentale.

Update-uri independente pentru cod executabil creează combinații de versiuni care trebuie testate. Recomandarea inițială rămâne **un release complet semnat, selectat atomic**, chiar dacă sursa internă este modulară. Resursele de manual/template pot fi pachete separate după definirea manifestului, semnăturii și compatibilității. Mecanismul Windows autoUpdater documentat de Electron se bazează pe Squirrel; nu califică automat actualizarea folderului portabil SIREN. [Electron updates](https://www.electronjs.org/docs/latest/tutorial/updates).

## Recovery: corecție versus detectare

Hashurile și readback detectează deteriorarea, iar checkpointurile permit restaurarea unei copii valide. Nu sunt un cod ECC care reconstruiește bytes deteriorați din paritate. Prioritatea este salvare atomică, copii verificate și restaurare calificată la întrerupere/disc plin. Paritatea se justifică numai după stabilirea unui scenariu de pierdere și măsurarea costului; nu adăugăm primitive proprii de criptografie.

Politica viitoare de cleanup trebuie să distingă copii normale, puncte păstrate explicit, emergency nerezolvat, pending și corupte. Pruning se execută după verificarea noii copii, cu buget și limită de lucru în fundal; se oprește la acces/read-only/eroare. Datele reale ale utilizatorului și probele istorice nu au fost curățate în această analiză.

## Editor și knowledge packs: reutilizare evaluată

CodeMirror este un candidat pentru lotul de editor: sursa oficială descrie desenarea numai a codului vizibil și expune viewport/visibleRanges. Este un mecanism potrivit pentru evaluare, nu o dovadă că SIREN cu CodeMirror suportă300k linii. E nevoie de probe cu surse reale și foarte lungi, selecție, comparație, undo, IME și temele existente. [CodeMirror EditorView source](https://github.com/codemirror/view/blob/main/src/editorview.ts).

Electron utilityProcess poate separa munca într-un proces cu Node și message ports. Acest lucru nu este automat un sandbox pentru cod importat. Candidatul poate rula parserul deținut de SIREN, cu mesaje/bugete/anulare definite; Python importat rămâne text. [Electron utilityProcess](https://github.com/electron/electron/blob/main/docs/api/utility-process.md).

Manualul Python complet există oficial în HTML și alte formate descărcabile; nu trebuie rescris. Propunem un pack opțional, versionat și indexat, cu tutorial/reference/library, plus legături contextuale din Code. Versiunea selectată trebuie afișată, fără a confunda versiunea manualului cu cea a grammarului Lezer sau cu un interpretor. [Python documentation download](https://docs.python.org/3/download.html).

Documentația are licență PSFv2, iar exemplele au și Zero-Clause BSD; redistribuirea trebuie să păstreze licența/copyright și să consemneze modificările. Inventarul packului este separat de runtime. HTML-ul manualului trebuie servit ca resursă fără acces nativ la proiecte și cu navigare/linkuri controlate. Nu s-a descărcat sau inclus un manual în această etapă. [Python history and license](https://docs.python.org/3/license.html).

## Monitorizare și admitere

La finalul acestei evaluări, Desktop CI25 (`37055938499`) este **FAILED**:112 teste unit/protocol trecute,11/12 grupuri native trecute; `access-screen` a avut timeout la `Input.dispatchMouseEvent`. Etapa packaged a fost **SKIPPED**. Screenshotul păstrat arată dialogul pentru PIN curent deja deschis, dar nu există un phase marker care să stabilească exact acțiunea/cauza. Artefactul11248154425 a fost descărcat și verificat: ZIP2512700bytes, SHA256 `e36143f1458fae8d4962f890762c24a62a0e0fbda3febeb794c702e8978819bb`. Nu este înlocuit cu rezultatele locale. Launcher CI16 (`37055938501`) a trecut.

Testul packaged local final771f17fb a trecut separat la autorul independent și la coordonator pe pachetul neschimbat. Acest lucru nu afirmă că CI25 packaged a rulat sau că timeouturile sunt reparate. PR2 rămâne draft și main neschimbat; nu există release nou din această analiză.

Runtime-ul Electron include Chromium și Node; update-urile browserului instalat pe Windows nu îl actualizează. Recomandăm urmărirea release-urilor și advisories Electron plus bibliotecilor vendorizate, cu lock/hashes/licențe și patch ledger pentru grammar Python. Actualizarea se promovează după regresii, nu automat fiindcă există o versiune nouă. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).

Pentru fiecare livrare se păstrează autorul real, exact source/runtime hashes, fixture-ul, rezultate negative și limitele acoperirii. Un verdict retrospectiv rămâne retrospectiv. UI/UX audit, unit tests, native/package probes și Security au scopuri distincte; niciunul nu este substituit cu un raport fabricat.
