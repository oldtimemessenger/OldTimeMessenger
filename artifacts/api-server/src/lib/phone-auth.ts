import { createHmac } from "node:crypto";

const TWILIO_VERIFY_BASE = "https://verify.twilio.com/v2/Services";
const TEST_BYPASS_PHONE = "+11234567890";
const TEST_BYPASS_CODE_PATTERN = /^\d{6}$/;

function isTestOtpBypassPhone(phone: string): boolean {
  // TEMPORARY TESTFLIGHT BYPASS: remove after production login testing.
  return phone === TEST_BYPASS_PHONE;
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

function twilioConfiguration(): {
  accountSid: string;
  authToken: string;
  serviceSid: string;
} | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  return accountSid && authToken && serviceSid ? { accountSid, authToken, serviceSid } : null;
}

async function twilioRequest(
  path: string,
  values: Record<string, string>,
): Promise<Record<string, unknown>> {
  const config = twilioConfiguration();
  if (!config) throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
  const body = new URLSearchParams(values);
  const response = await fetch(
    `${TWILIO_VERIFY_BASE}/${encodeURIComponent(config.serviceSid)}/${path}`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) throw new Error(`SMS_PROVIDER_ERROR_${response.status}`);
  return payload;
}

export async function sendPhoneVerification(phone: string): Promise<string | null> {
  if (isTestOtpBypassPhone(phone)) {
    return "123456";
  }
  if (twilioConfiguration()) {
    await twilioRequest("Verifications", { To: phone, Channel: "sms" });
    return null;
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
  if (twilioConfiguration()) {
    const result = await twilioRequest("VerificationCheck", { To: phone, Code: code });
    return result.status === "approved";
  }
  if (process.env.NODE_ENV === "production") throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
  return developmentCodeHash !== null && privacyHash(code) === developmentCodeHash;
}