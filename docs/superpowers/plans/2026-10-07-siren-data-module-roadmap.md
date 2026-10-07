# SIREN Data — cerințe de produs și roadmap viitor

Data: 7 octombrie 2026. Autor document: `/root/catalogue_view`, revizuit de `/root`, după cerința directă a utilizatorului de a nota în plan un modul Data cu ambiție de procesare vizuală similară Alteryx.

**Status: USER_REQUESTED_FUTURE_NOT_IMPLEMENTED. Cerințe de produs / roadmap viitor; nu plan de implementare aprobat.** Acest document înregistrează direcția cerută, fără implementare, motor ales, dependențe noi, capacitate calificată sau date estimate. Referința la Alteryx exprimă ambiția funcțională; nu afirmă paritate completă verificată și nu reprezintă o analiză a produsului respectiv.

## Rezultatul dorit

Utilizatorul construiește vizual un flux de date complex, înțelege fiecare transformare, inspectează codul generat și rulează explicit scriptul corespunzător unei versiuni finalizate. Modulul trebuie să deservească procesarea bazelor de date și seturilor mari de date, dincolo de simpla vizualizare CSV.

Clarificarea ulterioară cere și **modelare de risc financiar**, pivoti și automatizarea fluxurilor, cu țintă explicită de benchmark de **100 de milioane de rânduri și peste (100M+)**. Aceasta este o țintă cerută pentru proiectare/testare, **nu o capacitate actuală, limită calificată sau promisiune de performanță**.

- **Data** devine un modul distinct în navigarea comună, alături de Diagrams, Docs, ⌘ Code și Present. Acest flux de transformări nu este doar o diagramă Mermaid și nici echivalentul automat al playbook-urilor [SIREN Flows](../../research/2026-10-07-siren-flows.md).
- Interfață în stilul SIREN: teme comune, contrast și mișcare redusă, canvas central, instrumente contextuale și inspector redimensionabil. Detaliile avansate se deschid la cerere; nu se adaugă permanent toate comenzile în bara principală.
- Builder cu noduri, porturi și conexiuni: adăugare, configurare, conectare, mutare, selecție, ștergere, undo/redo, zoom, căutare și alternative prin tastatură. Tipurile și sensul conexiunilor trebuie să fie explicite.
- Ferestre Data detașabile și lucru pe mai multe monitoare, cu restaurare/minimizare și aceeași coordonare de proiect/salvare/Lock ca restul aplicației desktop. Aceasta este o cerință viitoare, nu un nou rol nativ deja disponibil.

## Familii de funcții cerute

| Arie | Capacitate urmărită |
| --- | --- |
| Surse și conexiuni | Import de fișiere și conectare la baze de date; selecție tabele/coloane, schemă/tipuri, parametri și filtre la citire. Formatele și conectorii exacți rămân de ales. |
| Transformări | Selectare/redenumire coloane, filtre, formule, conversii de tip, curățare, valori lipsă, deduplicare, sortare și combinare de surse. |
| Relații | Join-uri cu chei și tip de relație vizibile; union/append; explicarea rândurilor fără corespondent, duplicatelor și multiplicării rezultate. |
| Analiză | Group by, agregări, pivot și unpivot; rezultate intermediare și comparație între pași, cu limite de preview afișate. |
| Ieșiri | Preview tabelar virtualizat, rezultate complete gestionate separat, exporturi și destinații explicite. Formatele, scrierea în baze și tranzacțiile sunt decizii de design. |

Semantica valorilor nule, tipurilor, preciziei numerice, datelor calendaristice/fusurilor orare și sortării trebuie specificată și testată pentru motorul ales. Un exemplu vizual nu dovedește corectitudinea transformării.

Pentru aria financiară, exemple de nevoi de definit cu utilizatorul sunt reconcilierea, scenariile, cohortele și compararea seturilor istorice. Sunt necesare precizie zecimală explicită, monedă/unități, convenții de date și null-uri, lineage pe transformări și versiuni de intrări/rezultate pentru audit și repetabilitate. Formulele, modelele și ipotezele lor au verificări proprii, distincte de executarea corectă a fluxului.

