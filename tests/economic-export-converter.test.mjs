import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { convertEconomicExportToSaft } from "../scripts/convert-economic-export-to-saft.mjs";

const sourceHeader = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:DK"><Header>
  <AuditFileDateCreated>2026-11-07</AuditFileDateCreated>
  <Company><RegistrationNumber>44822539</RegistrationNumber><Name>ADD Multi Service ApS</Name>
    <Address><StreetName>Lynæs søpark</StreetName><Number>49</Number><City>Hundested</City><PostalCode>3390</PostalCode></Address>
    <Contact><Telephone>31242426</Telephone><Email>info@add-multiservice.dk</Email></Contact>
  </Company>
</Header></AuditFile>`;

test("e-conomic-konverteringen bruger eksportens faktiske regnskabsår", async () => {
  const directory = await mkdtemp(join(tmpdir(), "economic-2025-"));
  try {
    await Promise.all([
      writeFile(join(directory, "Konto.csv"), Buffer.from("KontoNr;Navn;Type;DebetKredit\n\"1010\";\"Kontorengøring\";\"1\";\"Kredit\"\n\"5600\";\"Debitorer\";\"2\";\"Debet\"\n", "latin1")),
      writeFile(join(directory, "Postering.csv"), "LoebeNr;Dato;KontoNr;BilagsNr;Tekst;BeloebDKK;MomsKode\n\"1\";\"10-01-2025\";\"1010\";\"127\";\"Salg\";\"-125,00\";\"\"\n\"2\";\"10-01-2025\";\"5600\";\"127\";\"Salg\";\"125,00\";\"\"\n"),
      writeFile(join(directory, "MomsKode.csv"), "MomsKode;MomsNavn;MomsSats\n"),
      writeFile(join(directory, "SAF-T.xml"), sourceHeader),
    ]);

    const result = await convertEconomicExportToSaft(directory);
    assert.equal(result.summary.firstDate, "2025-01-10");
    assert.equal(result.summary.lastDate, "2025-01-10");
    assert.match(result.xml, /<TransactionID>ECON-2025-20250110-127<\/TransactionID>/);
    assert.match(result.xml, /<SelectionStartDate>2025-01-10<\/SelectionStartDate>/);
    assert.match(result.xml, /<SelectionEndDate>2025-01-10<\/SelectionEndDate>/);
    assert.match(result.xml, /<JournalID>ECONOMIC-2025<\/JournalID>/);
    assert.match(result.xml, /<AccountDescription>Kontorengøring<\/AccountDescription>/);
    assert.doesNotMatch(result.xml, /ECON-2024/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("e-conomic-konverteringen kan opdele en eksport med flere regnskabsår", async () => {
  const directory = await mkdtemp(join(tmpdir(), "economic-multi-year-"));
  try {
    await Promise.all([
      writeFile(join(directory, "Konto.csv"), "KontoNr;Navn;Type;DebetKredit\n\"1010\";\"Salg\";\"1\";\"Kredit\"\n\"5600\";\"Debitorer\";\"2\";\"Debet\"\n"),
      writeFile(join(directory, "Postering.csv"), "LoebeNr;Dato;KontoNr;BilagsNr;Tekst;BeloebDKK;MomsKode\n\"1\";\"31-12-2025\";\"1010\";\"500\";\"Salg\";\"-125,00\";\"\"\n\"2\";\"31-12-2025\";\"5600\";\"500\";\"Salg\";\"125,00\";\"\"\n\"3\";\"02-01-2026\";\"1010\";\"501\";\"Salg\";\"-250,00\";\"\"\n\"4\";\"02-01-2026\";\"5600\";\"501\";\"Salg\";\"250,00\";\"\"\n"),
      writeFile(join(directory, "MomsKode.csv"), "MomsKode;MomsNavn;MomsSats\n"),
      writeFile(join(directory, "SAF-T.xml"), sourceHeader),
    ]);

    await assert.rejects(
      convertEconomicExportToSaft(directory),
      /præcis ét regnskabsår.*2025, 2026/,
    );

    const result = await convertEconomicExportToSaft(directory, { year: 2026 });
    assert.equal(result.summary.lines, 2);
    assert.equal(result.summary.entries, 1);
    assert.equal(result.summary.firstDate, "2026-01-02");
    assert.equal(result.summary.lastDate, "2026-01-02");
    assert.match(result.xml, /<JournalID>ECONOMIC-2026<\/JournalID>/);
    assert.match(result.xml, /<TransactionID>ECON-2026-20260102-501<\/TransactionID>/);
    assert.doesNotMatch(result.xml, /ECON-2025/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
