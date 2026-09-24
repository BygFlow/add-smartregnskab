export type AuditDisplayEntry = {
  action?: string | null;
  module?: string | null;
  target?: string | null;
  detail?: string | null;
  entityDescription?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
};

const actionLabels: Record<string, string> = {
  bilag_til_papirkurv: "Flyttet til papirkurv",
  bilag_gendannet: "Gendannet",
  bilag_bogført: "Bilag bogført",
  opret_selskab: "Selskab oprettet",
  opdater_selskabsstruktur: "Selskab opdateret",
  opret_se_enhed: "SE-enhed oprettet",
  inviter_fagbruger: "Fagbruger inviteret",
  opdater_fagadgang: "Fagadgang opdateret",
  abonnementsbetingelser_accepteret: "Abonnementsbetingelser accepteret",
};

export function auditActionLabel(action?: string | null): string {
  return action ? actionLabels[action] ?? action.replaceAll("_", " ") : "—";
}

export function auditModuleLabel(entry: AuditDisplayEntry): string {
  if (entry.module) return entry.module;
  const target = entry.target ?? "";
  if (target.startsWith("document_inbox#") || target.startsWith("journal_entry#") || entry.action?.startsWith("bilag_")) return "Bilag";
  if (target === "company" || target === "company_unit") return "Selskaber";
  if (target.includes("membership") || target === "professional_approval") return "Adgang";
  if (target.startsWith("paymentMethod#")) return "Abonnement";
  return "Andet";
}

function documentDetail(entry: AuditDisplayEntry): { fileName?: string; fromStatus?: string; toStatus?: string } | null {
  if (!entry.target?.startsWith("document_inbox#") || !entry.detail) return null;
  try {
    const value = JSON.parse(entry.detail);
    if (!value || typeof value !== "object") return null;
    return {
      fileName: typeof value.fileName === "string" ? value.fileName : undefined,
      fromStatus: typeof value.fromStatus === "string" ? value.fromStatus : undefined,
      toStatus: typeof value.toStatus === "string" ? value.toStatus : undefined,
    };
  } catch {
    return null;
  }
}

function statusLabel(status?: string | null): string {
  if (!status) return "—";
  return ({ ny: "Ny", papirkurv: "Papirkurv", behandlet: "Behandlet", arkiveret: "Arkiveret", afvist: "Afvist" } as Record<string, string>)[status] ?? status;
}

export function auditEntityLabel(entry: AuditDisplayEntry): string {
  return documentDetail(entry)?.fileName ?? entry.entityDescription ?? entry.target ?? "—";
}

export function auditChangeLabels(entry: AuditDisplayEntry): [string, string] {
  const detail = documentDetail(entry);
  const from = entry.oldValue ?? detail?.fromStatus ?? (entry.action === "bilag_gendannet" ? "papirkurv" : entry.action === "bilag_til_papirkurv" ? "ny" : null);
  const to = entry.newValue ?? detail?.toStatus ?? (entry.action === "bilag_gendannet" ? "ny" : entry.action === "bilag_til_papirkurv" ? "papirkurv" : null);
  return [statusLabel(from), statusLabel(to)];
}
