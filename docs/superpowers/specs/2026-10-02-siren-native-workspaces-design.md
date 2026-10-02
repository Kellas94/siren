# SIREN desktop: Docs, Code și Present pe mai multe monitoare

Data: 2 octombrie 2026. Autor: /root. **Design aprobat de utilizator în această sesiune; planul scris urmează review separat, iar ferestrele native multiple nu sunt implementate.** Utilizatorul cere Docs și Present detașabile ca Code, ferestre multiple simultane, minimizare/restaurare de oriunde, resize/move/maximize și lucru pe monitoare diferite. Intenția este comparația și documentarea agenților fără o interfață centrală încărcată. AI rămâne ultimul.

## Situația actuală

`desktop/src/main.mjs` creează un singur BrowserWindow. Bootstrap, IPC, Lock, schimbarea proiectului și Quit sunt legate de acel renderer. Docs/Code folosesc secțiuni DOM limitate la viewport. Present folosește popup/opener în baseline, iar desktop refuză toate popupurile. Nu se declară deja existent suportul multi-monitor.

`desktop/src/ui/storage.js` salvează întregul bag și nu implementează notificarea schimbărilor remote. Mai multe renderere pornite identic ar avea copii stale și conflicte de salvare. Auditul separat `desktop/reviews/2026-10-02-native-detachment-exploration.md` este read-only și nu constituie o probă de funcționare a acestui design.

## Variante și alegere

1. **WindowManager nativ, renderere pe roluri și owner comun — recomandată.** Ferestre independente pe monitoare, control și receipte centralizate, acces minim per rol.
2. Ferestre DOM în workspace. Păstrează costul mic actual, dar nu ies pe alt monitor și nu satisfac cerința.
3. Copii complete independente ale aplicației. Nu satisface sincronizarea drafturilor/proiectelor și ar multiplica memoria/snapshoturile. Nu este folosită ca scurtătură pentru detașare.

## Comportament și UI

Diagrams, Docs și ⌘ Code rămân secțiuni permanente în bara comună. Present rămâne o acțiune de workspace, cu Presenter și Audience. Proiectul, starea salvării și căutarea au poziție stabilă; controalele specifice sunt contextuale. Modul desktop este prioritar.

Code și Docs oferă „Deschide în fereastră nouă” și „Detașează”. Fereastra nativă are titlebar și butoane Windows funcționale, context menu și comenzi de tastatură. Conținutul poate fi redimensionat independent în splituri. „Atașează înapoi” mută vederea, fără a copia sursa sau a pierde draftul. Pot exista mai multe Docs și Code pentru entități și versiuni diferite.

O listă comună „Ferestre” afișează titlu, modul, starea minimizată și modificările nesalvate. Permite restore/focus de oriunde; minimize nu înseamnă close sau discard. În fereastra principală această listă înlocuiește acumularea de pills suprapuse. Nu este necesară o nouă bară permanentă cu toate controalele fiecărei ferestre.

Presenter afișează notele și controalele; Audience primește doar slide-ul actual și starea de prezentare. Utilizatorul alege monitorul și poate ieși din fullscreen. Notele, sursele, cheia AI și snapshotul proiectului nu sunt transmise Audience. Prezentarea este live pe o versiune de deck explicită; schimbările din editor sunt oferite prin „Actualizează prezentarea”, nu introduse automat în mijlocul unui slide. Slide-ul curent este păstrat dacă identitatea lui există în versiunea nouă.

Ctrl+Alt+L este rezervat pentru Lock în toate ferestrele; intrarea actuală Code Library trebuie remapată și ghidul actualizat. Ctrl+W închide vederea activă cu drain/verificare; Ctrl+Q închide aplicația cu verificarea tuturor ferestrelor. Native menus trimit comenzile către fereastra activă eligibilă. Comenzile sunt enumerate în ghid, nu inventate separat de fiecare modul.

## WindowManager și acces

Registrul nativ emite `windowId`, rol, `projectId`, epoch-ul sesiunii și granturile entităților. Roluri: workspace, code, docs, presenter, audience. Identitatea vine din main; rendererul nu își acordă singur rolul prin URL sau payload.

Toate ferestrele au sandbox/contextIsolation, fără Node în renderer, preload minim și resurse locale allowlisted. Se verifică webContents, main frame, URL și rol pentru fiecare IPC. Popupurile arbitrare, webview și navigarea neautorizată rămân refuzate; detașarea folosește cereri native tipizate.

`openView`, `focusView`, `attachView`, `closeView` și `listViews` sunt limitate la sesiunea/proiectul deținut. Registry-ul elimină granturile la destroyed/crash/navigare. Statusurile și rezultatele ajung numai la ferestre autorizate; un broadcast generic cu snapshot complet este interzis.

Ferestrele de lucru sunt nonmodale și pot exista independent în taskbar/Alt+Tab; nu folosesc un parent care le obligă permanent deasupra workspace-ului. Dialogurile de confirmare aparțin ferestrei solicitante. Un singur owner nativ coordonează sursele și coada de save, folosind contractele spec-ului `2026-10-02-siren-large-sources-design.md`.