## Code ↔ flow și Docs

Fluxul generează cod **vizibil, inspectabil și editabil în ⌘ Code**. Nu limităm modulul la Python: Python, SQL sau alt limbaj/motor potrivit sunt opțiuni pentru research, nu alegeri deja făcute.

Fiecare generare trebuie să lege exact identitatea/versiunea fluxului, configurația validată și versiunea generatorului de versiunea/hashul scriptului. În Code și Data se vede dacă legătura este actuală sau dacă scriptul/fluxul s-a schimbat. Editarea manuală a codului păstrează versiunea anterioară și **invalidează explicit sincronizarea**; regenerarea nu suprascrie silențios modificările.

Nu promitem conversia automată a oricărui script editat înapoi în noduri. Domeniul unui eventual round-trip, reconcilierea și comparația modificărilor sunt decizii viitoare. Alegerea versiunii rulate trebuie să distingă scriptul generat din flux de un script modificat manual.

Docs poate documenta scopul fluxului, sursele și schemele, transformările, deciziile, versiunile și rezultatele unei rulări. Proveniența leagă `flow version ↔ script version/hash ↔ run ID ↔ result/export`, împreună cu motorul/versiunea și parametrii relevanți, fără a copia acreditări sau întregul dataset în Docs. O legătură de documentare nu dovedește că datele externe neschimbate pot fi reproduse; snapshoturile și identitatea lor cer design separat.

## Validare și rulare explicită

Un flow finalizat are o versiune salvată și trece validarea structurală și a configurației înainte de **Run**: conexiuni valide, intrări obligatorii, compatibilitate de schemă/tipuri și destinații definite. Tratarea ciclurilor și a pașilor de script arbitrar rămâne de proiectat. Validarea statică nu garantează accesul la surse sau succesul execuției.

Run pornește explicit scriptul identificat prin versiune/hash și afișează stări distincte pentru așteptare, rulare, succes, anulare, eroare și rezultat parțial/neconfirmat. Sunt necesare progres pe pași, loguri limitate și redactate, durată, contoare de rânduri/bytes, rezultate/preview și exporturi identificabile. Un export reușit urmat de o eroare de afișare nu trebuie raportat ca și când nu s-a scris nimic. Retry-ul nu dublează automat ieșirile.

Importul, drop-ul unui fișier, deschiderea unui proiect, selectarea unui nod sau deblocarea prin PIN **nu execută cod și nu repornesc automat o rulare**. Autoritatea de execuție, anularea, cleanup-ul, crash recovery, Lock și comportamentul joburilor deja pornite cer specificație și calificare; un canvas nu acordă acces de shell. Designul trebuie să respecte politica SIREN de a bloca intrările noi la Lock fără întreruperea arbitrară a unei comenzi deja în progres. Cum se aplică aceasta joburilor Data și etapelor încă neîncepute rămâne explicit de definit.

## Date mari: limite măsurate, nu promisiuni

Bugetele se măsoară în bytes, memorie totală, spațiu temporar pe disc, rânduri/coloane și complexitate, nu numai în linii de cod. Limitele existente pentru surse text nu califică un dataset sau o bază de date.

Arhitectura va evalua citire pe loturi/streaming cu backpressure, partiționare, agregări/operații împinse către baza de date când sunt compatibile, procesare în afara memoriei și spill pe disc unde este necesar. Join, sort și pivot pot cere materializare; nu se promite streaming nelimitat pentru toate nodurile. Preview-ul este limitat și etichetat ca eșantion; interfața nu încarcă integral datele în fiecare fereastră și nu confundă preview-ul cu rezultatul complet.

