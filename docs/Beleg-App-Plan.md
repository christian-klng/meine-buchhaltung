# Beleg-Prüf-App — Planungs-Blueprint

*Prototyp zur schrittweisen, nahezu kostenlosen Ablösung der Lexware-Buchhaltung. Deploybar auf Coolify. Stand: 2026-07-09 (Rev. 2 — § 13b Reverse-Charge, Lieferanten-Matrix, Fremdwährungs-Wartestatus ergänzt).*

---

## 1. Ziel und bewusste Abgrenzung

Wir bauen eine selbst gehostete App, die den heutigen „Belege prüfen"-Ablauf abbildet — aber ohne Lexware als Datenquelle und ohne Claude Code / LLM im laufenden Betrieb. Belege werden direkt in die App hochgeladen, programmatisch ausgewertet und in einer **Prüf-UI** vom Menschen bestätigt. Der Kontoauszug-Abgleich (heute Holvi camt.052) wandert als eigenes Feature in die App.

Der Prototyp bleibt bewusst schlank: **nur der Kern-Loop** (Upload → Extraktion → Prüf-UI → Bankabgleich). Reporting/Export, DATEV, Lexware-Migration und OCR/Vision kommen erst in späteren Iterationen. Das Ziel dieses Prototyps ist nicht, Lexware zu ersetzen, sondern **empirisch herauszufinden, welche Lexware-Funktionen du mit eigener Software realistisch und günstig nachbauen kannst** — und wo Lexware seinen Preis wert bleibt.

Rahmenbedingungen aus deinem bestehenden Setup, die die App übernimmt:

- **Kleinunternehmer § 19 UStG (Inland):** Inländische Eingangsbelege werden brutto gebucht — `vatfree`, `taxRatePercent: 0`, kein Vorsteuerabzug.
- **ABER § 13b Reverse-Charge (EU-/Auslandsleistungen):** Die Kleinunternehmerregelung befreit **nicht** von der Reverse-Charge-Steuerschuld als Leistungsempfänger (§ 13b Abs. 8 UStG). Bei sonstigen Leistungen von EU-/Auslandsunternehmern (z. B. Cortecs/AT, Google Cloud EMEA/IE, Unipile/FR sowie die US-SaaS-Anbieter) schuldest du die deutsche USt selbst, kannst sie mangels Vorsteuerabzug **nicht** gegenrechnen (echter Zahlungsabfluss) und musst sie melden. Die App muss diese Fälle erkennen, die Bemessungsgrundlage (tatsächlich abgebuchter EUR-Betrag) erfassen und in einer § 13b-Auswertung ausgeben (Datenmodell → Abschnitt 5, Matrix → Abschnitt 7). *(Die konkrete § 13b-Pflicht je Lieferant bestätigt der Steuerberater — die App erfasst und rechnet, entscheidet aber nicht.)*
- **Belegtyp:** Eingangsrechnungen / Ausgabenbelege (`purchaseinvoice`), Status „ungeprüft" → „geprüft".
- **Wiederkehrende Muster** stehen in der **Lieferanten-Matrix** (Abschnitt 7): pro Lieferant Kategorie, Split-Logik, Währung und § 13b-Kennzeichen — von dir gepflegt, von der App vorbelegt.
- **Verifikationsdisziplin:** Read-back / Soll-Ist-Vergleich in Cent, Summen-Invariante bei Splits — dieses Prinzip bauen wir als automatische Prüfung ein.

---

## 2. Kritische Einschätzung: Was heute (Vibe Coding) programmatisch geht — und was nicht

Du hast um Ehrlichkeit gebeten. Hier die realistische Trennung.

### Geht heute gut, rein programmatisch, ohne LLM

Das ist mehr, als viele denken — modernes Tooling macht diesen Teil an einem verlängerten Wochenende machbar:

