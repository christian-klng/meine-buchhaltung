import { describe, it, expect } from "vitest";
import { parseCamt } from "./camt";
import { parseCsv } from "./csv";
import { parseBankFile } from "./parse";

const CAMT052 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02">
  <BkToCstmrAcctRpt>
    <Rpt>
      <Acct><Id><IBAN>FI2112345600000785</IBAN></Id></Acct>
      <Ntry>
        <Amt Ccy="EUR">26.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-03-15</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties><Cdtr><Nm>Telekom Deutschland GmbH</Nm></Cdtr></RltdPties>
          <RmtInf><Ustrd>Rechnung 7646598285</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">44.50</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-05-12</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties><Cdtr><Nm>Unipile SAS</Nm></Cdtr></RltdPties>
          <RmtInf><Ustrd>Invoice INV-2026-0042</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Rpt>
  </BkToCstmrAcctRpt>
</Document>`;

const CSV = `Buchungstag;Empfänger;Verwendungszweck;Betrag;Währung
15.03.2026;Telekom Deutschland GmbH;Rechnung 7646598285;-26,00;EUR
12.05.2026;Unipile;Invoice INV-2026-0042;-44,50;EUR
01.05.2026;Kunde X;Zahlungseingang;1.234,56;EUR`;

describe("camt", () => {
  const st = parseCamt(CAMT052);
  it("erkennt Format und Konto", () => {
    expect(st.format).toBe("camt052");
    expect(st.account).toBe("FI2112345600000785");
    expect(st.transactions).toHaveLength(2);
  });
  it("DBIT ist negativ, Betrag in Cent, Gegenpartei + Zweck", () => {
    const t = st.transactions[0];
    expect(t.amountCents).toBe(-2600);
    expect(t.currency).toBe("EUR");
    expect(t.counterparty).toBe("Telekom Deutschland GmbH");
    expect(t.purpose).toContain("7646598285");
    expect(t.date.toISOString().slice(0, 10)).toBe("2026-03-15");
  });
  it("zweite Buchung Unipile", () => {
    expect(st.transactions[1].amountCents).toBe(-4450);
    expect(st.transactions[1].counterparty).toBe("Unipile SAS");
  });
});

describe("csv", () => {
  const st = parseCsv(CSV);
  it("erkennt Spalten automatisch", () => {
    expect(st.transactions).toHaveLength(3);
    expect(st.transactions[0].amountCents).toBe(-2600);
    expect(st.transactions[0].counterparty).toBe("Telekom Deutschland GmbH");
  });
  it("Gutschrift (Haben) positiv, deutsche Tausendertrennung", () => {
    const credit = st.transactions.find((t) => t.amountCents > 0);
    expect(credit?.amountCents).toBe(123456);
  });
});

describe("parseBankFile Dispatcher", () => {
  it("XML → camt, sonst CSV", () => {
    expect(parseBankFile(CAMT052).format).toBe("camt052");
    expect(parseBankFile(CSV).format).toBe("csv");
  });
});
