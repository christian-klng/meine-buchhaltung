# Kritische Prüfung — Beleg-Prüf-App Blueprint

*Review des Plans `Beleg-App-Plan.md` gegen das reale Setup (beleg-pruefung-Skill, Reverse-Charge-Liste, bestehende Repos). Stand: 2026-07-09.*
*Methode: 5 Prüf-Dimensionen, 62 Befunde, jeder Befund adversarisch gegengeprüft — 54 bestätigt, 8 widerlegt/entschärft.*

---

## Gesamturteil

Der Plan ist **solide, ehrlich und gut strukturiert**. Die Philosophie (Determinismus + Mensch-im-Loop statt LLM, Cent-Arithmetik mit Summen-Invariante, Read-back-Verifikation, Adapter-Layer für Bankformate, GoBD-Bewusstsein, „parallel statt Ersatz") ist genau richtig und spiegelt die Disziplin deines heutigen Skills wider.

**Aber:** Vor dem Scaffolding sollten drei Dinge korrigiert werden, weil sie sonst still Falschdaten produzieren:

1. **§13b Reverse-Charge wird wegdefiniert** — der einzige *steuerlich* gefährliche Fehler.
2. **Zwei falsche/unvollständige Seed-Regeln** (MILES, OpenAI) — würden systematisch falsch buchen.
3. **Datenmodell-Lücken** bei Fremdwährung-Timing, Gutschriften und dem „lernenden" Regelwerk.

Der Host (**Coolify vs. Railway**) ist zu entscheiden. Framework/ORM sind — anders als der Plan selbst begründet — kein Problem (s. u.).

---

## Was der Plan richtig macht (nicht anfassen)

- **Cent-Integer + Summen-Invariante + Read-back** — deckt sich 1:1 mit dem Skill; das ist der Kern deiner Verifikationsdisziplin, korrekt übernommen.
- **Adapter-Layer** für camt/CSV/MT940 → eine normalisierte `BankTransaction`. Saubere Erweiterbarkeit.
- **`originalAmount` + `currency` + `remark`** für Fremdwährung — passt zum Skill (Originalbetrag im remark).
- **`ReconciliationLink` + `AuditLog`** sind bereits vorhanden (die FX-Traceability ist damit weitgehend abgedeckt — der entsprechende Einwand wurde entschärft).
- **Abschnitt 2 & 3** (ehrliche Grenzen, Lexware behält GoBD/DATEV/ELSTER) — reife, korrekte Erwartungssteuerung.

---

## Korrekturen an zwei naheliegenden (aber falschen) Kritikpunkten

Damit das Review ehrlich bleibt — zwei Einwände, die sich bei genauer Prüfung **nicht** halten:

- **„Passt zu deinem Bestand" stimmt für den App-Stack.** `certify_bird` läuft auf **Next.js 16 + Prisma 7 + shadcn + pdfjs-dist + next-auth 5** (exakt der empfohlene Stack), `sprachmodelle-verstehen` nutzt **`unpdf`**, `financial-planning` Next.js 16. Next.js/Prisma/shadcn/PDF-Parsing sind in deinen Repos erprobt. Der Framework-/ORM-Einwand entfällt. Einzig **Coolify** ist neu (s. Befund A6).
- **Textlayer-Extraktion ≠ Lexware-OCR.** Die im Skill dokumentierten Fehler (falsche Namen, „BELEG - 1" → „1") sind Artefakte von Lexwares **Server-OCR**, weil das v2-MCP kein Binär liefert und der Skill deshalb auf Vision ausweicht. Die neue App hat das **echte PDF** und liest den eingebetteten Text wörtlich — diese Fehlerklasse entsteht dort gar nicht. Der Plan darf hier optimistisch sein (Rest-Vorbehalt: reine Bild-PDFs und die Betrags-Heuristik, s. Befund D2).

---

## Kritische Befunde nach Priorität

### A — Vor dem Scaffolding beheben

**A1 — „Keine USt-Logik nötig" ist falsch: §13b Reverse-Charge trifft auch Kleinunternehmer.** *(§1 Z.15, §3 Z.57, §5 Z.87)*
Du führst real eine `Reverse-Charge-Q2-2026.xlsx` (Cortecs/AT 62,50; Google Cloud EMEA/IE 24,30; Unipile/FR 48,18). §19 befreit **nicht** von der als Leistungsempfänger geschuldeten Steuer (§13b Abs. 8 UStG) — das ist echter Zahlungsabfluss **und** Meldepflicht. Der Plan setzt alles pauschal auf `vatfree`, hat kein Land-Feld, kein RC-Flag, und nennt ELSTER „für §19 irrelevant". Eine App, die Lexware ablösen soll, würde diese Funktion still verlieren.
→ **Fix:** `Contact.countryCode` + `Voucher.reverseCharge` (bzw. Flag an der VendorRule), RC-Bemessungsgrundlage in EUR (= abgebuchter Bankbetrag), Leistungszeitraum. Reverse-Charge-Belege in eine Q-Auswertung (analog xlsx) aggregieren. Die *Erfassung* der Daten ist Pflicht ab MVP; der *Report* darf eine spätere Iteration sein. §1 umformulieren: „vatfree im Inland, §13b für EU-/Auslandsleistungen".

**A2 — Seed-Regel MILES = „Fremdfahrzeuge" ist falsch.** *(§1 Z.17, §7 Z.139)*
Der Skill kontiert MILES-Carsharing ausdrücklich als **„Bahn-/Flugticket, Mietwagen"** (Kategorie-ID `f9f05690-…`), **nicht** Fremdfahrzeuge. Als Seed übernommen würde jede MILES-Fahrt systematisch falsch verbucht — und die „lernende" Engine zementiert den Fehler.
→ **Fix:** MILES → „Bahn-/Flugticket, Mietwagen". Seed nicht aus den Prosa-Beispielen, sondern 1:1 aus der Skill-Tabelle ziehen.

**A3 — USD-Liste lässt OpenAI weg.** *(§1 Z.17, §7 Z.141)*
Der Skill führt OpenAI explizit als USD-Lieferant; der Plan nicht. Folge: OpenAI-Beleg wird mit dem USD-Wert 1:1 als EUR durchgewunken (die dokumentierte Standard-Fehlerquelle) → falscher Betrag und falsche RC-Basis.
→ **Fix:** OpenAI aufnehmen; USD-Liste 1:1 mit dem Skill abgleichen (auch Schreibweisen wie „Features & Labels"/Fal).

**A4 — USD→EUR „automatisch beim Match" ignoriert Henne-Ei-Problem und fehlenden Pending-Zustand.** *(§2 Z.32, §6 Z.111/113, §5 Z.87)*
Der Plan matcht Beleg↔Buchung u. a. über den **Betrag** — aber genau bei USD-Belegen ist der Betrag zum Match-Zeitpunkt falsch/unbekannt (1:1-USD), und der Auszug kommt später. Betragsbasiertes Matching versagt also ausgerechnet dort, wo die Korrektur gebraucht wird. Der Status-Enum (`draft|unchecked|checked`) hat keinen Warte-Zustand. Der Skill behandelt das bewusst als **Hard Stop**.
→ **Fix:** Status `awaiting_fx` / Flag `amountPendingBankMatch`; FX-Belege vom betrags-basierten Matching ausnehmen und stattdessen über Gegenpartei+Datum matchen; Freigabe/Export bis zum bestätigten EUR-Betrag blockieren; Originalbetrag in `remark`.

**A5 — „Lernende VendorRule (letzte Korrektur gewinnt)" überschreibt kuratierte Regeln.** *(§5 Z.93, §6 Z.124, §7 Z.144)*
Eine Regel pro Anbieter, bei jeder Bestätigung fortgeschrieben: Ein einmaliger 100%-betrieblicher Telekom-Hardwarekauf löscht den 70/30-Split; ein versehentlich als EUR bestätigter USD-Beleg entfernt das Währungsflag (und damit den Hard Stop).
→ **Fix:** Kuratierte Seed-Regeln als **gelockt** markieren; Regeltyp trennen (Kategorie ≠ Split ≠ Währung) und nur den zutreffenden Teil lernen; Historie/Versionierung statt Destructive-Update; Split-/Währungsregeln nie aus einer Einzelkorrektur ableiten.

**A6 — Host: Coolify empfohlen, real läuft alles auf Railway.** *(§4, §9)*
Die `ausgaben-app` ist auf **Railway** deployt; du hast `use-railway`-Skill + Railway-MCP, aber **kein** Coolify-Tooling. Coolify wird nirgends gegen Railway begründet und bringt gerade die GoBD-relevanten Bausteine (managed DB-Backups, Object-Storage) nicht ohne Mehraufwand mit.
→ **Fix:** Auf Railway deployen (Dockerfile-Muster der `ausgaben-app`, persistentes Volume via `create_volume`, Bucket/Object-Storage für Original-Ablage) — oder Coolify mit einem konkreten Grund begründen. §4 nennt als Beleg für den Stack ausgerechnet „TypeScript/Lexware-MCP" statt der tatsächlich passenden Next.js-Repos.

### B — Datenmodell & Loop (vor dem Feature-Bau)

**B1 — `Voucher.type` hart auf `purchaseinvoice`.** *(§5 Z.87)* Der Skill verarbeitet vier Typen. Mindestens **`purchasecreditnote`** (SaaS-Refunds/Storni) fehlt → mindert Ausgaben; ohne sie überzeichnet die spätere EÜR (Iter. 3) die Betriebsausgaben. Gutschrift = umgekehrtes Vorzeichen + Eingang statt Abbuchung im Bankabgleich. *(Sales-Seite ist per §3 Z.58 bewusst out of scope — ok.)*
→ **Fix:** `type` als Enum inkl. `purchasecreditnote`; Vorzeichen-/Richtungslogik im Abgleich und in der EÜR.

**B2 — Duplikat-Erkennung bankabhängig statt beleg-intrinsisch.** *(§6 Z.116)* Plan: „Anbieter + Betrag + nahes Datum + nur eine Abbuchung" → greift erst nach Bankimport **und** erzeugt Fehlalarme bei legitim gleichhohen Monatsabos (St. Oberholz, SaaS). Skill: gleiche **`voucherNumber` + `totalGrossAmount`** (funktioniert beim Upload).
→ **Fix:** Primärkriterium `voucherNumber` + Bruttobetrag (+ Datei-Hash); „nur eine Abbuchung" nur als Zusatzbestätigung bei Fremdwährung.

**B3 — `paidPrivately`-Flag in §8 versprochen, im Modell (§5) nicht vorhanden.** Sonst landet jeder privat bezahlte Beleg dauerhaft in „Beleg ohne Buchung" und verstopft das Dashboard.
→ **Fix:** `Voucher.paidPrivately` (bzw. `paymentSource: bank|private`); solche Belege aus der „fehlender Match"-Liste ausnehmen.

**B4 — Generischer Extraktor „größter Betrag nahe Gesamt/Total".** *(§2 Z.42, §6 Z.106)* Bricht bei Netto/USt/Brutto-Zeilen, Fremdwährungszeilen (der größte Betrag ist der USD-Wert — genau der falsche) und Gutschriften (negativ). „Erstes Datum" verwechselt Leistungs-/Rechnungs-/Fälligkeitsdatum.
→ **Fix:** **Währungserkennung vor** der Betragswahl (≠ EUR → nicht als `amount`, sondern FX-Pending); Datum über Label („Rechnungsdatum") statt „erstes Datum"; Gutschriften-Vorzeichen gesondert.

### C — Seed-Vollständigkeit (billig, hoher Nutzen)

- **C1 — UMA Hub GmbH** (Coworking → Miete/Pacht) fehlt komplett. *(Skill-Tabelle)*
- **C2 — Maingau-Split** ohne Quote genannt → **70 % Festnetz / 30 % Privatentnahmen** festschreiben; kanonische Formel `business = round(cents*0.7); privat = brutto − business`.
- **C3 — Amazon → Bürobedarf** ist **nicht** aus dem autoritativen Skill, sondern erfunden; Amazon-Belege sind heterogen. Die Kategorie „Bürobedarf" fehlt in der ID-Tabelle. → Nicht als Festregel seeden (höchstens schwacher Vorschlag mit Pflicht-Review); Kategorie-ID erst per `GET /v1/posting-categories` verifizieren.
- **C4 — Restliche bekannte Regeln** aus der Skill-Tabelle mitnehmen (IONOS/United-Domains/Alfahosting/Lunaweb → Internet; AI Builders → Seminar/Weiterbildung; DB → Bahn/Flug).
- **C5 — St. Oberholz „18,00 €":** Der Betrag steht nur in der Prosa; das VendorRule-Schema führt korrekt **kein** Betragsfeld (Betrag kommt aus dem Beleg). *Also kein struktureller Bug* — nur die Prosa ist irreführend (real 18 **und** 25 €). Betrag nie als Regel setzen; optional 18/25 als Plausibilitäts-Warnung.

### D — Realismus & Betrieb (bewusst einplanen, nicht blockierend)

- **D1 — „Verlängertes Wochenende" ist zu optimistisch.** Der MVP umfasst Upload+Hash, generische + Pro-Anbieter-Parser, Lern-Engine, Split-Logik, Split-View-UI + Editor + Massenfreigabe + Dashboard, camt+CSV-Adapter, Matching/Duplikate/fehlende Belege, Auto-Verifikation, Postgres, Auth, Volume, Backups, Audit-Log. → Realistisch mehrere Wochenenden; MVP enger schneiden (Prüf-UI + manuelle Erfassung + Bankabgleich für 2–3 Anbieter zuerst, Extraktion inkrementell).
- **D2 — Vision-Fallback früher als Iteration 2.** Reine Bild-PDFs und unsichere Felder (Name/Belegnummer) brauchen einen Confidence-Schwellwert → „bitte bestätigen". Nicht die ganze Vision-Fähigkeit in Iter. 2 schieben; im Kern-Loop einen Low-Confidence-Pfad vorsehen.
- **D3 — camt.052 (Intraday) vs. camt.053 (Tagesauszug).** Für revisionsfähigen Abgleich und FX-Korrektur (braucht den *gebuchten* EUR-Betrag) ist 053 die richtige Quelle. → Prüfen, ob Holvi 053 exportiert; sonst 052-Beträge als vorläufig kennzeichnen.
- **D4 — Auth über „simple Credentials" hinaus.** Öffentlich erreichbare Finanzdaten: Passwort mit **argon2id/bcrypt** hashen, Rate-Limiting/Lockout, Session-Cookies `httpOnly+secure+SameSite=strict`; für Ein-Nutzer-App IP-Allowlist / Railway Private Networking erwägen.
- **D5 — Datei-Upload & PDF-Parsing als Angriffsfläche.** Ablage unter UUID/Hash statt Client-Dateiname (Pfad-Traversal), Typ per Magic Bytes; `pdfjs` mit `isEvalSupported:false`, gepinnte Version, Parsing mit Timeout/Speicherlimit (vgl. CVE-2024-4367).
- **D6 — GoBD-Details, sobald die App führend wird** (nicht im Parallelbetrieb): getestete Restores + Off-site + Immutable/WORM (nicht nur „Backup aktivieren"); **Audit-Log append-only** (nur INSERT-Recht, Hash-Chaining) statt normaler Tabelle; Verfahrensdokumentation. *(Verschiebung auf Iter. 5 ist ok, solange Lexware das führende System bleibt.)*

---

## Konkrete Änderungsliste für den Plan

- [ ] §1/§3: „keine USt-Logik nötig" streichen → §13b-Reverse-Charge als eigenen Fall benennen.
- [ ] §5: `Contact.countryCode`, `Voucher.reverseCharge` + RC-Bemessungsgrundlage, `Voucher.type` als Enum (inkl. `purchasecreditnote`), `Voucher.paidPrivately`, Status `awaiting_fx`.
- [ ] §5/§7: VendorRule um Regeltyp + Lock-Flag (Seed geschützt) + Historie erweitern.
- [ ] §7: MILES → Mietwagen korrigieren; OpenAI in USD-Liste; UMA Hub ergänzen; Maingau 70/30 Festnetz/Privat; Amazon-Regel entschärfen; St.-Oberholz-Betrag aus der Prosa nehmen.
- [ ] §6: Duplikat-Kriterium auf `voucherNumber`+Betrag; Währungserkennung vor Betragswahl; FX-Match über Gegenpartei+Datum.
- [ ] §4/§9: Host-Entscheidung Railway vs. Coolify explizit treffen und begründen.
- [ ] §9: Auth-Härtung, Upload-Härtung, pdfjs-Härtung, Backup-/Restore-/Immutable-Konzept konkretisieren.
- [ ] §10: Zeitschätzung realistisch; Low-Confidence-/Vision-Pfad in den MVP-Loop.
