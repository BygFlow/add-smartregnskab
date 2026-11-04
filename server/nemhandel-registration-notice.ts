import { storage } from "./storage";

export const NEMHANDEL_REGISTRATION_NOTICE_TITLE = "Mulighed for e-fakturering via Nemhandelsregisteret";

export const NEMHANDEL_REGISTRATION_NOTICE_MESSAGE =
  "ADD SmartRegnskab kan hjælpe virksomheden med at blive oprettet i Nemhandelsregisteret, så den kan modtage e-fakturaer. Gå til E-fakturering for at kontrollere virksomhedens CVR/GLN og vælge tilmelding. Tilmelding sker ikke uden virksomhedens godkendelse.";

export function nemhandelRegistrationNoticeEnabled() {
  return /^fob\d+$/i.test(String(process.env.ERST_REGISTRATION_FOB_NUMBER ?? "").trim());
}

export async function ensureNemhandelRegistrationNotice(companyId: number, userId?: number | null) {
  if (!nemhandelRegistrationNoticeEnabled()) return false;
  const existing = (await storage.getNotifications(companyId)).some((notification) =>
    notification.title === NEMHANDEL_REGISTRATION_NOTICE_TITLE
    && (userId == null || notification.userId === userId),
  );
  if (existing) return false;
  await storage.createNotification({
    companyId,
    userId: userId ?? null,
    title: NEMHANDEL_REGISTRATION_NOTICE_TITLE,
    message: NEMHANDEL_REGISTRATION_NOTICE_MESSAGE,
    type: "info",
    read: false,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export async function ensureNemhandelRegistrationNoticesForAllCompanies() {
  if (!nemhandelRegistrationNoticeEnabled()) return 0;
  let created = 0;
  for (const company of await storage.getCompanies()) {
    if (company.kind === "platform" || company.status === "spaerret") continue;
    if (await ensureNemhandelRegistrationNotice(company.id)) created += 1;
  }
  return created;
}
