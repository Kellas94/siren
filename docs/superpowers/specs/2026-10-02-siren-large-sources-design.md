# SIREN desktop: surse mari și scripturi complexe

Data: 2 octombrie 2026. Autor: /root. **Design aprobat de utilizator în această sesiune; planul scris a fost de asemenea aprobat, iar implementarea începe cu evaluarea editorului și contractele de surse.** Cerința este: sute de mii de linii, măsurare prin bytes/caractere și complexitate, capacitate desktop crescută. AI rămâne ultimul și separat.

## Scop și dovada de succes

Un utilizator poate importa, citi, edita, căuta, compara și documenta scripturi Python complexe, apoi salva, închide și redeschide exact aceleași surse. Încetinirea sau refuzul unei hărți nu dezactivează sursa ori salvarea. SIREN nu execută automat codul importat. Aceleași identități de surse sunt folosite în Docs și în mai multe ferestre Code.

80k linii este un caz de stres anterior, nu un plafon unic configurat. Deschiderea unor fixture-uri compacte de 100k/300k linii nu a calificat editarea, persistarea ori analiza la acea dimensiune. Introducerea a 80k linii într-un proiect cu 200 Docs a depășit timeoutul; cauza internă trebuie profilată, fără a fi atribuită automat textarea sau parserului.

Țintele de calificare ale primei implementări sunt fișiere de **100k și 300k linii reprezentative**, plus cazuri adverse independente de numărul de linii. Bugetul proiectat pentru sursa text este **32 MiB UTF-8 per fișier**, iar suma surselor dintr-un proiect **256 MiB pe disc**. Acestea sunt ținte de testare, nu limite deja livrate și nici promisiuni de latență pentru orice complexitate. Nu se încarcă simultan toate cele 256 MiB în fiecare fereastră. Un fișier foarte mare sau invalid poate rămâne disponibil pentru export exact și citire controlată, cu refuz explicit al operației necalificate; nu se trunchiază sau pierde textul.

## Variante analizate

1. **Surse separate + editor incremental + analiză anulabilă — recomandată.** Rezolvă duplicarea textului în JSON și în undo, permite ferestre sincronizate și bugete pe operație. Necesită migrare compatibilă și verificarea tranzacțiilor.
2. Creșterea constantelor peste textarea/JSON actual. Efort mic, dar rămân copiile integrale, serializarea repetată și analiza sincronă. Nu satisface editarea susținută a scripturilor complexe.
3. Rescriere imediată într-o aplicație complet nativă. Cost mare, reface randarea Mermaid/Docs și exporturile; nu este justificată de probele actuale. Electron rămâne platforma aleasă.

## Limite actuale și separarea bugetelor

Modelul actual folosește `String.length` (unități UTF-16), până la 64 istorii integrale, 500k caractere/sursă, 4 MiB bibliotecă agregată și 2 MiB drafturi private incluzând baza. Harta Python are separat 100k caractere/3k linii/120 blocuri. Vezi raportul independent `desktop/reviews/2026-10-02-desktop-evolution-bugs-scale.md` și `desktop/src/ui/storage.js`.

Noul `SourceMetrics` raportează bytes UTF-8, unități UTF-16, linii, linia cea mai lungă și versiunea sursei. UI folosește „caractere” cu definiția disponibilă în detalii; limitele de stocare folosesc bytes. Nu estimează memoria nativă din JS heap.

Editarea, indexarea, comparația și layout-ul au bugete distincte. Analiza monitorizează bytes/tokenuri, adâncime, definiții, timp și memorie; gărzile împiedică blocarea aplicației. Numărul de linii este metrică și fixture, nu motivul unic al refuzului. Pragurile de analiză finale sunt selectate după probe pe hardware declarat. Grafurile sunt filtrate după funcție/clasă/selecție; sursa completă nu produce automat sute de mii de noduri.

## Componente și contracte

### SourceRepository nativ

Păstrează sursele în zona de date deținută, separat de manifestul proiectului. Identitate stabilă: `projectId`, `sourceId`, versiune monotonă, SHA256 al bytes confirmați, encoding, newline și proveniență Docs/agent/release sau „Cod nelegat”. Manifestul păstrează referințe, nu copia integrală a fiecărui text.

IPC acceptă identități validate, intervale și versiuni; nu acceptă căi arbitrare. Importul de fișier este selectat explicit prin dialog nativ. UTF-8 valid, BOM și LF/CRLF sunt păstrate; inputul invalid/encodingul nesuportat păstrează bytes originali pentru export și cere conversie explicită înainte de editare. Sursele extrase din Docs păstrează conținutul și identitatea originală. Migrarea nu inventează legături cu agenți.

`readRange(sourceId, version, start, end)` și `applyEdit(sourceId, expectedVersion, range, insertedText, operationId)` au intervale în unități UTF-16; editările nu pot separa o pereche surrogate, iar inputul cu surrogate neîmperecheat este refuzat explicit, fără înlocuire silențioasă la codarea UTF-8. `getMetrics`, `commitSource`, `exportSource` și `subscribeSource` returnează starea explicită. Operațiile sunt idempotente după `operationId`; conflictul returnează versiunea curentă fără suprascriere automată.