- **Digitale PDF-Rechnungen mit Textlayer** (fast alle SaaS-Rechnungen: Anthropic, IONOS, Telekom, GoDaddy, Amazon-Belege, Hetzner …). Text lässt sich verlustfrei extrahieren; Betrag, Datum, Rechnungsnummer, Währung holt man mit Regex + pro-Anbieter-Parsern zuverlässig heraus.
- **Der gesamte Bankabgleich.** Kontoauszug parsen, Buchungen normalisieren, Beleg↔Buchung über Betrag + Datumsfenster + Gegenpartei-Fuzzy-Match zuordnen, Duplikate erkennen (mehrere Belege / eine Abbuchung), fehlende Belege und belegllose Zahlungen auflisten. Reine, deterministische Datenverarbeitung.
- **USD→EUR-Korrektur** über den tatsächlich abgebuchten Bankbetrag — genau wie du es heute manuell im Protokoll machst, nur automatisch, sobald das Match steht.
- **Split-Logik** (70/30 etc.) in Cent mit Summen-Invariante — trivial und exakt.
- **Die komplette Prüf-UI:** Liste offener Belege, Original-PDF neben editierbaren Feldern, Kategorie-/Kontakt-Vorschlag, Bestätigen/Massenfreigabe, Statusverfolgung. Das ist Standard-Webentwicklung.
- **Wiederkehrende Regeln** (St. Oberholz → 18 € Miete): eine Regel-Engine, die sich merkt, was du einmal entschieden hast.

### Geht nur eingeschränkt oder gar nicht ohne OCR/Vision/LLM

Hier muss man ehrlich sein, sonst enttäuscht der Prototyp:

- **Fotos und Scans von Papierbelegen** (Kassenbons, Quittungen) haben *keinen* Textlayer. Ohne OCR (Tesseract) oder Vision-KI bekommst du daraus programmatisch nichts. Der Prototyp behandelt solche Uploads als „manuell zu erfassen" — die Prüf-UI zeigt das Bild, du tippst Betrag/Datum ein. Das ist bewusst der spätere Vision-Einbau.
- **Jedes neue, unbekannte Anbieter-Layout** braucht anfangs entweder einen kleinen Parser oder fällt auf manuelle Eingabe zurück. Es gibt keinen „universellen Rechnungsparser" ohne KI. Der generische Extraktor (größter Betrag nahe „Gesamt/Total", erstes Datum, IBAN → Anbieter) trifft oft, aber nicht immer.
- **Semantische Kategorisierung eines echt neuen Ausgabentyps** — die Frage „ist das Bürobedarf oder Sonstige Ausgaben?" — ist genau die Urteilskraft, die heute Claude im Prüflauf liefert. Programmatisch ersetzt du das durch: bekannte Anbieter → feste Kategorie, plus **lernende Zuordnung** (deine einmalige Korrektur wird gespeichert und beim nächsten Mal vorgeschlagen). Für den allerersten Beleg eines neuen Anbieters bleibt es aber deine Entscheidung. Das ist kein Bug, sondern der bewusste Trade-off: **Determinismus + Mensch-im-Loop statt KI-Intelligenz.**

### Ehrliche Gesamtaussage

Vibe Coding bringt dich beim **Kern-Loop für digitale PDFs + Bankabgleich** heute erstaunlich weit — das ist ein realistisches, nützliches Werkzeug, kein Spielzeug. Was du aufgibst, ist die „versteht alles sofort"-Magie: Die App ist am Anfang nur so schlau wie ihre Regeln, und sie wird bei Papierbelegen und exotischen Layouts nach dir verlangen. Der clevere Weg ist, die Prüf-UI so schnell bedienbar zu machen, dass deine 5-Sekunden-Korrektur akzeptabel ist — und die App aus jeder Korrektur lernt. Vision AI später eingebaut schließt dann die Papierbeleg-Lücke.

---

## 3. Was Lexware kann, das diese App (noch) nicht kann

