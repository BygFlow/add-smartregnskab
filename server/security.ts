import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { hashPassword, verifyPassword } from "./auth";
import { storage } from "./storage";

const LOGIN_VINDUE_MS = 15 * 60_000;
const FEM_FEJL_LAAS_MS = 15 * 60_000;
const TI_FEJL_LAAS_MS = 60 * 60_000;
const MAKS_FEJL_PR_IP = 20;
const BASE32_ALFABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const BACKUP_ALFABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOTP_TRIN_SEKUNDER = 30;
const TOTP_CIFRE = 6;

/**
 * Den samme tekst skal vises både for en ukendt e-mail og forkert
 * adgangskode. Det forhindrer, at login-endpointet afslører, om en e-mail
 * findes i systemet.
 */
export const GENERISK_LOGINFEJL = "E-mail eller adgangskode er forkert.";

export interface TokenIndstillinger {
  userId?: number;
  companyId?: number;
  payload?: unknown;
}

function normaliserEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isoNu(): string {
  return new Date().toISOString();
}

function sekunderTil(tidspunkt: Date, nu = Date.now()): number {
  return Math.max(1, Math.ceil((tidspunkt.getTime() - nu) / 1000));
}

function laaseBesked(sekunder: number): string {
  const minutter = Math.max(1, Math.ceil(sekunder / 60));
  return `For mange mislykkede loginforsøg. Prøv igen om ${minutter} minutter.`;
}

function base32Kod(bytes: Buffer): string {
  let buffer = 0;
  let bitAntal = 0;
  let resultat = "";

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    buffer = (buffer << 8) | byte;
    bitAntal += 8;
    while (bitAntal >= 5) {
      resultat += BASE32_ALFABET[(buffer >>> (bitAntal - 5)) & 31];
      bitAntal -= 5;
    }
  }

  if (bitAntal > 0) {
    resultat += BASE32_ALFABET[(buffer << (5 - bitAntal)) & 31];
  }

  return resultat;
}

function base32Afkod(tekst: string): Buffer | null {
  const renset = tekst.replace(/\s/g, "").replace(/=+$/, "").toUpperCase();
  if (!renset || !/^[A-Z2-7]+$/.test(renset)) return null;

  let buffer = 0;
  let bitAntal = 0;
  const bytes: number[] = [];

  for (const tegn of renset) {
    const værdi = BASE32_ALFABET.indexOf(tegn);
    if (værdi < 0) return null;
    buffer = (buffer << 5) | værdi;
    bitAntal += 5;
    while (bitAntal >= 8) {
      bytes.push((buffer >>> (bitAntal - 8)) & 0xff);
      bitAntal -= 8;
    }
  }

  // Ubrugte afsluttende bit skal være nul i en kanonisk base32-streng.
  if (bitAntal > 0 && (buffer & ((1 << bitAntal) - 1)) !== 0) return null;
  return Buffer.from(bytes);
}

function totpKode(hemmelighed: Buffer, tæller: number): string {
  const tællerBuffer = Buffer.alloc(8);
  tællerBuffer.writeBigUInt64BE(BigInt(tæller));
  const hmac = createHmac("sha1", hemmelighed).update(tællerBuffer).digest();
  const forskydning = hmac[hmac.length - 1] & 0x0f;
  const tal =
    ((hmac[forskydning] & 0x7f) << 24) |
    (hmac[forskydning + 1] << 16) |
    (hmac[forskydning + 2] << 8) |
    hmac[forskydning + 3];
  return String(tal % 10 ** TOTP_CIFRE).padStart(TOTP_CIFRE, "0");
}

function normaliserBackupKode(kode: string): string | null {
  const renset = kode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z0-9]{8}$/.test(renset)) return null;
  return `${renset.slice(0, 4)}-${renset.slice(4)}`;
}

function nyBackupKode(): string {
  // 256 / 32 = 8, så bitmasken giver en jævn fordeling over hele alfabetet.
  const tegn = Array.from(randomBytes(8), (byte) => BACKUP_ALFABET[byte & 31]);
  return `${tegn.slice(0, 4).join("")}-${tegn.slice(4).join("")}`;
}

async function skrivSikkerhedsLog(
  user: { id: number; companyId: number; email: string },
  handling: string,
  detalje: string,
): Promise<void> {
  await storage.createAuditLog({
    companyId: user.companyId,
    userId: user.id,
    userEmail: user.email,
    action: handling,
    target: `bruger:${user.id}`,
    detail: detalje,
    createdAt: isoNu(),
  });
}