### TextModel și EditorView

Textul folosește operații incrementale și index de linii; undo/redo păstrează operații cu buget în bytes, nu 64 copii complete. Editorul desenează zona vizibilă și un buffer mic; find/replace și selecția operează pe modelul complet. Wrap-ul liniilor extreme poate fi dezactivat explicit în modul surse mari, fără a modifica textul.

Prima alegere pentru evaluare este CodeMirror 6, cu adaptor pentru identitățile și semantica SIREN. Nu este instalat prin această spec și nu este admis numai pe baza documentației. Se verifică Python highlight, căutare, undo, IME, tab/focus, Unicode, accesibilitate și compatibilitatea cu grammar Lezer modificată local. Alternativa internă se justifică doar dacă această evaluare nu satisface contractele; nu se dezvoltă simultan două editoare.

### AnalysisService

Parserul/indexul static rulează în worker cu input deținut și răspunsuri legate de `sourceId + version + jobId`. Cererea nouă anulează lucrarea veche; ignorarea unui rezultat vechi nu este suficientă dacă procesarea continuă să consume resurse. La depășire, workerul este oprit și recreat controlat.

Rezultatul spune `complete`, `partial`, `unsupported`, `budget-exceeded`, `cancelled` sau `error`, indică exact versiunea și limitele acoperirii. Navigarea funcții/clase și legăturile din explicații folosesc intervalele acelei versiuni. Un rezultat stale nu poate fi afișat ca analiză actuală. Un worker/utility process nu este tratat automat ca sandbox pentru execuția codului Python.

### Docs și comparație

Docs arată extrase și referințe la surse, cu navigare bidirecțională Code ↔ bloc/agent/versiune. Pentru surse mari, preview-ul este virtualizat; proiectul nu multiplică textul în fiecare card. Modificarea codului legat produce draft; „Salvează în Docs” rămâne explicit, păstrând proveniența și conflictul de versiune.

Diff-ul se calculează anulabil în fundal și afișează rânduri virtualizate. Dacă algoritmul folosește aproximare, UI o declară; limitarea preview-ului nu înseamnă comparație completă. Versiunile A/B sunt imuabile și identificate prin hash.

## Persistare, migrare și recovery

Un singur owner nativ serializează operațiile surselor și manifestului. Salvează bloburile necesare, le verifică, apoi manifestul cu versiuni și pointerul selectat atomic. Confirmarea conține exact versiunile și hashurile; un eșec după commit nu este raportat drept „nu s-a scris nimic”.

Drafturile neconfirmate sunt păstrate separat, cu bază și operații, fără a suprascrie sursa confirmată. Checkpointurile referă bloburi imuabile; garbage collection șterge numai blobs fără referințe din manifestele, drafturile și punctele de recuperare păstrate. Întreruperea, disc plin și checkpoint eșuat păstrează ultima stare confirmată lizibilă. Nu se șterge ultima copie bună pentru a respecta un buget.

Schema nouă are migrare explicită într-o copie nouă verificată; originalul schema 1 rămâne intact. Importul vechi rămâne disponibil. Versiunea veche nu poate edita tăcut proiectul nou; backup-ul/exportul declară schema. Migrarea contului/PIN nu face parte din acest subsistem.

## Matrice de calificare

Pentru fiecare țintă 100k/300k se verifică surse compacte și reprezentative, Unicode, BOM, newline mixt, linii foarte lungi și sintaxă incompletă. Scripturile includ clase/decoratori, generators/async, match/case, comprehensions, nested scopes, multiline strings și multe definiții. Nu sunt executate.

Se măsoară import, cold open, editare început/mijloc/EOF, paste/delete, undo/redo, find/replace, diff, index și hartă filtrată. Se verifică hash după save/export/Quit/restart, crash înainte/după confirmare, disc plin, conflict în două ferestre și anulare. Se profilează mai întâi blocajul anterior, păstrând eșecul.

Ținte de interacțiune pentru fixture reprezentativ și hardware declarat: editare locală p95 ≤100 ms, răspuns la anulare ≤500 ms, deschidere ≤5 s. Acestea sunt criterii propuse pentru raportare; o țintă ratată rămâne eșec, nu se mărește timeoutul până la PASS. Se raportează CPU, memoria totală a proceselor, memoria de vârf, I/O, amplificarea retenției și timpul sarcinilor UI. Nu se declară „300k suportat” dacă numai deschiderea a trecut.

## Ordine și limite de scop

1. Remedierea defectelor actuale de integritate și profilarea fixture-ului adverse.
2. SourceRepository, migrare, receipte și recovery; apoi TextModel/EditorView.
3. Indexare, diff și grafuri filtrate, apoi legături Docs și ferestre native.

Bugetele editorului nu califică automat Mermaid, Docs, Present sau exportul; fiecare primește probe distincte. Nu include AI, execuție Python, conturi online sau publicarea unui release.

Referințe primare: [sursa CodeMirror EditorView](https://github.com/codemirror/view/blob/main/src/editorview.ts), [Electron utility process](https://www.electronjs.org/docs/latest/api/utility-process). Acestea justifică evaluarea mecanismelor; nu dovedesc capacitatea SIREN.
