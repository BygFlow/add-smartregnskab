export const INCLUDED_ANNUAL_POSTINGS = 1_000;

export const POSTING_PRICE_TIERS = [
  { annualLimit: 1_000, monthlySurcharge: 0 },
  { annualLimit: 2_000, monthlySurcharge: 99 },
  { annualLimit: 5_000, monthlySurcharge: 249 },
  { annualLimit: 10_000, monthlySurcharge: 449 },
  { annualLimit: 25_000, monthlySurcharge: 699 },
  { annualLimit: 50_000, monthlySurcharge: 899 },
  { annualLimit: 100_000, monthlySurcharge: 1_199 },
] as const;

export type PostingPriceTier = (typeof POSTING_PRICE_TIERS)[number] & {
  contactRequired: boolean;
};

export function postingPriceTier(annualPostings: number): PostingPriceTier {
  const normalized = Math.max(0, Math.floor(annualPostings));
  const tier = POSTING_PRICE_TIERS.find((candidate) => normalized <= candidate.annualLimit)
    ?? POSTING_PRICE_TIERS[POSTING_PRICE_TIERS.length - 1];
  return { ...tier, contactRequired: normalized > tier.annualLimit };
}

export function estimatedMonthlyDocuments(annualPostings: number): number {
  return Math.floor(annualPostings / 3 / 12);
}
