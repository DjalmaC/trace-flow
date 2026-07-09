import { randomBytes } from "node:crypto";

// Share codes are the only thing standing between an outsider and a client
// proposal, so they stay unguessable: 9 chars over a 32-char alphabet ≈ 45 bits.
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no ambiguous chars

export function makeCode(len = 9): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
