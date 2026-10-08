/** Kun filer gemt af den rigtige filservice må bruges som arkivoriginaler. */
export function parseStoredFileObjectPath(value: string, companyId: number) {
  const match = /^(disk|s3):(\d+\/[A-Za-z0-9._-]+)$/.exec(value);
  if (!match || !match[2].startsWith(`${companyId}/`)) {
    throw new Error("Filobjektet har ikke en gyldig, virksomhedsafgrænset originalfil.");
  }
  return { storage: match[1], key: match[2] };
}
