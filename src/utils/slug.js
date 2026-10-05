import crypto from "crypto";

/**
 * Generate a slug of the form `<prefix>_<8-hex>` using 32 bits of randomness.
 * At ~100K records the collision probability per pair is ~2.3e-8; the caller
 * is expected to retry on E11000 if uniqueness must be enforced (see the
 * `generateUnique*Slug` statics on each model).
 */
export function generateSlug(prefix = "usr") {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}