Damit die Erwartung stimmt — und damit du bewusst entscheidest, was du wirklich selbst ersetzt:

- **GoBD-Konformität & Aufbewahrung.** Lexware garantiert unveränderbare, revisionssichere Archivierung deiner Originalbelege über 10 Jahre. Eine Eigenbau-App *muss das ebenfalls leisten*, wenn sie Lexware als führendes System ablöst: Originaldatei nie verändern, Änderungen protokollieren (Audit-Trail), Backups. Das ist der wichtigste Compliance-Punkt — kein reines „Feature", sondern rechtliche Pflicht. Solange die App nur *parallel* zu Lexware/Steuerberater läuft, ist das Risiko gering; als *Ersatz* muss dieser Punkt sauber gelöst sein.
- **DATEV-/Steuerberater-Export.** Später als Feature machbar, im MVP nicht drin.
- **ELSTER / USt-Voranmeldung.** Nicht ganz irrelevant: Die § 13b-Reverse-Charge-Beträge (Abschnitt 1) sind über die USt-Voranmeldung/Jahreserklärung zu melden. Die App liefert dafür die Auswertung (Abschnitt 7); die eigentliche ELSTER-Übermittlung bleibt vorerst außerhalb (Lexware/Steuerberater). Sobald du die Kleinunternehmer-Grenze überschreitest, wird ELSTER vollumfänglich zum Lexware-Vorteil.
- **Offizielle Ausgangsrechnungen** (Rechnungsstellung an Kunden, Nummernkreise, E-Rechnung/ZUGFeRD). Nicht Teil dieses Prototyps.
- **Automatische Belegerkennung (OCR) als Service** — Lexware macht das serverseitig; wir bräuchten Tesseract/Vision.
- **Live-Bankanbindung (FinTS/HBCI).** Wir arbeiten mit Datei-Import (Export aus dem Banking-Portal), nicht mit Live-Sync.

Fazit für die Ablöse-Frage: Buchhaltungs-*Vorerfassung* (Belege sichten, zuordnen, mit Bank abgleichen) kannst du sehr gut selbst und günstig nachbauen. Die *rechtlich-regulatorische* Hülle (GoBD, DATEV, ELSTER, E-Rechnung) ist der Teil, für den Lexware sein Geld nimmt — den würde ich zuletzt und nur mit Bedacht ablösen.

---

## 4. Tech-Stack (Empfehlung, da „du entscheidest")

**Next.js 15 (App Router, TypeScript) als Full-Stack-App, PostgreSQL via Prisma, Tailwind + shadcn/ui, ein Container auf Coolify.**

Begründung:

- **Ein Deploy-Artefakt.** UI, API-Routen und DB-Zugriff in einer Codebase, ein Container. Coolify deployt das direkt aus dem Git-Repo (Nixpacks oder Dockerfile mit `output: 'standalone'`). Minimaler Betriebsaufwand.
- **Passt zu deinem Bestand.** Dein Lexware-MCP ist bereits TypeScript — gleiche Sprache, gleiche Denkweise, du (und ich beim Vibe Coding) bleibst im selben Ökosystem.
- **Bestes Vibe-Coding-Ökosystem.** Riesige Bibliotheks- und Beispielbasis; PDF-Parsing (`unpdf`/`pdfjs-dist`), CAMT/MT940/CSV-Parser, Fuzzy-Matching, alles als npm-Pakete vorhanden. shadcn/ui gibt dir schnell eine saubere Prüf-UI.
- **Wachstumspfad.** OCR (Tesseract.js oder ein kleiner Python-Sidecar) und später ein Vision-/LLM-Extraktionsschritt lassen sich als zusätzliche Route/Service andocken, ohne den Kern umzubauen.

