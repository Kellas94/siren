# SIREN Data — opțiuni de motor și probe de capacitate

Research: `/root/terminal_foundation_review`; redactare și verificarea domeniului: `/root`, 7 octombrie 2026. Surse primare oficiale consultate. **RESEARCH_ONLY_NOT_ENGINE_SELECTION**: fără dependențe instalate, benchmark executat, motor ales sau capacitate 100M calificată. Aceasta este cercetare pentru roadmap-ul cerut, nu un plan de implementare aprobat. API-urile trebuie reverificate și versiunile fixate înainte de implementare.

## Candidați locali

| Opțiune | Ce poate furniza | Ce trebuie măsurat / verificat |
| --- | --- | --- |
| DuckDB, MIT | Motor SQL embedded, API Python și acces la Parquet/CSV, fără server obligatoriu. | Spill pentru operatori grei; combinații de operatori, agregări cu liste și pivoturi cu cardinalitate mare pot depăși memoria. |
| Polars, MIT | Expresii Python/Rust, plan lazy inspectabil și execuție streaming; SQL tradus în expresii. | Operatorii efectiv streaming și fallback-urile în memorie. Pivotul lazy actual cere categoriile cunoscute și are limitări de stabilitate/streaming. |
| Apache Arrow/PyArrow, Apache-2.0 | Format columnar, batches și interoperabilitate C++/Python. | Materializarea rezultatelor, memoria operatorilor și integrarea unui motor de execuție. Nu înlocuiește singur o bază de date. |

DuckDB este o opțiune embedded documentată, inclusiv pentru Python. Limitele de memorie și discul temporar trebuie măsurate pentru workload-ul ales; un prag configurabil nu garantează executarea unui pivot mare. [DuckDB embedded](https://duckdb.org/why_duckdb), [API Python](https://duckdb.org/docs/current/clients/python/overview), [memorie și spill](https://duckdb.org/docs/current/guides/performance/how_to_tune_workloads), [configurație](https://duckdb.org/docs/current/configuration/overview).

Polars poate procesa lazy/streaming, însă unele operații pot reveni la execuție în memorie. Documentația actuală include `LazyFrame.pivot` cu `on_columns` cunoscute; API-ul este marcat unstable și parțial streaming. Afirmația generală că nu există pivot lazy ar fi depășită. [Proiect și licență](https://docs.pola.rs/), [streaming](https://docs.pola.rs/user-guide/concepts/streaming/), [SQL](https://docs.pola.rs/user-guide/sql/intro/), [pivot lazy](https://docs.pola.rs/api/python/stable/reference/lazyframe/api/polars.LazyFrame.pivot.html).

Arrow oferă citire în batches; `to_table()` materializează rezultatul. Acero furnizează execuție streaming, cu API experimental, fără a fi o bază de date completă. Batch IO nu dovedește spill pentru orice join sau pivot. [Licență](https://github.com/apache/arrow/blob/main/LICENSE.txt), [datasets](https://arrow.apache.org/docs/python/dataset.html), [Acero](https://arrow.apache.org/docs/cpp/acero/overview.html), [stabilitate](https://arrow.apache.org/docs/cpp/acero.html).

## Condiții pentru proiectare

Numărul de rânduri nu este suficient pentru o limită de produs. Lățimea rândurilor, cardinalitatea cheilor, multiplicarea joinurilor și dimensiunea rezultatului trebuie să însoțească orice capacitate declarată. Un pivot cu foarte multe coloane poate fi mai dificil decât o scanare a unui set cu mai multe rânduri.

Pentru fluxurile financiare, tipurile și fiecare operație necesită oracole explicite: de exemplu, DuckDB documentează că împărțirea valorilor DECIMAL produce floating-point. Nu presupunem precizie zecimală pentru întregul flux doar din tipurile de intrare. [Semantica numerică DuckDB](https://duckdb.org/docs/current/sql/data_types/numeric).

Execuția embedded nu reprezintă izolare: DuckDB operează cu privilegiile procesului, iar accesul la fișiere/rețea depinde de capabilitățile activate. Conectorii, extensiile, codul editabil, worker-ul și admiterea Run necesită proiectare separată; bibliotecile nu furnizează automat controalele SIREN. [Modelul de securitate DuckDB](https://duckdb.org/security). Licența fiecărui proiect trebuie completată cu inventarul exact al binarelor/dependențelor și notificărilor pachetului ales; nu se pretinde aici calificare juridică sau de distribuție.

Integrarea SIREN trebuie să prevadă preview limitat, operații în fundal, resurse și rezultate versionate, jurnal, anulare, recuperare și cote pentru discul temporar. Alegerea C/D și curățarea fișierelor temporare trebuie explicate utilizatorului și verificate în design; nu se șterg fișierele unui job activ. Acestea sunt cerințe propuse pentru design, fără implementare în acest research.

## Fixture de benchmark propus

1. Date sintetice deterministe, seed fix: 1M/10M/100M/200M rânduri, variante înguste/late, texte scurte/lungi, NULL, chei uniforme și skew. Parquet cu compresie/row groups fixate și manifest SHA256.
2. Scan/filter/group; join 1:1, N:1 și M:N cu cardinalitate calculabilă; pivot cu 12/100/1.000/10.000 categorii; sort/window; cazuri financiare cu rotunjire, overflow și tipuri explicite.
3. Oracole independente: formule exacte pentru counts/sume și cazuri mici Python `Decimal`. Comparație canonică; fără toleranțe adăugate pentru a ascunde diferențe.
4. Versiuni și hardware fixate; măsurate timp, peak RSS, spill, bytes ale rezultatului, anulare și cleanup. Trei repetări warm; cache rece declarat numai dacă starea cache-ului este demonstrată.
5. RAM insuficient, disc temporar plin și rezultate explozive, în probe controlate. Fiecare capacitate publicată se leagă de workload, resurse, versiune și verdict real.

Niciuna dintre aceste probe nu a fost executată. Alegerea motorului și integrarea cu flow-ul vizual, Code, Run, Lock și recovery rămân etape de design și calificare separate.
