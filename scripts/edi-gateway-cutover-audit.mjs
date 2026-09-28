#!/usr/bin/env node
import { auditEdiCutover } from "../services/edi-gateway/cutover-audit.mjs";

try {
  const report = auditEdiCutover(process.env.DATABASE_PATH || "data.db", process.env.EDI_GATEWAY_DATABASE_PATH || "", {
    companyMap: process.env.SPROOM_COMPANY_MAP || "{}", gatewayKeys: process.env.EDI_GATEWAY_KEYS_JSON || "{}",
  });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`EDI-cutover-kontrol fejlede: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
