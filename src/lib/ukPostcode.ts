// UK postcode check for the address lookup (BL-074 / SPEC-022 A2): an invalid
// postcode is refused before the paid provider is called.
const UK_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/;

/** The postcode in upper case with one space before the inward code, or null if it is not a UK postcode. */
export function formatUkPostcode(raw: string): string | null {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const match = UK_POSTCODE.exec(compact);
  return match ? `${match[1]} ${match[2]}` : null;
}