/** Kontrollerer både kontolåsning og grænsen for fejl fra samme IP-adresse. */
export async function checkLoginAllowed(
  email: string,
  ip: string,
): Promise<{ allowed: boolean; reason?: string; retryAfterSeconds?: number }> {
  const normaliseretEmail = normaliserEmail(email);
  const nu = Date.now();
  const bruger = await storage.getUserByEmail(normaliseretEmail);

  if (bruger?.lockedUntil) {
    const låstIndtil = new Date(bruger.lockedUntil);
    if (!Number.isNaN(låstIndtil.getTime()) && låstIndtil.getTime() > nu) {
      const retryAfterSeconds = sekunderTil(låstIndtil, nu);
      return { allowed: false, reason: laaseBesked(retryAfterSeconds), retryAfterSeconds };
    }
  }

  const siden = new Date(nu - LOGIN_VINDUE_MS).toISOString();
  const [emailFejl, forsøg] = await Promise.all([
    storage.countRecentFailures(normaliseretEmail, siden),
    // Lagringslaget har ikke en særskilt IP-optælling; de nyeste rækker er
    // tilstrækkelige til at afgøre en grænse på 20 fejlforsøg.
    storage.getLoginAttempts(undefined, 10_000),
  ]);
  const ipFejl = forsøg.filter(
    (forsøg) =>
      forsøg.success === 0 &&
      forsøg.ip === ip &&
      new Date(forsøg.createdAt).getTime() >= nu - LOGIN_VINDUE_MS,
  );

  if (ipFejl.length >= MAKS_FEJL_PR_IP) {
    const ældste = Math.min(...ipFejl.map((forsøg) => new Date(forsøg.createdAt).getTime()));
    const retryAfterSeconds = Math.max(1, Math.ceil((ældste + LOGIN_VINDUE_MS - nu) / 1000));
    return { allowed: false, reason: laaseBesked(retryAfterSeconds), retryAfterSeconds };
  }

  if (emailFejl >= 5) {
    const låseVarighed = emailFejl >= 10 ? TI_FEJL_LAAS_MS : FEM_FEJL_LAAS_MS;
    const låstIndtil = new Date(nu + låseVarighed);
    if (bruger) await storage.updateUser(bruger.id, { lockedUntil: låstIndtil.toISOString() });
    const retryAfterSeconds = sekunderTil(låstIndtil, nu);
    return { allowed: false, reason: laaseBesked(retryAfterSeconds), retryAfterSeconds };
  }

  return { allowed: true };
}

/** Registrerer resultatet af et login og vedligeholder kontolåsningen. */
export async function recordLogin(
  email: string,
  ip: string,
  success: boolean,
  reason?: string,
): Promise<void> {
  const normaliseretEmail = normaliserEmail(email);
  const nu = isoNu();
  await storage.recordLoginAttempt({
    email: normaliseretEmail,
    ip,
    success: success ? 1 : 0,
    reason: reason ?? (success ? null : GENERISK_LOGINFEJL),
    createdAt: nu,
  });

  const bruger = await storage.getUserByEmail(normaliseretEmail);
  if (!bruger) return;

  if (success) {
    await storage.updateUser(bruger.id, { lockedUntil: null, lastLoginAt: nu });
    return;
  }

  const siden = new Date(Date.now() - LOGIN_VINDUE_MS).toISOString();
  const fejl = await storage.countRecentFailures(normaliseretEmail, siden);
  if (fejl >= 5) {
    const låseVarighed = fejl >= 10 ? TI_FEJL_LAAS_MS : FEM_FEJL_LAAS_MS;
    await storage.updateUser(bruger.id, {
      lockedUntil: new Date(Date.now() + låseVarighed).toISOString(),
    });
  }
}

/** Opretter en 160-bit base32-hemmelighed til en TOTP-authenticator. */
export function generateTotpSecret(): string {
  return base32Kod(randomBytes(20));
}

