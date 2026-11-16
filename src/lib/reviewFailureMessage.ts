// What the admin's report review buttons say when an action fails (BL-083 /
// SPEC-031 C1), so a server crash is not mistaken for a passing glitch, as the
// approve failure of 2026-11-16 was.
export function reviewFailureMessage(status: number | null): string {
  if (status === null) return "No answer from the server. Check your connection and try again.";
  if (status === 400) return "Please check the values: something is not valid.";
  if (status === 403) return "You're not allowed to do that. Please sign in again as an admin.";
  if (status === 404) return "This report could not be found. It may have been removed.";
  if (status === 409) return "This report has changed state (already released, or still held). Reload the page.";
  if (status >= 500) return `The server hit an error (${status}). Please try again; if it keeps happening, check /api/health.`;
  return `That action was refused (${status}). Reload the page and try again.`;
}
