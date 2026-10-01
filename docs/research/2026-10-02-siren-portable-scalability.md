# SIREN — fezabilitate pentru desktop portabil și proiecte mari

Data: 2 octombrie 2026. Autor: /root. Stare: cercetare și recomandare; nicio migrare, dependență, aplicație desktop sau creștere de limită implementată. Nu este o specificație aprobată sau un raport de performanță al unui prototip.

## Obiectivul exprimat

Utilizatorul cere scalabilitate și întreabă dacă SIREN poate deveni o aplicație portabilă, asemănătoare distribuției portabile Sublime, pentru a mări limitele și scopul programului. Contextul acceptat păstrează prioritatea desktop, UI calm și temele existente, Docs/agenți, diagrame/export și mai multe ferestre Code/Docs. Ipoteza acestei cercetări este un prim pachet Windows cu pornire offline și date de proiect mutabile; alegerea finală a distribuției/stocării nu este încă aprobată.

## Situația reală

SIREN v1.131.0 este deja un HTML deschis local fără instalarea aplicației. Funcționează într-un browser și păstrează starea în mecanismele de stocare ale browserului. Fișierul livrat are13,626,609B, SHA5FCE39D9AFC9D8D9A7367647A23AA5B07A00C61BDC357E369805D0BD3754FAA4. Cercetarea nu îl modifică.

Inspecția codului instalat arată limite stabilite de SIREN: harta Python100000 caractere/3000 linii/120 blocuri, colorare100000 caractere, import Code2MiB, sursă Docs/bibliotecă500000 caractere, bibliotecă4MiB UTF8 inclusiv metadata și recuperare cumulată a drafturilor2MiB inclusiv baza și textul curent. Draftul de import poate rămâne privat, iar peste bugetul recuperării poate fi doar în memorie. Aceste plafoane nu demonstrează că JavaScript sau browserul nu pot trata documente mai mari.

Editorul actual folosește textarea și strat de colorare; drafturile păstrează versiuni întregi de text pentru Undo și serializează baza/textul pentru recuperare. Analiza/harta și comparația au operații care prelucrează documente întregi. Un executabil care încarcă aceeași implementare păstrează aceste costuri. Problema T256 de inserare nativă masivă în jur de3000linii rămâne deschisă; testele de80.000linii nu au fost încă executate.

## Opțiuni verificate în documentația primară

| Variantă | Avantaj | Compromis |
| --- | --- | --- |
| HTML îmbunătățit | Editor și analiză scalabile pot fi dezvoltate înaintea ambalării; reutilizează distribuția actuală | Stocarea/integrarea fișierelor depind de browser și de permisiunile lui |
| Electron portabil | Reutilizează HTML/CSS/JS și include Chromium/Node; electron-builder are țintă Windows portable | Pachet și consum de bază mai mari; datele portabile trebuie configurate explicit |
| Tauri/WebView2 | Poate avea un pachet mic când utilizează runtime-ul sistemului | Autonomia offline necesită runtime disponibil sau distribuit; acel runtime mărește pachetul și cere propria calificare |

[Electron](https://www.electronjs.org/) documentează motorul inclus și modelul pentru aplicații web desktop. [electron-builder v26 PortableOptions](https://www.electron.build/v26/docs/api/app-builder-lib.interface.portableoptions/) documentează ținta portabilă; documentația implicită consultată este pentru v27 încă nelansat, de aceea recomandarea nu presupune utilizarea acelui prerelease. Un ZIP cu executabil și resurse este suficient pentru obiectivul «fără setup»; portabilitatea nu presupune un singur fișier sau zero fișiere temporare.

[Tauri](https://v2.tauri.app/distribute/windows-installer/#fixed-version) și [Microsoft](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#the-fixed-version-runtime-distribution-mode) descriu distribuția unui WebView2 fix. Documentația Tauri prezintă în principal instalatoare; disponibilitatea unui executable Tauri nu constituie singură un pachet portabil complet verificat.

[CodeMirror6](https://codemirror.net/docs/guide/#viewport) afișează porțiunea vizibilă plus o margine, ceea ce oferă un mecanism concret pentru editorul scalabil. [Exemplele oficiale](https://codemirror.net/examples/) includ un document cu milioane de linii. Acestea susțin alegerea unui candidat pentru test, nu garantează performanța analizei, comparației sau Mermaid din SIREN. Paginile directe guide/million au returnat403 prin instrument; descrierile indexate ale acelorași surse primare au fost disponibile. Nu a fost rulată demonstrația și nu există un benchmark local CodeMirror în această etapă.

## Direcția recomandată, supusă proiectării

Electron, distribuit inițial ca folder/ZIP portabil, este candidatul recomandat pentru un motor de afișare controlat și tranziția din SIREN actual. Un folder Data/Projects alături de aplicație poate păstra proiectele și preferințele; locația trebuie stabilită explicit. [API Electron app](https://www.electronjs.org/docs/latest/api/app#appsetpathname-path) permite configurarea directoarelor de date/sesiune; comportamentul implicit folosește directoarele utilizatorului și nu oferă automat date mutabile împreună cu executabilul.

Lucrările de scalabilitate care justifică limite mai mari:

1. **Editor:** candidat CodeMirror6, text și Undo prin modificări, afișarea liniilor vizibile, culori și Find/seleții exacte, integrare cu ferestrele și temele actuale. Editorul poate avansa și în varianta HTML.
2. **Analiză:** proces/worker separat, anularea rezultatelor depășite, analiză incrementală și index de module/clase/funcții. Păstrează referințe către intervalele sursei exacte și statut distinct pentru analiză incompletă.
3. **Scheme:** vedere generală a modulelor, apoi deschiderea unei funcții/clase; randare a subsetului solicitat și cache. Un editor de80.000linii nu justifică un singur SVG cu zeci de mii de blocuri.
4. **Stocare:** sursele mari ca fișiere/blobs separate de metadata Docs; tranzacții și indexuri pe disc, istoric prin diferențe, recuperare verificată și conflict la scriere. Dimensiunea sursei și memoria disponibilă devin criterii, în locul măririi arbitrare a tuturor constantelor.
5. **Portabilitate:** rută de date relativă configurată, actualizări care păstrează Data, migrarea prin copie a proiectelor existente, transfer verificat pe alt PC și pornire offline. Importul vechilor .siren/Docs și identitățile/release-urile trebuie conservate; roundtrip-ul unor surse peste limitele vechi nu este presupus compatibil automat.

Ordinea recomandată este editor + măsurători, analiză/index/hartă la cerere, apoi adaptorul de stocare și calificarea pachetului desktop. Rescrierea întregului SIREN în C++/Rust nu rezultă ca necesară din această cercetare.

## Cum se demonstrează capacitatea nouă

Primul obiectiv propus este deschiderea și revizuirea unei surse de80.000linii, cu100.000linii ca probă suplimentară. Se măsoară separat timp de import/deschidere, tastare/lipire, scroll și Find la început/mijloc/final, Undo/Redo, A/B, consum de memorie, indexare și hartă. Corpusul include funcții numeroase, indentare/nesting, Unicode/CRLF, șiruri foarte lungi și cod invalid.

Pentru fiecare probă se păstrează textul/bytes exact, se descarcă și se compară hash-ul, se reîncarcă drafturile și proiectul, se verifică salvarea explicită în Docs și funcționarea celorlalte suprafețe în timpul analizei. Mutarea folderului pe alt PC se verifică offline și cu datele intacte. Limitele/ținta de performanță se aleg după măsurători pe hardware identificat; nu există încă garanție de80.000linii sau un pachet portabil livrat.
