# AI opțional în SIREN — cercetare și decizie consemnată

Data: 2 octombrie 2026. Autor: /root. Cercetare în documentația oficială, fără cheie, instalare sau apel AI. Acest document consemnează intenția utilizatorului și recomandări pentru o etapă viitoare; nu este o integrare implementată sau un design API aprobat.

## Decizia utilizatorului

AI devine **ultimul punct** al evoluției desktop. Cheia nu a fost generată. Utilizatorul va introduce propria credențială într-o zonă dedicată de configurare. Fără configurare, comenzile AI nu apar în interfața de lucru. SIREN trebuie să păstreze toate funcțiile locale fără AI. Contul SIREN, PIN-ul local și credențiala furnizorului AI sunt trei lucruri distincte.

Nu se creează automat conturi sau chei și nu se folosește autentificarea existentă a altui program. Cheia nu se cere în chat. O simplă prezență a unui text în câmp nu dovedește că autentificarea, modelul sau facturarea funcționează.

## Ce există la OpenAI și Copilot

| Opțiune | Autentificare documentată | Implicație pentru SIREN |
| --- | --- | --- |
| OpenAI API | API key / bearer authentication | Candidatul inițial pentru cheia proprie a utilizatorului; accesul disponibil trebuie verificat ulterior |
| Microsoft 365 Copilot APIs | Înregistrare Entra ID, token în numele utilizatorului; licență Microsoft 365 Copilot și abonament Microsoft 365 eligibil | Integrare organizațională separată, cu OAuth; nu se tratează drept același câmp de cheie OpenAI |
| GitHub Copilot SDK | Autentificare GitHub; documentează și BYOK pentru furnizori de modele | Produs distinct de Microsoft 365 Copilot; BYOK folosește cheia furnizorului, nu transformă acea cheie într-o licență Copilot |

OpenAI descrie API HTTP și protejarea cheilor în afara codului client. Nu se include o cheie comună SIREN în executable sau renderer. [OpenAI API overview](https://developers.openai.com/api/reference/overview).

Microsoft 365 are inclusiv Chat API în preview. Documentația cere licențele de mai sus și tokenuri obținute prin Entra/MSAL, apoi trimise la API-urile Microsoft Graph. Aceasta nu este o cheie universală pentru toate produsele numite Copilot. [Microsoft 365 Copilot APIs overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview).

GitHub documentează autentificarea SDK și o rută BYOK care ocolește autentificarea Copilot, folosind furnizorul ales. Nu presupunem acces, model sau abonament disponibil fără verificare pe contul real. [GitHub Copilot SDK authentication](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate), [BYOK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/byok).

**Recomandare de produs:** OpenAI direct întâi, printr-un adaptor mic. Nu adăugăm Copilot SDK numai pentru a transmite aceeași cheie OpenAI; un al doilea furnizor trebuie justificat printr-un beneficiu concret. OAuth Microsoft/GitHub se evaluează separat dacă utilizatorii îl cer. Aceasta este o recomandare, nu o limitare declarată a API-urilor.

## Comportament propus, pentru designul viitor

În Settings rămâne o intrare discretă „AI integrations”, accesibilă și când AI este oprit. Astfel cheia poate fi introdusă fără a încărca navigarea principală. Fără activare, nu apar butoane AI în Code, Docs, diagrame, meniuri contextuale sau căutarea de comenzi. Ascunderea UI trebuie însoțită de verificare în adaptorul nativ.

Configurarea are stări explicite: neconfigurat, verificare, configurat, indisponibil temporar și dezactivat. După activare, o întrerupere de internet afișează o stare clară și păstrează draftul. Eliminarea credențialei ascunde comenzile și anulează cererile active. Testarea conexiunii va fi o acțiune explicită; orice cerere care poate costa bani trebuie explicată înainte de folosire.

Secretul ar urma să fie păstrat în serviciul nativ, separat de proiecte, exporturi, recovery și loguri. UI primește numai starea configurării, niciodată cheia recuperată. Electron safeStorage pe Windows utilizează DPAPI și nu protejează față de alte aplicații din același cont Windows; transferul folderului între conturi/calculatoare poate necesita reintroducerea credențialei. Nu promitem protecție absolută prin stocare locală. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

Primele funcții recomandate: explicarea unei selecții cu legături la liniile sursă, rezumat pentru un draft Docs și propuneri de diagramă. Rezultatul este marcat AI și se aplică numai după revizuire; nu este aprobare independentă, execuție de cod sau verdict automat de fix. Contextul trimis trebuie să fie vizibil și selectat, fără încărcarea implicită a întregului proiect.

Streaming, Cancel, limite de context/ieșire și tratarea erorilor se proiectează înainte de integrare. OpenAI documentează streaming prin evenimente SSE. [Streaming responses](https://developers.openai.com/api/docs/guides/streaming-responses). Modelele/prețurile nu sunt fixate în această etapă fără criterii și acces real.

`store: false` nu este echivalent cu Zero Data Retention. Politica de retenție depinde de cont, endpoint și funcțiile utilizate; notificarea privind datele trimise trebuie să reflecte aceste condiții. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Condiții înainte de implementare

Design și contracte revizuite, credentială furnizată printr-un canal sigur când începe etapa, reguli pentru date/context, limite de cost și teste negative pentru secret/export/log/recovery/lock. Se verifică explicit că fără activare nu există cereri externe sau comenzi AI accesibile. Testele reale folosesc un proiect sintetic și au verdict separat de testele cu răspunsuri simulate.

Această clarificare nu schimbă PIN-ul local și nu reactivează implementarea conturilor online amânată anterior.