/** Danner standard-URI'en, som kan vises som QR-kode i en authenticator-app. */
export function totpUri(secret: string, email: string, issuer = "ADD SmartRegnskab"): string {
  const etiket = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${etiket}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Verificerer en sekscifret RFC 6238 TOTP-kode med et lille tidsvindue. */
export function verifyTotp(secret: string, code: string, window = 1): boolean {
  const hemmelighed = base32Afkod(secret);
  const indtastetKode = code.trim();
  if (!hemmelighed || !/^\d{6}$/.test(indtastetKode)) return false;

  const tilladtVindue = Number.isFinite(window) ? Math.max(0, Math.floor(window)) : 0;
  const nuværendeTrin = Math.floor(Date.now() / 1000 / TOTP_TRIN_SEKUNDER);
  const indtastetBuffer = Buffer.from(indtastetKode, "ascii");
  let gyldig = false;

  for (let forskydning = -tilladtVindue; forskydning <= tilladtVindue; forskydning += 1) {
    const kandidat = totpKode(hemmelighed, nuværendeTrin + forskydning);
    const matcher = timingSafeEqual(indtastetBuffer, Buffer.from(kandidat, "ascii"));
    gyldig = gyldig || matcher;
  }

  return gyldig;
}

/** Opretter otte engangskoder; kun JSON-strengen med hashværdier skal gemmes. */
export function generateBackupCodes(): { plain: string[]; hashed: string } {
  const plain: string[] = [];
  while (plain.length < 8) {
    const kode = nyBackupKode();
    if (!plain.includes(kode)) plain.push(kode);
  }
  return { plain, hashed: JSON.stringify(plain.map((kode) => hashPassword(kode))) };
}

/** Forbruger én gyldig reservekode, så den ikke kan genbruges. */
export async function consumeBackupCode(userId: number, code: string): Promise<boolean> {
  const bruger = await storage.getUser(userId);
  const normaliseretKode = normaliserBackupKode(code);
  if (!bruger?.twoFactorBackup || !normaliseretKode) return false;

  let hashVærdier: unknown;
  try {
    hashVærdier = JSON.parse(bruger.twoFactorBackup);
  } catch {
    return false;
  }
  if (!Array.isArray(hashVærdier) || !hashVærdier.every((værdi) => typeof værdi === "string")) return false;

  const indeks = hashVærdier.findIndex((hash) => verifyPassword(normaliseretKode, hash));
  if (indeks < 0) return false;

  const resterende = hashVærdier.filter((_, index) => index !== indeks);
  await storage.updateUser(userId, { twoFactorBackup: JSON.stringify(resterende) });
  return true;
}

/** Aktiverer kun to-faktor, når den netop indtastede TOTP-kode er gyldig. */
export async function enableTwoFactor(
  userId: number,
  secret: string,
  code: string,
): Promise<{ ok: boolean; backupCodes?: string[]; error?: string }> {
  const bruger = await storage.getUser(userId);
  if (!bruger) return { ok: false, error: "Brugeren findes ikke." };
  if (!verifyTotp(secret, code)) return { ok: false, error: "Den indtastede sikkerhedskode er ugyldig." };

  const backup = generateBackupCodes();
  await storage.updateUser(userId, {
    twoFactorSecret: secret,
    twoFactorEnabled: 1,
    twoFactorBackup: backup.hashed,
  });
  await skrivSikkerhedsLog(bruger, "to_faktor_aktiveret", "To-faktor-godkendelse blev aktiveret.");
  return { ok: true, backupCodes: backup.plain };
}

/** Deaktiverer to-faktor og afslutter alle eksisterende sessioner. */
export async function disableTwoFactor(userId: number): Promise<boolean> {
  const bruger = await storage.getUser(userId);
  if (!bruger) return false;

  await storage.updateUser(userId, {
    twoFactorSecret: null,
    twoFactorEnabled: 0,
    twoFactorBackup: null,
  });
  await storage.deleteUserSessions(userId);
  await skrivSikkerhedsLog(bruger, "to_faktor_deaktiveret", "To-faktor-godkendelse blev deaktiveret, og alle sessioner blev afsluttet.");
  return true;
}

/** Udsteder et kryptografisk stærkt engangstoken til tilmelding eller kodeord. */
export async function issueToken(
  kind: "verificer_email" | "nulstil_kode" | "invitation",
  email: string,
  opts: TokenIndstillinger = {},
): Promise<{ token: string; expiresAt: string }> {
  const normaliseretEmail = normaliserEmail(email);
  const bruger = opts.userId === undefined ? await storage.getUserByEmail(normaliseretEmail) : undefined;
  const levetidMs = kind === "nulstil_kode" ? 60 * 60_000 : 24 * 60 * 60_000;
  const expiresAt = new Date(Date.now() + levetidMs).toISOString();
  const token = randomBytes(32).toString("hex");

  await storage.createAuthToken({
    token,
    kind,
    userId: opts.userId ?? bruger?.id ?? null,
    email: normaliseretEmail,
    companyId: opts.companyId ?? bruger?.companyId ?? null,
    payload: opts.payload === undefined ? null : JSON.stringify(opts.payload),
    expiresAt,
    usedAt: null,
    createdAt: isoNu(),
  });

  return { token, expiresAt };
}

/** Validerer og forbruger et token. Udløbne og brugte tokens kan aldrig genbruges. */
export async function consumeToken(
  token: string,
  kind: "verificer_email" | "nulstil_kode" | "invitation",
): Promise<{ ok: boolean; error?: string; row?: any }> {
  const række = await storage.getAuthToken(token);
  if (!række) return { ok: false, error: "Tokenet findes ikke." };
  if (række.kind !== kind) return { ok: false, error: "Tokenet kan ikke bruges til denne handling." };
  if (række.usedAt) return { ok: false, error: "Tokenet er allerede brugt." };
  if (new Date(række.expiresAt).getTime() <= Date.now()) {
    return { ok: false, error: "Tokenet er udløbet." };
  }

  await storage.useAuthToken(række.id, isoNu());
  return { ok: true, row: række };
}

const ALMINDELIGE_ADGANGSKODER = new Set([
  "123456", "12345678", "123456789", "1234567890", "12345678910",
  "password", "password1", "passw0rd", "qwerty", "qwerty123", "abc123",
  "letmein", "welcome", "admin", "administrator", "iloveyou", "monkey",
  "dragon", "football", "baseball", "sunshine", "princess", "master",
  "kodeord", "kodeord1", "adgangskode", "adgangskode1", "hemmelig", "addsmartregnskab",
  "sommer2025", "sommer2026", "vinter2025", "foraar2025", "efteraar2025",
  "københavn", "aarhus", "danmark", "danmark123", "fodbold", "hygge",
]);

/** Vurderer basale krav og frasorterer velkendte, lette adgangskoder. */
export function passwordStrength(pw: string): { ok: boolean; score: number; problems: string[] } {
  const problemer: string[] = [];
  const harLængde = pw.length >= 10;
  const harBogstav = /[A-Za-zÆØÅæøå]/.test(pw);
  const harTal = /\d/.test(pw);
  const harSpecialtegn = /[^A-Za-zÆØÅæøå0-9]/.test(pw);
  const erAlmindelig = ALMINDELIGE_ADGANGSKODER.has(pw.trim().toLocaleLowerCase("da-DK"));

  if (!harLængde) problemer.push("Adgangskoden skal være mindst 10 tegn lang.");
  if (!harBogstav) problemer.push("Adgangskoden skal indeholde mindst ét bogstav.");
  if (!harTal) problemer.push("Adgangskoden skal indeholde mindst ét tal.");
  if (erAlmindelig) problemer.push("Adgangskoden er for almindelig. Vælg en mere unik adgangskode.");

  const score = [harLængde, harBogstav, harTal, harSpecialtegn].filter(Boolean).length;
  return { ok: problemer.length === 0, score, problems: problemer };
}

/** Nulstiller adgangskoden og lukker alle sessioner, også en eventuel angribers. */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string; problems?: string[] }> {
  const styrke = passwordStrength(newPassword);
  if (!styrke.ok) {
    return { ok: false, error: "Adgangskoden opfylder ikke sikkerhedskravene.", problems: styrke.problems };
  }

  const forbrugt = await consumeToken(token, "nulstil_kode");
  if (!forbrugt.ok || !forbrugt.row) return { ok: false, error: forbrugt.error };

  const bruger = forbrugt.row.userId
    ? await storage.getUser(forbrugt.row.userId)
    : await storage.getUserByEmail(forbrugt.row.email);
  if (!bruger) return { ok: false, error: "Brugeren findes ikke længere." };

  await storage.updateUser(bruger.id, {
    password: hashPassword(newPassword),
    passwordChangedAt: isoNu(),
  });
  await storage.deleteUserSessions(bruger.id);
  await skrivSikkerhedsLog(bruger, "adgangskode_nulstillet", "Adgangskoden blev nulstillet via et engangstoken, og alle sessioner blev afsluttet.");
  return { ok: true };
}