Warum *nicht* Python/FastAPI + React (die zweite Option): Python ist bei Datenverarbeitung minimal stärker (pdfplumber, pandas), aber das kostet dich einen zweiten Service, zweites Deployment und einen Sprachbruch zum bestehenden MCP. Für einen Ein-Personen-Prototyp überwiegt die Einfachheit von „alles in einem". Falls die PDF-Extraktion später wirklich schwierig wird, holen wir sie gezielt in einen kleinen Python-Microservice — aber nicht auf Verdacht.

---

## 5. Datenmodell

Eigene Entitäten, die die Lexware-Konzepte nachbilden, damit du unabhängig bist (IDs aus deinen Protokollen lassen sich später als optionale `lexwareId` mitführen für eine spätere Sync/Migration):

- **Contact** (Lieferant): `name`, `address?`, `countryCode` (Sitz des Leistenden — DE / EU / Drittland, für § 13b), `role = vendor`, `lexwareId?`, Erkennungsmuster (`matchDomains[]`, `matchIban[]`, `matchStrings[]`).
- **Category** (Buchungskategorie): `name`, `lexwareCategoryId?`. Seed aus deinen bekannten IDs: Miete/Pacht, Festnetz, Mobil, Internet, Privatentnahmen, Bahn/Flug, Fremdfahrzeuge, Seminar/Weiterbildung, Bürobedarf, Sonstige Ausgaben.
- **Voucher** (Beleg): `date`, `contactId?`, `voucherNumber?`, `currency`, `originalAmount?` (z. B. USD), `amount` (EUR, brutto), `status` (`draft` | `unchecked` | `awaiting_fx` | `checked`), `type = purchaseinvoice`, `remark?`, `taxType` (`vatfree` inländisch **oder** `reverse_charge`), `reverseCharge` (bool, § 13b), `reverseChargeBaseEur?` (Bemessungsgrundlage = tatsächlich abgebuchter EUR-Betrag), `reverseChargeVatEur?` (geschuldete USt, i. d. R. 19 %), `paidPrivately` (bool — privat bezahlt, kein Bank-Match nötig), plus Verweis auf Datei(en). **`awaiting_fx`** = Fremdwährungsbeleg, dessen echter EUR-Betrag noch auf die Bankabbuchung wartet (Abschnitt 6).
- **VoucherItem** (Position): `categoryId`, `amount`, `taxRatePercent = 0`, `taxAmount = 0`. Mehrere Items = Split.
- **VoucherFile**: Originaldatei (Pfad/Hash), `mimeType`, `extractedText?`. **Original wird nie verändert** (GoBD-Prinzip).
- **BankTransaction**: `date`, `amount`, `currency`, `counterparty?`, `purpose?`, `rawRef`, `sourceStatementId`.
- **BankStatement**: importierte Auszugsdatei, Format, Zeitraum, Konto.
- **ReconciliationLink**: `voucherId` ↔ `bankTransactionId`, `status` (`matched` | `suggested` | `manual`), `confidence`.
- **VendorRule / Lieferanten-Profil** (die von dir gepflegte Matrix, Abschnitt 7): pro Lieferant → `defaultCategoryId`, `splitRule` (`none` | z. B. `70/30` mit Ziel-Kategorien Betrieb/Privat), `currency` (EUR/USD/…, steuert den Fremdwährungs-Hard-Stop), `reverseCharge` (`ja` | `nein` | `prüfen` — StB-bestätigtes § 13b-Flag; nur `ja` zählt in die Auswertung), `reverseChargeVatRate` (USt-Satz, Default 19 %), `countryCode`, `locked` (kuratierte Seed-Regel — wird **nicht** durch beiläufiges Auto-Lernen überschrieben). Neue/ungelockte Regeln lernt die App aus deinen Bestätigungen dazu.
- **AuditLog**: jede schreibende Änderung (wer/was/wann, alt→neu) — für Revisionssicherheit.

---

## 6. Der Kern-Loop