Capacitatea practică se publică numai după probe reprezentative: surse mari, rânduri late, chei duplicate/dezechilibrate, multe grupuri/coloane pivot, surse lente, consumator lent, memorie/disc insuficiente, pierderea conexiunii, anulare și restart. Se păstrează limitele/refuzurile și rezultatele parțiale, fără trunchiere tăcută sau afirmația „baze nelimitate”.

Benchmarkul **100M+** trebuie să folosească date artificiale reproductibile și să raporteze lățimea rândului, bytes efectivi, tipuri, cardinalitate și distribuție de chei, complexitatea join-urilor/pivotului, RAM maximă, spațiu temporar, CPU, hardware și timp pe operație. Un count/preview rapid pe 100M de rânduri nu califică un join sau pivot complet la aceeași dimensiune. Limitele trebuie distinse pentru import, scanare, transformare, rezultat materializat și export.

## Decizii rămase pentru research și design

- Motor, limbaje, conectori/formate, instalare/packaging, reutilizarea componentelor existente versus dezvoltare proprie, mentenanță, costuri și licențe ale dependențelor. Nu este selectată sau instalată nicio bibliotecă prin acest roadmap.
- Autoritatea proceselor și izolarea execuției; relația cu Terminal/debugger; scrierea parametrizată a interogărilor și compatibilitatea conectorilor. Direcția este acces **read-only implicit** și acreditări păstrate în afara fluxului/scriptului/logurilor; implementarea și verificările concrete rămân de proiectat.
- Ce destinații pot modifica/înlocui date, cum se exprimă explicit intenția și cum se gestionează tranzacțiile, idempotency, rollback și rezultatele neconfirmate. Acestea sunt întrebări de design, nu un flux suplimentar de aprobare introdus acum.
- Snapshoturi/proveniență de date externe, concurență, cache, retenție/curățare fișiere temporare și recuperare după crash, fără ștergerea rezultatelor încă referite.
- Automatizare prin fluxuri reutilizabile parametrizate și rețete de rulare versionate, cu loguri, Stop și recovery. Scheduling, joburi recurente/fundal și reluare automată rămân decizii viitoare, fără mandat implicit de execuție în fundal. UX pentru utilizator non-programator, accesibilitate și integrarea cunoștințelor contextuale.

## Etape și criterii de acceptare viitoare

1. **Research și design separat:** inventar de nevoi/conectori, comparație de motoare/licențe/costuri, model flow/script/proveniență, limite și contract de execuție. Rezultat: specificație și plan de implementare delimitat; prezentul document nu le substituie.
2. **Builder și generare fără execuție:** flux salvat/redeschis fără pierderi, transformări cu semantici definite, cod inspectabil/versionat, legături Docs și invalidarea sincronizării la edit manual. Niciun side effect la import/drop/PIN.
3. **Rulare locală calificată:** validare și Run explicit pentru versiunea exactă; status/loguri/preview/export, anulare și rezultate neconfirmate demonstrate. Separarea privilegiilor, Lock și crash se verifică efectiv, nu numai în mock-uri.
4. **Capacitate și extindere:** ținta 100M+ măsurată separat pentru operații pe date artificiale, out-of-core/streaming/backpressure și bugete demonstrate pe hardware identificat; join/pivot adverse și conectori calificați individual; ferestre detașabile, teme și multi-monitor verificate. Se publică numai limitele măsurate. Fluxurile parametrizate și cazurile financiare au intrări/rezultate versionate și verificări proprii; scheduling-ul și familiile avansate primesc ulterior propriul scop.

Legături de context: [surse mari — design aprobat](../specs/2026-10-02-siren-large-sources-design.md), [ferestre native — design aprobat](../specs/2026-10-02-siren-native-workspaces-design.md), [Terminal — plan existent](2026-10-03-siren-terminal.md), [roadmap desktop](../../research/2026-10-02-siren-desktop-evolution.md). Aceste documente păstrează propriile stări și dovezi; adăugarea modulului Data nu le califică și nu rescrie istoricul.
