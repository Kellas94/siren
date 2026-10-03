# SIREN Terminal: cerințe și biblioteci

Autor `/root`, 3 octombrie 2026. Cercetare și propunere arhitecturală; nu este un design de implementare aprobat și nu instalează dependențe. Planurile aprobate pentru surse și ferestre rămân în curs.

Utilizatorul a ales un **shell real legat de proiect**. Politica de Lock: ce rulează deja continuă în fundal; SIREN se blochează și refuză inputul nou. Scripturile care cer input așteaptă deblocarea. Comenzile deja transmise shellului, inclusiv pipeline-uri/grupuri, pot continua; Lock nu suspendă procesele și nu anulează drepturile lor OS.

Recomandarea pentru evaluare este **xterm.js + node-pty/ConPTY**, cu manager PTY nativ dedicat și bridge local limitat. Alternativa `child_process` cu stdin/stdout servește sarcini simple, dar nu înlocuiește fidel un terminal interactiv; un helper ConPTY propriu ar adăuga întreținere nativă înainte să existe o nevoie demonstrată. [xterm.js](https://github.com/xtermjs/xterm.js), [node-pty](https://github.com/microsoft/node-pty).

| Pachet | Versiune stabilă observată direct în npm | Licență declarată | Rol |
|---|---:|---|---|
|`@xterm/xterm`|6.0.0|MIT|afișare terminal|
|`@xterm/addon-fit`|0.11.0|MIT|resize|
|`@xterm/addon-search`|0.16.0|MIT|căutare buffer|
|`node-pty`|1.1.0|MIT|sesiune PTY nativă|

node-pty declară `node-addon-api ^7.1.0`; aceasta nu este lista completă a componentelor native/Windows. Compatibilitatea addonurilor, licențele, DLL/helper și integritățile se verifică în proba izolată, înainte de admitere. Nu s-au instalat pachetele. Addonurile WebGL/imagini/linkuri nu sunt necesare în primul lot.

Propunere UI: Terminal lângă Code în navigarea principală, panou inferior redimensionabil și opțiune de fereastră nativă detașabilă. Taburi per sesiune; proiect/director/shell/stare vizibile. Controale principale puține: sesiune nouă, shell, căutare, clear, stop și detach; context menu, scurtături, teme și restore shelf comune. PowerShell este profilul inițial propus, fără rularea automată a scripturilor de profil. Alte shelluri sunt opțiuni explicite dacă există pe sistem. Terminalul nu include automat un interpretor Python.

Un proiect SIREN poate avea numai surse virtuale. Folderul de lucru trebuie ales explicit și separat de bloburile interne imuabile. „Terminal aici” deschide shellul; „Rulează versiunea” este o acțiune explicită, cu sursa/versiunea/path-ul materializat afișate. Vizualizarea/importul codului nu îl execută. Salvarea comenzilor/outputului în Docs este explicită și păstrează proveniența; istoricul nu devine document automat.

Terminalul este un rol separat al registrului nativ; Docs/Presenter/Audience nu primesc execuție. Main verifică caller/frame/project/epoch/session și mesaje tipate create/input/resize/attach/dispose. Rendererul rămâne fără Node și fără API generic de spawn. Shellul are drepturile utilizatorului; PTY/process isolation/PIN nu sunt sandbox pentru cod. node-pty avertizează asupra drepturilor procesului și nu este thread safe; propunem un singur host PTY dedicat, nu instanțe în mai multe worker threads. [node-pty security](https://github.com/microsoft/node-pty#security).

La Lock, blocăm inputul înainte de ACK și curățăm/distrugem vederea, menținând sesiunea în hostul nativ. Un renderer cu epoch vechi nu poate scrie. Outputul merge într-un ring buffer nativ limitat; după Unlock reatașăm sesiunea și indicăm istoricul eliminat prin limită. Procesul nu trebuie să se blocheze doar fiindcă vederea este încuiată. Minimizarea/detașarea schimbă numai vederea; Stop este distinct. Quit/update/schimbarea proiectului trebuie să trateze explicit sesiunile active. Nu promitem continuare după crash sau reexecutarea automată a comenzilor; terminarea familiilor de procese deținute și prevenirea orfanilor trebuie calificate pe Windows.

Outputul este date neîncrezute, nu HTML/comandă SIREN. Contextul terminalului rămâne mic și separat de conținutul Docs, cu bundle local și bridge minim; escape sequences/linkuri nu pot obține acces nativ ori clipboard necontrolat. [xterm security](https://xtermjs.org/docs/guides/security/). Streamingul folosește chunkuri, backpressure și ACK după procesare, cu limite bytes/scrollback/memorie. Nu transferăm un log complet la fiecare eveniment. Când UI este încuiat, bufferul limitat continuă să dreneze outputul; capturarea completă pe disc este o opțiune explicită, cu buget și retenție. Testele de flood trebuie să păstreze răspunsul UI/Ctrl+C/Lock. [xterm flow control](https://xtermjs.org/docs/guides/flowcontrol/).

node-pty necesită calificare pentru Electron44.5.1/Windowsx64, package allowlist, plasare adecvată a fișierelor native în afara ASAR dacă este necesară și hashuri în întregul release semnat. Instalarea pe Node-ul de build nu demonstrează compatibilitatea Electron. Buildul/rebuildul sunt făcute în dezvoltare; utilizatorului nu i se cer compilatoare. Fiecare schimbare Electron cere recalificarea addonului. [Electron native modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

Ordine propusă: registru/surse/lifecycle stabile → design Terminal aprobat → probă izolată → implementare. AI rămâne ultimul. Proba va acoperi shell real, ANSI/Unicode/IME, resize, paste multiline, teme, flood/backpressure, procese care cer input, Lock→comandă terminată→Unlock, taburi, crash/quit/cleanup și pornire portabilă fără build tools. Specificația și planul separate trebuie revizuite înainte de cod; această propunere nu schimbă retroactiv scope-ul planurilor deja aprobate.
