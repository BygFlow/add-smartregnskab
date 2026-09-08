#!/usr/bin/env node
/**
 * Check-production-env — verificerer at alle kritiske env vars er sat.
 * Brug: node scripts/check-production-env.mjs
 * Kør før deploy for at sikre at intet mangler.
 */

const REQUIRED = [
  { key: "DATABASE_PATH", label: "Database sti", critical: true, default: "data.db" },
  { key: "FILE_STORAGE_DIR", label: "Filstorage sti", critical: true, default: "./uploads" },
  { key: "ENCRYPTION_KEY", label: "Krypteringsnøgle", critical: true, hint: "Generer med: openssl rand -hex 32" },
  { key: "APP_BASE_URL", label: "App URL", critical: true, hint: "https://app.addsmartregnskab.dk" },
  { key: "ALLOWED_ORIGINS", label: "Tilladte origins", critical: true, hint: "https://app.addsmartregnskab.dk" },
  { key: "PLATFORM_ADMIN_EMAIL", label: "Bootstrap-administrator", critical: true },
  { key: "PLATFORM_ADMIN_PASSWORD", label: "Bootstrap-password", critical: true, hint: "mindst 12 tegn" },
];

const PAYMENT = [
  { key: "STRIPE_SECRET_KEY", label: "Stripe secret key", hint: "sk_live_..." },
  { key: "STRIPE_WEBHOOK_SECRET", label: "Stripe webhook secret", hint: "whsec_..." },
];

const EMAIL = [
  { key: "RESEND_API_KEY", label: "Resend API key", hint: "re_..." },
  { key: "MAIL_FROM", label: "Afsender-email", hint: "noreply@smartregnskab.dk" },
];

const OPTIONAL = [
  { key: "SMS_API_URL", label: "SMS API URL" },
  { key: "SMS_API_KEY", label: "SMS API key" },
  { key: "MOBILEPAY_CLIENT_ID", label: "MobilePay client ID" },
  { key: "MOBILEPAY_CLIENT_SECRET", label: "MobilePay client secret" },
  { key: "S3_BUCKET", label: "S3 bucket" },
  { key: "S3_ACCESS_KEY_ID", label: "S3 access key" },
  { key: "S3_SECRET_ACCESS_KEY", label: "S3 secret key" },
];

let errors = 0;
let warnings = 0;

function check(vars, group) {
  console.log(`\n=== ${group} ===`);
  for (const v of vars) {
    const value = process.env[v.key];
    if (value) {
      console.log(`  ✓ ${v.label}: sat`);
    } else if (v.critical) {
      console.log(`  ✗ ${v.label}: MANGLER${v.hint ? ` (${v.hint})` : ""}`);
      errors++;
    } else {
      console.log(`  ⚠ ${v.label}: ikke sat${v.hint ? ` (${v.hint})` : ""}`);
      warnings++;
    }
  }
}

function invalid(message) {
  console.log(`  ✗ ${message}`);
  errors++;
}

console.log("ADD SmartRegnskab — miljøtjek\n");

check(REQUIRED, "Kritisk (skal være sat)");
check(PAYMENT, "Betaling (Stripe)");
check(EMAIL, "Email (Resend)");
check(OPTIONAL, "Valgfrit");

console.log("\n=== Format og konsistens ===");
if ((process.env.ENCRYPTION_KEY || "").length < 32) invalid("ENCRYPTION_KEY skal være mindst 32 tegn.");
if ((process.env.PLATFORM_ADMIN_PASSWORD || "").length < 12) invalid("PLATFORM_ADMIN_PASSWORD skal være mindst 12 tegn.");
try {
  const appUrl = new URL(process.env.APP_BASE_URL || "");
  if (appUrl.protocol !== "https:") invalid("APP_BASE_URL skal bruge HTTPS i production.");
} catch {
  invalid("APP_BASE_URL er ikke en gyldig URL.");
}
for (const group of [PAYMENT, EMAIL]) {
  const count = group.filter((item) => process.env[item.key]).length;
  if (count > 0 && count < group.length) invalid(`${group.map((item) => item.key).join(" + ")} skal sættes samlet.`);
}

console.log("\n=== Resultat ===");
console.log(`  Fejl: ${errors}`);
console.log(`  Advarsler: ${warnings}`);

if (errors > 0) {
  console.log("\n  IKKE PRODUKTIONSKLAR — udfyld manglende kritiske variabler.");
  process.exit(1);
} else {
  console.log("\n  Alle kritiske variabler er sat. Klar til produktion.");
  process.exit(0);
}