## Sincronizare și conflicte

Vederile trimit intenții cu epoch, entityId, expectedVersion și operationId. Native owner validează și serializează. Evenimentele confirmate includ versiune/hash și sunt distribuite subscriberilor autorizați. Două ferestre pe aceeași sursă văd modificările confirmate fără a salva două bag-uri întregi. Operațiile stale sunt refuzate, iar draftul rămâne recuperabil.

Pentru Code legat de Docs, salvarea în Docs rămâne explicită. Versiunile A/B sunt imutabile; nu editează implicit agentul/release-ul curent. Docs metadata/block intents folosesc versiune și identitate, nu snapshotul complet al unei ferestre. Un renderer pierde accesul imediat la schimbarea epoch-ului.

## Lock, schimbare proiect, close și crash

Acestea sunt tranzacții comune. Main oprește noi intenții, cere tuturor vederilor cu editări să dreneze lucrul, verifică receiptele exacte și apoi finalizează. Animația nu acordă/revocă accesul. Dacă salvarea eșuează, nu se declară clean-close ori succes al lock-ului; lucrul rămâne disponibil cu eroare și export.

Pentru Lock reușit, main revocă granturile, invalidează epoch-ul și distruge vederile satellite cu date, inclusiv Audience/minimizate, înainte de a confirma; workspace-ul trece într-un renderer blocat fără snapshot. Ascunderea unei ferestre cu date nu este suficientă. Lista de restaurare păstrează numai identificatori și geometrie, fără text sau thumbnail de proiect. Ecranul PIN este singura suprafață activă. Ferestrele se recreează doar după deblocare și verificarea modului readonly/recovery. Screenshoturile pe al doilea monitor nu trebuie să rămână cu conținut activ după ACK. Ecranul de blocare Windows și alte aplicații ale aceluiași utilizator sunt în afara garanției PIN local.

Schimbarea proiectului închide vederile proiectului precedent după drain; nu lasă ferestre care scriu în selecția nouă. Închiderea unei vederi nu închide aplicația sau celelalte vederi. Închiderea ferestrei principale este Quit coordonat; minimize permite continuarea pe satellite. Un renderer crash afectează vederea: drafturile deja recepționate de owner pot fi recuperate; keystrokes încă netransmise nu sunt promise recuperabile. Owner/app crash folosește jurnalul și recovery, fără a declara sesiunea curată.

## Geometrie și monitoare

Geometria este în DIP, cu bounds normale, maximized/fullscreen, display și rol. Sunt acceptate coordonate negative. La pornire și la display-removed/metrics-changed, bounds sunt validate față de workArea; o fereastră rămasă în afara ecranului este adusă vizibil pe monitorul disponibil. Display ID-ul este indiciu, nu autoritate permanentă. DPI diferit, scalare, taskbar și rezoluții schimbate nu trebuie să ascundă titlebarul.

„Mută pe monitor…” și „Readu toate ferestrele pe ecran” sunt disponibile în lista Ferestre. Layout-ul este păstrat separat de conținutul proiectului. Minimizarea și geometria nu provoacă salvarea întregului text. Pe un singur monitor comportamentul rămâne utilizabil fără ferestre obligatorii.

## Calificare și ordinea integrării

Prima integrare este contractul owner/registry/epoch, apoi Code și Docs, apoi Presenter/Audience. UI central se extrage incremental; nu se duplică tot baseline-ul în fiecare rol ca arhitectură finală. Memoria per fereastră și numărul de subscriptions sunt măsurate; vederile inactive suspendă lucrările costisitoare fără a pierde drafturi.

Probe reale: 2 Code + 2 Docs + Presenter + Audience, două ferestre pe aceeași sursă, drafturi distincte, save concurrent/stale, minimized close, main Quit, renderer crash și schimbare proiect cu mesaje întârziate. Lock se verifică în fiecare fereastră cu save în curs, PIN greșit și mod recovery/readonly. Audience nu poate folosi IPC pentru citire de sursă sau scriere.

Probe geometrie: monitoare la stânga/dreapta, DPI/scalare diferită, disconnect/reconnect, maximizare/restaurare, fullscreen Audience și restart cu monitor lipsă. Testele matematice ale bounds completează, dar nu înlocuiesc proba reală pe două monitoare. Dacă hardware-ul disponibil are un monitor, calificarea multi-monitor rămâne explicit deschisă.

Nu include AI, conturi online, execuție de cod, autoUpdater complet sau release public. Nu califică automat limitele Docs/Mermaid/Present; acestea au stres separat în roadmap.

Referințe primare: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [Electron screen](https://www.electronjs.org/docs/latest/api/screen), [Electron Security — verificarea senderului IPC](https://www.electronjs.org/docs/latest/tutorial/security). API-urile permit proiectarea; funcționarea SIREN se dovedește prin probele de mai sus.
