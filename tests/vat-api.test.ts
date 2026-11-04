import assert from "node:assert/strict";
import test from "node:test";
import {
  VAT_API_FIELDS,
  buildVatCalendarRequest,
  buildVatDraftRequest,
  buildVatReceiptRequest,
  normalizeVatDraftResponse,
  vatApiProviderStatus,
} from "../server/vat-api";

test("Moms API er fail-closed uden endpoints og OCES3-certifikat", () => {
  const names = [
    "SKAT_MOMS_API_PROVIDER_CVR", "SKAT_MOMS_API_PRIVATE_KEY_PEM", "SKAT_MOMS_API_CERT_PEM",
    "SKAT_MOMS_API_CALENDAR_WSDL", "SKAT_MOMS_API_CALENDAR_ENDPOINT",
    "SKAT_MOMS_API_DRAFT_WSDL", "SKAT_MOMS_API_DRAFT_ENDPOINT",
    "SKAT_MOMS_API_RECEIPT_WSDL", "SKAT_MOMS_API_RECEIPT_ENDPOINT",
  ];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    const status = vatApiProviderStatus();
    assert.equal(status.configured, false);
    assert.equal(status.humanApprovalRequired, true);
  } finally {
    for (const name of names) {
      if (previous[name] == null) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("kalenderforespørgsel validerer SE-nummer og datointerval", () => {
  const request = buildVatCalendarRequest({ seNumber: "46761898", from: "2026-01-01", to: "2026-12-31" });
  assert.equal(request.VirksomhedSENummerIdentifikator, "46761898");
  assert.equal(request.AngivelseTypeNavn, "Moms");
  assert.throws(() => buildVatCalendarRequest({ seNumber: "123", from: "2026-01-01", to: "2026-12-31" }));
  assert.throws(() => buildVatCalendarRequest({ seNumber: "46761898", from: "2026-12-31", to: "2026-01-01" }));
});

test("momsudkast holder SKATs 17 felter i obligatorisk rækkefølge", () => {
  const request = buildVatDraftRequest({
    seNumber: "46761898",
    periodFrom: "2026-07-01",
    periodTo: "2026-09-30",
    amounts: {
      MomsAngivelseSalgsMomsBeloeb: 2000,
      MomsAngivelseKoebsMomsBeloeb: 500,
      MomsAngivelseAfgiftTilsvarBeloeb: 1500,
    },
  });
  const fields = Object.keys(request.Angivelse.Angivelsesafgifter);
  assert.deepEqual(fields, VAT_API_FIELDS.filter((field) => [
    "MomsAngivelseAfgiftTilsvarBeloeb",
    "MomsAngivelseKoebsMomsBeloeb",
    "MomsAngivelseSalgsMomsBeloeb",
  ].includes(field)));
  assert.equal(request.Angivelse.AngiverVirksomhedSENummer.VirksomhedSENummerIdentifikator, "46761898");
  assert.throws(() => buildVatDraftRequest({
    seNumber: "46761898", periodFrom: "2026-07-01", periodTo: "2026-09-30", amounts: {},
  }));
});

test("SKAT svar normaliseres til transaktions-id og TastSelv-link", () => {
  const normalized = normalizeVatDraftResponse({
    TransaktionIdentifier: "42C8FE92-0AE3-403E-AEFA-F3A0B4508E2E",
    Dybtlink: { UrlIndicator: "https://tastselv.skat.dk/approve" },
  });
  assert.equal(normalized.providerTransactionId, "42C8FE92-0AE3-403E-AEFA-F3A0B4508E2E");
  assert.equal(normalized.deepLink, "https://tastselv.skat.dk/approve");
  assert.equal(normalizeVatDraftResponse({ TransaktionIdentifier: "abc", Dybtlink: { UrlIndicator: "javascript:alert(1)" } }).deepLink, null);
});

test("kvittering bruger udbyderens transaktions-id og ny hovedtransaktion", () => {
  const request = buildVatReceiptRequest({
    seNumber: "46761898",
    providerTransactionId: "42C8FE92-0AE3-403E-AEFA-F3A0B4508E2E",
  });
  assert.equal(request.TransaktionIdentifier, "42C8FE92-0AE3-403E-AEFA-F3A0B4508E2E");
  assert.equal(request.Angiver.VirksomhedSENummerIdentifikator, "46761898");
  assert.notEqual(request.HovedOplysninger.TransaktionIdentifikator, request.TransaktionIdentifier);
});