### Schritt 1 — Upload
PDF oder Bild hochladen → Datei speichern (Hash bilden, Duplikat-Upload erkennen), `Voucher` im Status `draft` anlegen, Extraktion anstoßen.

### Schritt 2 — Programmatische Extraktion (ohne LLM)
1. **Textlayer prüfen.** PDF mit Text → `unpdf`/`pdfjs` extrahiert den Text. Bild oder textloses PDF → Status „manuell erfassen" (später OCR/Vision).
2. **Anbieter erkennen** über `VendorRule.matchStrings/matchDomains/matchIban` im Text.
3. **Felder extrahieren:** Betrag (Muster nahe „Gesamt/Total/Betrag"), Datum, Rechnungsnummer, Währung — generischer Extraktor plus optional anbieter-spezifischer Parser für die häufigen Fälle.
4. **Lieferanten-Matrix anwenden:** Standard-Kategorie setzen, ggf. Split erzeugen (Telekom 70/30 …), Währung prüfen (≠ EUR → Fremdwährungsbeleg), § 13b-Kennzeichen übernehmen (`reverseCharge`, `countryCode`).
5. Ergebnis als Vorschlag am Beleg speichern. Status: `unchecked` — **oder `awaiting_fx`**, wenn Währung ≠ EUR (der echte EUR-Betrag steht erst nach dem Bankabgleich fest).

### Schritt 3 — Bankabgleich
Auszug importieren (siehe unten) → `BankTransaction`s. Dann Matching: Beleg↔Buchung über **Betrag (in Cent) + Datumsfenster (± n Tage) + Gegenpartei-Ähnlichkeit**. **Ausnahme Fremdwährung (`awaiting_fx`):** Hier ist der Belegbetrag noch der falsche 1:1-Wert, deshalb wird **ohne Betrag** nur über **Gegenpartei + Datumsfenster** gematcht. Ergebnisse:

- **Match gefunden:** verknüpfen. Bei Fremdwährungsbelegen (`awaiting_fx`) den EUR-Abbuchungsbetrag als `amount` übernehmen, den Beleg von `awaiting_fx` auf `unchecked` heben und dir zur Bestätigung vorlegen (Hard Stop wie heute — kein stilles Überschreiben). Ist der Lieferant § 13b-relevant, wird jetzt `reverseChargeBaseEur` = dieser EUR-Betrag und `reverseChargeVatEur` daraus berechnet.
- **Beleg ohne Buchung:** evtl. Duplikat oder über privates Konto bezahlt → in der UI markiert.
- **Buchung ohne Beleg:** fehlender Beleg → Liste „bitte nachreichen" (genau wie dein Nachtrag vom 07.07.).
- **Duplikat-Erkennung:** gleicher Anbieter + Betrag + naheliegendes Datum, aber nur eine Abbuchung → als Duplikat vorschlagen.

### Schritt 4 — Prüf-UI
Kern des Ganzen. Screens:

- **Beleg-Liste** mit Filtern (Status, „braucht Aufmerksamkeit", ohne Kategorie, ohne Match, „wartet auf EUR-Betrag" = `awaiting_fx`).
- **Prüf-Ansicht (split view):** links Original-PDF/Bild, rechts editierbare Felder (Anbieter, Datum, Nummer, Betrag/Währung), Kategorie-/Split-Vorschlag, Bank-Match mit Status. Alles überschreibbar — **der Mensch ist die Prüfung.**
- **Split-Editor** mit Live-Summen-Invariante (Cent-genau, Rest kann nicht ≠ Brutto sein).
- **Bestätigen** (einzeln + Massenfreigabe) → Status `checked`, Eintrag ins `AuditLog`; jede von dir bestätigte Zuordnung aktualisiert die `VendorRule` (Lernen).
- **Abgleich-Dashboard:** offene Belege, ungematchte Buchungen, Duplikate, fehlende Belege, Fremdwährungsbelege im Wartestatus.
- **Lieferanten-Matrix (Abschnitt 7):** editierbare Tabelle Lieferant → Kategorie, Split-Logik, Währung, § 13b — hier pflegst du die Regeln; gelockte Seed-Regeln sind als solche markiert.
- **§ 13b-Auswertung:** quartalsweise Liste der Reverse-Charge-Belege (Lieferant, Land, Bemessungsgrundlage EUR, geschuldete USt) — analog deiner heutigen `Reverse-Charge-Qx.xlsx`.

### Schritt 5 — Automatische Verifikation
Dein „Read-back"-Prinzip als Code: nach jeder Bestätigung Soll-Ist-Prüfung in Cent, Summen-Invariante der Splits, Pflichtfelder gesetzt. Zusätzlich: kein Beleg darf `checked` werden, solange er `awaiting_fx` ist (unbestätigter Fremdwährungsbetrag); bei `reverseCharge = true` müssen `reverseChargeBaseEur` und `reverseChargeVatEur` gesetzt sein. Rote Markierung statt stillem Durchwinken.

---

## 7. Die Lieferanten-Matrix (das „programmatische Gehirn")

Statt eines LLM steckt die Intelligenz in einer **von dir gepflegten, deklarativen Matrix**: pro Lieferant genau eine Zeile mit der Buchungslogik. Diese Zuordnungen ändern sich selten — deshalb lohnt es sich, sie einmal festzulegen und die App sie automatisch vorbelegen zu lassen. Jede Zeile trägt: **Kategorie**, **Split-Logik** (Split ja/nein + Formel), **Währung** (steuert den Fremdwährungs-Hard-Stop) und **§ 13b-Kennzeichen** (Reverse-Charge + Land). Editierbar in einem eigenen UI-Screen.

**Seed aus deinen Protokollen (bekannte Lieferanten — `locked`, nicht durch Auto-Lernen überschreibbar):**

| Lieferant | Land | Kategorie / Behandlung | Split | Währung | § 13b-pflichtig | § 13b-Satz |
|---|---|---|---|---|---|---|
| St. Oberholz Coffee GmbH | DE | Miete/Pacht (100 % betrieblich) | – | EUR | Nein | – |
| UMA Hub GmbH | DE | Miete/Pacht (100 % betrieblich) | – | EUR | Nein | – |
| Telekom Deutschland GmbH | DE | 70 % Mobil / 30 % Privatentnahmen | 70/30 | EUR | Nein | – |
| Maingau Energie GmbH | DE | 70 % Festnetz / 30 % Privatentnahmen | 70/30 | EUR | Nein | – |
| DB Fernverkehr AG | DE | Bahn-/Flugticket, Mietwagen | – | EUR | Nein | – |
| MILES Mobility GmbH | DE | Bahn-/Flugticket, Mietwagen *(Mietwagen, **nicht** Fremdfahrzeuge)* | – | EUR | Nein | – |
| IONOS, United-Domains, Alfahosting, Lunaweb | DE | Internet | – | EUR | Nein | – |
| Hetzner | DE | Internet / Hosting | – | EUR | Nein | – |
| AI Builders (Luma-Events) | NL | Seminar/Weiterbildung | – | EUR | **Ja** | 19 % |
| Cortecs GmbH | AT | *(SaaS — Kategorie von dir)* | – | EUR | **Ja** | 19 % |
| Google Cloud EMEA | IE | *(SaaS — Kategorie von dir)* | – | EUR | **Ja** | 19 % |
| Adobe, Amazon EU, Paddle/n8n, GoDaddy | EU | *(Kategorie von dir)* | – | EUR | **Ja** | 19 % |
| Anthropic | US | *(SaaS — Kategorie von dir)* | – | EUR | **Ja** | 19 % |
| Unipile | FR | *(SaaS — Kategorie von dir)* | – | **USD** | **Ja** | 19 % |
| OpenAI, Railway, Eleven Labs, Northflank, OpenRouter, Replicate, Fal | US | *(SaaS / Hosting — Kategorie von dir)* | – | **USD** | **Ja** | 19 % |

**Währung und § 13b-pflichtig sind zwei unabhängige Spalten.** *Währung* (USD → Betrag muss über die Bankabbuchung korrigiert werden) und *§ 13b-pflichtig* (Reverse-Charge → du schuldest die USt selbst) hängen nicht zusammen: Cortecs (AT) und Google Cloud (IE) rechnen in **EUR** ab und sind trotzdem § 13b-pflichtig; Unipile ist **beides** (USD **und** § 13b) — dort ist die § 13b-Bemessungsgrundlage der aus USD umgerechnete EUR-Bankbetrag, die USt wird also erst nach dem Bankabgleich berechnet.

> **`§ 13b-pflichtig` ist das programmatisch ausgewertete Flag** (`reverseCharge`), je Lieferant editierbar: **Ja** = von deinem Steuerberater bestätigter Reverse-Charge-Fall (alle bisher mit „Ja"/„Prüfen" geführten Lieferanten gehören dazu und stehen jetzt auf „Ja"), **Nein** = inländisch / nicht relevant. Neue, noch unbekannte Auslandslieferanten startet die App auf **Prüfen** — sie zählen erst in die Auswertung, sobald du sie (nach StB-Bestätigung) auf **Ja** stellst. Die App entscheidet die Steuerfrage nicht, sie rechnet nur:
>
> **§ 13b-Auswertung pro Quartal = Σ (`reverseChargeBaseEur` × `§ 13b-Satz`) über alle Lieferanten mit `§ 13b-pflichtig = Ja`.**
>
> Die Spalte **`§ 13b-Satz`** (Default 19 %, je Lieferant überschreibbar) liefert den USt-Satz für genau diese Rechnung.

**Split-Logik steht am Lieferanten** (dein Punkt „am Lieferanten steht, welche Logik gilt"): Die Spalte **Split** ist das Regelfeld `splitRule`. `–` = kein Split (voller Betrag auf eine Kategorie). `70/30` = zwei Positionen nach kanonischer Formel `business = round(cents × 0,7); privat = brutto − business` (Summe stimmt konstruktionsbedingt exakt). Weitere Formeln lassen sich als benannte Split-Typen ergänzen.

**Lernen ohne KI (mit Schutz der Seed-Regeln):** Korrigierst du einen Beleg eines **neuen** Anbieters (→ Kategorie X, ggf. Split/Währung/§ 13b), speichert die App die Zuordnung als neue Matrix-Zeile. Beim nächsten Beleg ist sie vorbelegt. **Gelockte Seed-Regeln werden dabei nie von einer beiläufigen Einzelkorrektur überschrieben** (sonst würde z. B. ein einmaliger 100 %-betrieblicher Telekom-Kauf den 70/30-Split löschen oder ein versehentlich als EUR bestätigter USD-Beleg das Währungsflag entfernen); Änderungen an gelockten Regeln bestätigst du bewusst. So wird die App deterministisch schlauer — nachvollziehbar und ohne laufende KI-Kosten.

---

## 8. Flexibler Bank-Import (Format noch offen)

Da das Format noch nicht feststeht, bauen wir einen **Adapter-Layer**: verschiedene Parser (camt.052/053-XML wie dein Holvi-Export, CSV mit konfigurierbarem Spalten-Mapping, MT940) münden alle in dieselbe normalisierte `BankTransaction`. Neues Format = neuer Adapter, Rest bleibt. Start mit camt.052 (kennst du) + generischem CSV; MT940 bei Bedarf. Auch dein „privates Konto"-Fall (mancher Beleg wird privat bezahlt) ist abgedeckt: solche Belege werden als „privat bezahlt, kein Bank-Match nötig" markierbar.

---

## 9. Coolify-Deployment

*Bewusste Wahl: **Coolify** ist die Zielplattform für diese App. Railway wird nur für die separate `ausgaben-app` genutzt und ist hier nicht relevant.*

- **App:** Next.js `standalone`-Build, aus dem Git-Repo (Nixpacks oder schlankes Dockerfile). Coolify baut bei jedem Push.
- **Datenbank:** PostgreSQL als eigene Coolify-Ressource; `DATABASE_URL` als Env in die App.
- **Datei-Uploads:** **persistentes Volume** (z. B. `/app/uploads`) — Container sind flüchtig, ohne Volume sind hochgeladene Belege nach dem nächsten Deploy weg. Wichtiger Punkt.
- **Env-Variablen:** `DATABASE_URL`, `AUTH_SECRET`, Upload-Pfad. Keine Lexware-Keys nötig (die App ist eigenständig).
- **Auth:** auch als Ein-Nutzer-App **Passwortschutz Pflicht** — das sind Finanzdaten. Simple Credentials-Auth reicht für den Prototyp; HTTPS macht Coolify über den Reverse-Proxy.
- **Backups:** Coolify-DB-Backup aktivieren **und** das Uploads-Volume sichern (die Originalbelege sind das Wertvollste — GoBD).

---

## 10. Roadmap

**MVP — jetzt (nur Kern-Loop):**
Upload → programmatische Extraktion (digitale PDFs) → Prüf-UI mit Lieferanten-Matrix (Kategorie/Split/Währung/§ 13b) und Fremdwährungs-Wartestatus (`awaiting_fx`) → flexibler Bank-Import (camt + CSV) → Matching/Duplikate/fehlende Belege → USD→EUR-Korrektur + § 13b-Bemessungsgrundlage → Bestätigen mit Auto-Verifikation und lernenden Regeln. Postgres, Auth, Volume, Backups. **Die § 13b-Auswertung (Reverse-Charge-Liste) gehört in den MVP** — sonst geht die Erfassung verloren.

**Iteration 2 — Papierbelege schließen:**
OCR (Tesseract) für Fotos/Scans; optional Vision-KI-Extraktionsschritt als Fallback für schwierige Layouts. Genau die Lücke aus Abschnitt 2.

**Iteration 3 — Reporting/Export:**
EÜR-Übersicht (Einnahmen/Ausgaben je Kategorie und Zeitraum), CSV-Export, später DATEV-/Steuerberater-Format.

**Iteration 4 — Migration & Sync:**
Bestehende Lexware-Kontakte/Kategorien/Historie via API einmalig importieren; optional Zwei-Wege-Sync, solange du parallel fährst.

**Iteration 5 — Compliance-Härtung (falls echter Ersatz):**
Revisionssichere Archivierung, lückenloser Audit-Trail, Aufbewahrungs-Garantien — nötig, *bevor* die App Lexware wirklich ablöst statt ergänzt.

---

## 11. Nächste Schritte

1. **Stack bestätigen** (Next.js/Postgres/Coolify) oder Gegenvorschlag.
2. **Datenmodell + Seed** festzurren: ich kann die Kategorien und die bekannten Vendor-Rules direkt aus deinen zwei Prüfprotokollen als Seed-Daten vorbereiten — damit startet die App nicht bei null, sondern kennt St. Oberholz, Telekom-Split, USD-Anbieter usw. schon.
3. **1–2 echte PDF-Belege** (je ein digitaler SaaS-Beleg und ein Foto) als Test-Input, damit wir die Extraktion an der Realität kalibrieren.
4. **Repo-Gerüst** scaffolden (Next.js + Prisma + shadcn), erste Prüf-UI mit Dummy-Daten, dann Extraktion, dann Bankabgleich.

Wenn du möchtest, lege ich als Nächstes das Repo-Gerüst an und ziehe die Vendor-Rules/Kategorien aus deinen Protokollen als Seed heraus.
