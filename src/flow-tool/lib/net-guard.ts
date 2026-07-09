// Shared SSRF guard for anything that fetches a caller-supplied URL
// server-side (logo proxy, agent logo ladder). Blocks loopback, RFC-1918 and
// link-local targets so a crafted URL can't probe the deployment's network.
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h.startsWith("[")) return true;
  return false;
}
