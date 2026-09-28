import { existsSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";

function parseObject(value, name) {
  try {
    const parsed = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  throw new Error(`${name} skal være et JSON-objekt.`);
}

function tableExists(db, name) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

/** Read-only inventory. It never provisions a child, moves XML or changes a live route. */
export function auditEdiCutover(legacyPath, gatewayPath, settings = {}) {
  if (!legacyPath || !gatewayPath) throw new Error("DATABASE_PATH og EDI_GATEWAY_DATABASE_PATH kræves.");
  const legacyAbsolute = resolve(legacyPath);
  const gatewayAbsolute = resolve(gatewayPath);
  if (legacyAbsolute === gatewayAbsolute) throw new Error("Den gamle og den nye EDI-database skal være adskilt.");
  if (!existsSync(legacyAbsolute) || !existsSync(gatewayAbsolute)) throw new Error("Begge EDI-databaser skal eksistere før kontrol.");
  const companyMap = parseObject(settings.companyMap, "SPROOM_COMPANY_MAP");
  const gatewayKeys = parseObject(settings.gatewayKeys, "EDI_GATEWAY_KEYS_JSON");
  const legacy = new Database(legacyAbsolute, { readonly: true, fileMustExist: true });
  const gateway = new Database(gatewayAbsolute, { readonly: true, fileMustExist: true });
  try {
    if (!["companies", "einvoice_queue"].every(name => tableExists(legacy, name))
      || !["edi_gateway_tenants", "edi_gateway_documents", "edi_gateway_webhook_events"].every(name => tableExists(gateway, name))) {
      throw new Error("En database mangler obligatoriske EDI-tabeller; kør ikke cutover.");
    }
    const companies = legacy.prepare("SELECT id, cvr FROM companies").all();
    const tenants = gateway.prepare(`SELECT source_tenant_id, cvr, sproom_child_id, active, receive_enabled
      FROM edi_gateway_tenants WHERE product = 'smartregnskab'`).all();
    const ids = new Set([...Object.keys(companyMap), ...Object.keys(gatewayKeys), ...tenants.map(row => row.source_tenant_id)]);
    const byId = new Map(companies.map(row => [String(row.id), row]));
    const byTenant = new Map(tenants.map(row => [row.source_tenant_id, row]));
    const result = [];
    for (const id of [...ids].sort((a, b) => Number(a) - Number(b))) {
      const company = byId.get(id);
      const tenant = byTenant.get(id);
      const cvr = String(company?.cvr || "").replace(/^DK/i, "").replace(/\D/g, "");
      const rows = company ? legacy.prepare(`SELECT direction, status, routing_status, provider_message_id, payload_xml
        FROM einvoice_queue WHERE company_id = ?`).all(company.id) : [];
      const unresolvedOutbound = rows.filter(row => row.direction === "udgående"
        && !["leveret", "afvist"].includes(String(row.routing_status || row.status))).length;
      const legacyInbound = rows.filter(row => row.direction === "indgående").length;
      const legacyOriginals = rows.filter(row => Boolean(row.payload_xml)).length;
      const blockers = [];
      if (!company) blockers.push("Virksomheds-ID findes ikke i SmartRegnskab.");
      if (!/^\d{8}$/.test(cvr)) blockers.push("Virksomheden mangler et gyldigt CVR.");
      if (!tenant) blockers.push("SmartRegnskab-virksomheden er ikke oprettet i gatewayen.");
      if (tenant && !tenant.active) blockers.push("Gateway-virksomheden er endnu ikke aktiveret med dokumenteret kundegodkendelse.");
      if (tenant && tenant.cvr !== cvr) blockers.push("Gatewayens CVR stemmer ikke med SmartRegnskab.");
      if (tenant && companyMap[id] && tenant.sproom_child_id !== companyMap[id]) blockers.push("Gammel og ny Sproom-child-profil er forskellige.");
      if (!gatewayKeys[id]) blockers.push("Der er ingen virksomhedsopdelt gateway-nøgle i SmartRegnskab.");
      if (unresolvedOutbound) blockers.push(`${unresolvedOutbound} udgående dokumenter kræver afstemning før omkobling.`);
      const gatewayRows = tenant ? gateway.prepare(`SELECT direction, status, provider_message_id FROM edi_gateway_documents
        WHERE tenant_id IN (SELECT id FROM edi_gateway_tenants WHERE product = 'smartregnskab' AND source_tenant_id = ?)`).all(id) : [];
      const gatewayMessageIds = new Set(gatewayRows.map(row => row.provider_message_id).filter(Boolean));
      const overlap = rows.filter(row => row.provider_message_id && gatewayMessageIds.has(row.provider_message_id)).length;
      if (overlap) blockers.push(`${overlap} provider-ID findes i begge databaser; afklar ejerskab og dubletter.`);
      result.push({ companyId: id, cvr: cvr || null, legacyChildId: companyMap[id] || null,
        gatewayChildId: tenant?.sproom_child_id || null, gatewayActive: Boolean(tenant?.active),
        gatewayReceives: Boolean(tenant?.receive_enabled), gatewayKeyConfigured: Boolean(gatewayKeys[id]),
        legacyDocuments: rows.length, legacyInbound, legacyOriginals, unresolvedOutbound,
        gatewayDocuments: gatewayRows.length, overlap, blockers });
    }
    const queue = gateway.prepare(`SELECT status, COUNT(*) AS count FROM edi_gateway_webhook_events GROUP BY status`).all();
    return { mode: "read-only", cutoverPerformed: false, companies: result,
      gatewayWebhookQueue: Object.fromEntries(queue.map(row => [row.status, row.count])),
      manualChecks: ["Sproom-aftale og child-enrollment", "kundegodkendelse", "primær modtager pr. CVR",
        "staging-test med signerede webhooks", "backup og gendannelse", "historiske XML-originalers opbevaring"],
    };
  } finally {
    legacy.close();
    gateway.close();
  }
}
