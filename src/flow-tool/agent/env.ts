/** The deployment's own public origin, for share URLs and self-checks.
 *  Vercel injects VERCEL_PROJECT_PRODUCTION_URL as a bare host. */
export function publicBaseUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : "http://localhost:3123";
}
