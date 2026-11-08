export type AccountingScopeCompany = {
  id: number;
  name: string;
  cvr?: string | null;
  parentCompanyId?: number | null;
  groupRole?: string | null;
};

const LEGAL_REPORT_TYPES = new Set([
  "aarskontrol",
  "resultatopgoerelse",
  "balance",
  "revisorpakke",
]);

/**
 * An SE registration can keep its own VAT, payroll, vouchers and bank work area,
 * but it is not a separate legal entity. Legal annual reports therefore include
 * the parent company plus every linked SE accounting scope. A VAT report remains
 * scoped to the selected CVR/SE registration.
 */
export function accountingReportScopes(
  companyId: number,
  reportType: string,
  companies: AccountingScopeCompany[],
) {
  const selected = companies.find((company) => company.id === companyId);
  if (!selected || !LEGAL_REPORT_TYPES.has(reportType) || selected.groupRole === "se_registration") {
    return selected ? [selected] : [];
  }

  return [
    selected,
    ...companies.filter((company) =>
      company.parentCompanyId === selected.id && company.groupRole === "se_registration"),
  ];
}

