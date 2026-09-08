import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

/**
 * Kryptering af følsomme småfelter — i praksis alarmkoder og nøglekoder.
 *
 * Alarmkoder må ikke ligge i klartekst i databasen: får nogen adgang til en
 * databasekopi, har de så adgang til hver enkelt kundes bygning. Felterne
 * krypteres derfor med AES-256-GCM, som både skjuler indholdet og afslører,
 * hvis nogen har pillet ved det.
 *
 * Nøglen kommer fra ENCRYPTION_KEY. Mangler den, udledes en nøgle fra en fast
 * streng, så demoen kan køre — men så er beskyttelsen kun på papiret, og
 * `usingFallbackKey()` siger det højt, så UI'et kan advare om det.
 */

const FALLBACK = "addsmartregnskab-demo-noegle-skal-udskiftes";

function keyMaterial(): { key: Buffer; fallback: boolean } {
  const env = process.env.ENCRYPTION_KEY;
  if (env && env.length >= 16) {
    return { key: scryptSync(env, "addsmartregnskab-felt-salt", 32), fallback: false };
  }
  return { key: scryptSync(FALLBACK, "addsmartregnskab-felt-salt", 32), fallback: true };
}

export function usingFallbackKey(): boolean {
  return keyMaterial().fallback;
}

/** Krypterer en tekst. Format: gcm$<iv-base64>$<tag-base64>$<ciffertekst-base64>. */
export function encryptField(plain: string): string {
  if (!plain) return "";
  const { key } = keyMaterial();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `gcm$${iv.toString("base64")}$${tag.toString("base64")}$${enc.toString("base64")}`;
}

/** Dekrypterer et felt. Returnerer null, hvis værdien er ændret eller ulæselig. */
export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith("gcm$")) return null;
  const [, ivB64, tagB64, dataB64] = stored.split("$");
  if (!ivB64 || !tagB64 || !dataB64) return null;
  try {
    const { key } = keyMaterial();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Viser kun de sidste to tegn — nok til at genkende koden, ikke nok til at bruge den. */
export function maskSecret(plain: string | null): string | null {
  if (!plain) return null;
  if (plain.length <= 2) return "••";
  return "••••" + plain.slice(-2);
}
