import { createHash, createHmac } from "node:crypto";

const TEST_BYPASS_PHONE = "+11234567890";
const TEST_BYPASS_CODE_PATTERN = /^\d{6}$/;

export function isTestOtpBypassPhone(phone: string): boolean {
  // TEMPORARY TESTFLIGHT BYPASS: remove after production login testing.
  return process.env.NODE_ENV !== "production" && phone === TEST_BYPASS_PHONE;
}

function requiredSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be configured.");
  return secret;
}

export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 8 && digits.length <= 15 && trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function privacyHash(value: string): string {
  return createHmac("sha256", requiredSessionSecret()).update(value).digest("base64url");
}

/** Stable, non-secret identifier used only for private contact matching. */
export function contactDiscoveryHash(normalizedPhone: string): string {
  return createHash("sha256").update(normalizedPhone).digest("hex");
}

export async function sendPhoneVerification(phone: string): Promise<string | null> {
  if (isTestOtpBypassPhone(phone)) {
    return "123456";
  }
  if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
  return process.env.DEV_OTP_CODE ?? "123456";
}

export async function checkPhoneVerification(
  phone: string,
  code: string,
  developmentCodeHash: string | null,
): Promise<boolean> {
  if (isTestOtpBypassPhone(phone)) {
    return TEST_BYPASS_CODE_PATTERN.test(code);
  }
  if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
  return developmentCodeHash !== null && privacyHash(code) === developmentCodeHash;
}
