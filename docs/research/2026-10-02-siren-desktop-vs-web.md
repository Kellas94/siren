# SIREN — evaluare desktop portabil versus aplicație web

Data: 2 octombrie 2026. Autor: /root. Stare: evaluare/recomandare, fără implementare, publicare, cont cloud sau migrare de date. Completează cercetarea despre scalabilitate și portabilitate; nu este o specificație aprobată. Aplicația livrată rămâne v1.131.0/R78.

## Recomandarea pentru cerințele actuale

Pentru prioritatea explicită desktop, cod mare și revizuirea/documentarea agenților cu fișiere locale, recomand ediția portabilă ca prim produs principal. Nucleul trebuie însă construit ca aplicație web modulară, cu editor/parser/hărți/Docs și modele de proiect reutilizabile, iar integrarea cu discul separată printr-un adaptor. Acest lucru păstrează deschisă o ediție găzduită și evită două produse rescrise independent.

Aceasta este o recomandare bazată pe cerințele cunoscute, nu pe benchmark-uri desktop-versus-web inexistente. Dacă prioritatea devine accesul imediat pentru mulți utilizatori, colaborarea și utilizarea pe mai multe calculatoare, ordinea recomandată se schimbă: aplicație web cu stocare locală întâi, servicii de sincronizare apoi, ediție desktop după validarea nevoii de integrare locală.

## «Site» acoperă două produse diferite

O aplicație găzduită poate descărca interfața și poate prelucra/păstra codul pe calculatorul utilizatorului. PWA poate adăuga funcționare offline după încărcarea și păstrarea resurselor necesare. Această variantă nu oferă automat sincronizarea datelor între calculatoare. Un server pentru livrarea aplicației nu este totodată un server de proiecte.

Un serviciu cloud adaugă conturi, stocare de proiecte, autorizarea accesului, sincronizare, revizuiri partajate și eventual colaborare simultană. Are un cost operațional și o complexitate semnificativ diferite de găzduirea interfeței. Transferul surselor pe server și analiza pe server trebuie alese explicit în proiectare, fără a presupune că toate datele trebuie încărcate doar fiindcă interfața are URL.

## Comparație aplicată la SIREN

| Criteriu | Desktop portabil | Web cu prelucrare/stocare locală | Web cu servicii cloud |
| --- | --- | --- | --- |
| Acces inițial | Descarcă/extrage/pornește pachetul | Deschide un link în browser | Link; cont când sunt necesare proiecte persistente/private |
| Surse de80.000linii | Necesită editor/analiză scalabile și măsurători | Aceeași nevoie; browserul poate utiliza workers și editor virtualizat | Aceeași nevoie în editor; analiza grea poate fi oferită separat pe server |
| Fișiere/foldere locale | Integrare directă prin funcții limitate la proiectele selectate | Import/export; acces direct la directoare dependent de browser și permisiuni | În plus, upload/download și reconcilierea copiilor |
| Offline | Runtime și resurse incluse în pachet | Posibil prin cache/PWA; prima accesare trebuie să aducă resursele | Interfața/datele deja păstrate pot fi offline; operațiile serverului rămân dependente de conexiune |
| Date confidențiale | Pot rămâne integral pe PC | Pot rămâne integral pe PC | Necesită decizia de stocare/transfer și controlul accesului pe server |
| Mai multe calculatoare | Mutarea/exportul/importul proiectului sau serviciu suplimentar | Export/import; browserul nu sincronizează automat proiectele SIREN | Principal avantaj, după implementarea sincronizării și a conflictelor |
| Colaborare între persoane | Necesită serviciu suplimentar | Necesită serviciu suplimentar | Se potrivește scopului; nu este o funcție primită automat prin publicarea site-ului |
| Actualizări | Pachete/runtime pentru platformele suportate | Publicare centrală, cache versionat și migrare locală | În plus, compatibilitatea API și migrarea datelor serverului |
| Cost de operare | Distribuție/actualizări; fără hosting obligatoriu al proiectelor | Hosting static/domeniu; datele pot fi locale | Hosting, stocare, trafic, operațiuni de analiză și mentenanță a serviciului |
| Descoperirea feature-urilor | Site/demo/tur pentru descărcare și înțelegere | Încercare directă și acces prin link | La fel, cu onboarding și fluxuri de cont/proiect |

Costurile sunt comparative și nu estimări financiare: nu au fost alese provider, volum de utilizatori, dimensiuni de stocare, servicii de calcul sau buget.

## Ce arată sursele și codul actual

SIREN este deja HTML/CSS/JS cu exporturi locale și editor static Python. Inspecția v1.131.0 arată serializarea completă a stării în saveState, drafturi care serializează baza plus textul curent în localStorage și share-uri de diagramă transportate în fragmentul URL. Aceste share-uri nu sunt o bază de date cloud și nu oferă colaborare între editori.

Limitele100000caractere/3000linii pentru hartă,500000caractere pe sursă și2MiB pentru import/recuperare sunt în implementarea SIREN. Publicarea pe un domeniu sau ambalarea într-un executable păstrează acele limite până când modelul/editorul/stocarea sunt schimbate.

[Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) permit analiza în fundal. [CodeMirror](https://codemirror.net/docs/guide/#viewport) oferă afișarea porțiunii vizibile. Aceste mecanisme pot fi utilizate atât în browser, cât și într-o ediție Electron, fără ca un server de analiză să fie o condiție inițială.

[OPFS](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system) oferă fișiere private aplicației și acces din workers, dar nu reprezintă directoarele obișnuite ale utilizatorului. [Accesul la directoare](https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker) are compatibilitate limitată; import/export rămâne o rută necesară în ediția web.

[Stocarea browserului](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) permite IndexedDB/OPFS pentru date mai mari și are cote/persistență dependente de browser. Exportul proiectului și recuperarea verificată rămân relevante. [PWA offline](https://web.dev/learn/pwa/offline-data) necesită cache și stocare implementate/versionate; simpla publicare a HTML-ului nu le adaugă. [electron-builder](https://www.electron.build/v26/docs/targets/) documentează ținta portable fără instalare.

## Ordinea eficientă propusă

1. Separarea nucleului comun de stocare/distribuție, în cadrul unui design aprobat; păstrarea identităților surselor, salvării explicite, comparației și release-urilor existente.
2. Editor virtualizat, Undo prin modificări, analiză în workers, index de simboluri și hărți pe module/funcții. Teste cu80.000–100.000linii și fișiere cu linii foarte lungi, surse invalide și Unicode. Limitele se stabilesc după măsurători.
3. Alegerea unui singur prim adaptor de producție: disc pentru ediția portabilă recomandată în contextul actual sau IndexedDB/OPFS pentru ediția web dacă distribuția publică devine prioritară. Importul datelor existente se verifică prin copii și readback.
4. Un site de prezentare/demo poate expune feature-urile și descărcarea. O ediție web completă cu lucru local poate fi un pas următor folosind același nucleu. Sincronizarea și colaborarea cloud sunt un proiect separat, cu salvare/conflicte și autorizare pe server verificate.

Nu recomand dezvoltarea simultană a două implementări independente și nici începerea directă cu un serviciu cloud complet doar pentru a elimina plafonul de3000linii. Nu există încă pachet desktop, site SIREN publicat sau probe la80.000linii. Modificarea arhitecturii necesită specificație și plan distincte; evaluarea curentă este pregătită pentru alegerea direcției.

## Completare: actualizări automate pentru ediția portabilă

Întrebarea utilizatorului: poate publica un pachet de update pe care aplicația portabilă să îl descarce și să îl aplice singură? Da, această distribuție este fezabilă, dar actualizarea automată trebuie proiectată explicit. Nu există încă un updater SIREN implementat sau testat.

Documentația [electron-builder v26 pentru ținte Windows](https://www.electron.build/v26/docs/targets/) descrie ținta portable fără instalare și precizează că auto-update necesită implementare proprie. Aceasta nu înseamnă că utilizatorul final trebuie să actualizeze manual: un mecanism separat poate automatiza descărcarea și înlocuirea fișierelor. Nu trebuie presupus că electron-updater pentru NSIS se aplică direct unui executable portable. [Ghidul auto-update](https://www.electron.build/v26/docs/features/auto-update/) documentează NSIS ca țintă Windows suportată și distribuția pachetelor/metadatelor prin GitHub Releases sau HTTP(S).

Pentru o ediție portabilă SIREN propun: publicarea pachetului și a unui manifest de versiune prin HTTPS; verificare automată configurabilă; descărcare în fundal; validarea semnăturii și integrității înainte de aplicare; aplicare la următoarea pornire ori prin comanda „Repornește și actualizează”. Launcher-ul/helper-ul de update trebuie să aștepte închiderea proceselor SIREN înainte de înlocuire și să verifice dreptul de scriere în directorul portabil. Găzduirea pachetelor poate fi statică, fără serviciu cloud pentru proiecte.

Datele utilizatorului trebuie păstrate separat de fișierele aplicației. Înaintea schimbării formatului datelor sunt necesare backup și migrare verificată. Revenirea la aplicația precedentă nu este suficientă dacă noua versiune a schimbat formatul proiectului; recuperarea trebuie să includă copia datelor compatibile. Descărcarea întreruptă sau un pachet invalid trebuie să lase versiunea curentă utilizabilă. Acestea sunt cerințe propuse pentru viitorul design, nu capacități deja livrate.

Pentru prima implementare recomand pachete complete, cu optimizarea către pachete diferențiale numai după verificarea update-ului, recuperării și migrării. Interfața recomandată oferă „Descarcă automat, aplică la următoarea pornire” și verificare manuală, fără închiderea bruscă a unei sesiuni active cu drafturi nesalvate.

Utilizatorul indică Sublime Portable ca model de experiență. [Pagina oficială Sublime Text](https://www.sublimetext.com/download) oferă arhiva Windows portabilă. [Discuția de suport cu răspunsul dezvoltatorului](https://forum.sublimetext.com/t/upgrade-portable-version-4180/74884) documentează actualizarea versiunii portabile prin „Check for update” și blocarea înlocuirii directorului de către alte procese. Aceasta confirmă existența fluxului, dar nu este o probă locală pentru build-ul Sublime curent și nici o descriere completă a implementării sale proprietare. Pentru SIREN modelul propus rămâne arhivă extrasă și executable, date/proiecte portabile separate, actualizare din aplicație și aplicare după închiderea proceselor, cu recuperarea sesiunii verificată.
