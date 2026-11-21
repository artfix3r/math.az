import { createHash } from "node:crypto";

/** Sessions issued before the account's last password change are rejected. */
export function sessionStillValid(issuedAt: number, user: { passwordChangedAt: number | null }): boolean {
  return !user.passwordChangedAt || issuedAt >= user.passwordChangedAt;
}

/** Reset links carry the token; the database keeps only its hash. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
