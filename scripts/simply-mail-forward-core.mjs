function required(value, label) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} mangler.`);
  return result;
}

export function forwardConfiguration(env = process.env) {
  const domain = required(env.DOCUMENT_INBOUND_DOMAIN, "DOCUMENT_INBOUND_DOMAIN").toLowerCase();
  const product = required(env.SIMPLY_PRODUCT_HANDLE, "SIMPLY_PRODUCT_HANDLE").toLowerCase();
  const address = required(env.DOCUMENT_FORWARD_ADDRESS, "DOCUMENT_FORWARD_ADDRESS").toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) || product !== domain) {
    throw new Error("Simply-produktet skal være det konfigurerede bilagsdomæne.");
  }
  if (!new RegExp(`^bilag-[a-f0-9]{32}@${domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`).test(address)) {
    throw new Error("Kun en tokenbaseret bilagsadresse på domænet kan videresendes.");
  }
  const destination = `bilag-system@${domain}`;
  return { domain, product, address, destination, localpart: address.split("@")[0] };
}

export async function ensureSimplyMailForward({ config, apiKey, apply = false, fetchImpl = fetch }) {
  const key = required(apiKey, "SIMPLY_API_KEY");
  const base = `https://api.simply.com/2/my/products/${encodeURIComponent(config.product)}/mail/forwards/`;
  const headers = { authorization: `Bearer ${key}`, accept: "application/json" };
  const listed = await fetchImpl(base, { headers });
  if (!listed.ok) throw new Error(`Simply kunne ikke læse videresendelser (HTTP ${listed.status}).`);
  const payload = await listed.json();
  if (!Array.isArray(payload.forwards)) throw new Error("Simply returnerede ikke en liste over videresendelser.");
  const existing = payload.forwards.filter((item) => String(item.address ?? "").toLowerCase() === config.address);
  if (existing.some((item) => String(item.destination ?? "").toLowerCase() !== config.destination)) {
    throw new Error("Adressen videresendes allerede til et andet sted. Ingen ændring foretaget.");
  }
  if (existing.length) return { status: "exists", address: config.address, destination: config.destination };
  if (!apply) return { status: "dry-run", address: config.address, destination: config.destination };

  const created = await fetchImpl(base, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ localpart: config.localpart, destination: config.destination }),
  });
  if (!created.ok) {
    // A concurrent request may have created this same forward after our GET.
    const checked = await fetchImpl(base, { headers });
    if (checked.ok) {
      const after = await checked.json();
      if (Array.isArray(after.forwards) && after.forwards.some((item) =>
        String(item.address ?? "").toLowerCase() === config.address
        && String(item.destination ?? "").toLowerCase() === config.destination)) {
        return { status: "exists", address: config.address, destination: config.destination };
      }
    }
    throw new Error(`Simply kunne ikke oprette videresendelsen (HTTP ${created.status}).`);
  }
  return { status: "created", address: config.address, destination: config.destination };
}
