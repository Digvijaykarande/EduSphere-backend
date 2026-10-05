import crypto from "crypto";
import env from "../config/env.js";
import { generateSlug } from "./slug.js";

/**
 * Generate a login alias in the form:
 *   <first>.<last>.<short>@<PUBLIC_DOMAIN>
 *
 * This address is for LOGIN DISPLAY ONLY. It is never used as the recipient
 * of transactional mail — that's `contactEmail`'s job.
 *
 * The trailing 8-hex `<short>` makes collisions astronomically unlikely even
 * for two people with identical names across the entire system.
 */
export function generateLoginAlias(firstName, lastName) {
  const slugify = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics
      .replace(/[^a-z0-9]+/g, ""); // remove anything that's not [a-z0-9]

  const f = slugify(firstName) || "user";
  const l = slugify(lastName) || "anon";
  // generateSlug returns "x_<8hex>" — drop the prefix so the alias stays clean.
  const short = generateSlug("x").slice(2);
  const full = `${f}.${l}.${short}@${env.PUBLIC_DOMAIN}`;
  return full.slice(0, 254);
}

/**
 * Generate a temp password using crypto-grade randomness.
 * Length 12 by default. Excludes ambiguous characters (0/O, 1/l/I).
 */
export function generateTempPassword(length = 12) {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}