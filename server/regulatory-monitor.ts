import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./storage";
import { regulatoryChanges, regulatorySources } from "@shared/schema";

const OFFICIAL_SOURCES = [
  { sourceKey: "dk-bogfoeringslov-vejledning", name: "Erhvervsstyrelsen — Bogføringsloven", url: "https://erhvervsstyrelsen.dk/vejledning-bogfoeringsloven", jurisdiction: "DK" },
  { sourceKey: "dk-registrerede-bogfoeringssystemer", name: "Erhvervsstyrelsen — Registrerede bogføringssystemer", url: "https://erhvervsstyrelsen.dk/fortegnelse-over-registrerede-bogfoeringssystemer", jurisdiction: "DK" },
  { sourceKey: "dk-ikke-registrerede-systemer", name: "Erhvervsstyrelsen — Ikke-registrerede bogføringssystemer", url: "https://erhvervsstyrelsen.dk/ikke-registrerede-digitale-bogfoeringssystemer", jurisdiction: "DK" },
  { sourceKey: "dk-saft-standardkontoplan", name: "Erhvervsstyrelsen — SAF-T og standardkontoplan", url: "https://erhvervsstyrelsen.dk/standardkontoplan-saf-t", jurisdiction: "DK" },
  { sourceKey: "dk-nemhandel", name: "Erhvervsstyrelsen — NemHandel", url: "https://erhvervsstyrelsen.dk/nemhandel-faelles-digital-infrastruktur", jurisdiction: "DK/EU" },
  { sourceKey: "dk-bek-standard-systemer", name: "Retsinformation — Krav til digitale standardbogføringssystemer", url: "https://www.retsinformation.dk/eli/lta/2023/97", jurisdiction: "DK" },
  { sourceKey: "dk-bek-registrering", name: "Retsinformation — Registrering af standardbogføringssystemer", url: "https://www.retsinformation.dk/eli/lta/2023/98", jurisdiction: "DK" },
  { sourceKey: "dk-bek-ikke-registrerede", name: "Retsinformation — Krav til ikke-registrerede bogføringssystemer", url: "https://www.retsinformation.dk/eli/lta/2024/205", jurisdiction: "DK" },
  { sourceKey: "dk-skat-moms", name: "Skattestyrelsen — Moms", url: "https://skat.dk/erhverv/moms", jurisdiction: "DK" },
  { sourceKey: "dk-datatilsynet-ai", name: "Datatilsynet — Kunstig intelligens", url: "https://www.datatilsynet.dk/regler-og-vejledning/kunstig-intelligens", jurisdiction: "DK/EU" },
  { sourceKey: "eu-ai-act", name: "EUR-Lex — AI-forordningen", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj?locale=da", jurisdiction: "EU" },
] as const;

const ALLOWED_HOSTS = new Set(["erhvervsstyrelsen.dk", "skat.dk", "www.datatilsynet.dk", "eur-lex.europa.eu", "www.retsinformation.dk"]);

function normalizedHash(body: string): string {
  const normalized = body
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\s+/g, " ").trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export function ensureRegulatorySources(): void {
  const now = new Date().toISOString();
  for (const source of OFFICIAL_SOURCES) {
    const exists = db.select().from(regulatorySources).where(eq(regulatorySources.sourceKey, source.sourceKey)).get();
    if (!exists) db.insert(regulatorySources).values({ ...source, active: true, createdAt: now }).run();
  }
}

export async function monitorRegulatorySources(): Promise<{ checked: number; changed: number; failed: number }> {
  ensureRegulatorySources();
  const sources = db.select().from(regulatorySources).all().filter((source) => source.active);
  let checked = 0;
  let changed = 0;
  let failed = 0;
  for (const source of sources) {
    try {
      const parsed = new URL(source.url);
      if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) throw new Error("Ikke-tilladt regelkilde.");
      const response = await fetch(source.url, {
        headers: { "user-agent": "ADD-SmartRegnskab-Regelovervaagning/1.0", accept: "text/html,application/xhtml+xml,application/pdf;q=0.8" },
        redirect: "follow", signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > 10_000_000) throw new Error("Regelkilden er større end den tilladte grænse.");
      const hash = normalizedHash(await response.text());
      const now = new Date().toISOString();
      if (source.contentHash && source.contentHash !== hash) {
        db.insert(regulatoryChanges).values({
          sourceId: source.id, detectedAt: now, previousHash: source.contentHash, newHash: hash,
          status: "afventer_faglig_godkendelse",
          summary: "Den officielle kilde er ændret. Reglen må ikke aktiveres, før ændringen er fortolket og fagligt godkendt.",
        }).run();
        changed++;
      }
      db.update(regulatorySources).set({
        lastCheckedAt: now, lastHttpStatus: response.status,
        etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"), contentHash: hash,
      }).where(eq(regulatorySources.id, source.id)).run();
      checked++;
    } catch {
      failed++;
      db.update(regulatorySources).set({ lastCheckedAt: new Date().toISOString(), lastHttpStatus: 0 })
        .where(eq(regulatorySources.id, source.id)).run();
    }
  }
  return { checked, changed, failed };
}
