/**
 * OTP-ready phone verification architecture.
 * Currently validates 10-digit format; extend with SMS/WhatsApp OTP when ready.
 */

export interface OTPVerificationResult {
  verified: boolean;
  sessionToken?: string;
  error?: string;
}

/** Validate phone format (10 digits, India) */
export function validatePhoneFormat(phone: string): boolean {
  return /^\d{10}$/.test(phone);
}

/**
 * Placeholder for OTP send — integrate with SMS/WhatsApp OTP provider.
 * Architecture: store OTP hash + expiry in Redis/DB, verify on submit.
 */
export async function sendOTP(_phone: string): Promise<{ success: boolean; error?: string }> {
  // TODO: Integrate OTP provider (Twilio, MSG91, WhatsApp OTP template)
  console.warn("[OTP] Not configured — skipping OTP send");
  return { success: true };
}

/**
 * Placeholder for OTP verification.
 * When enabled, require verified session before appointment creation.
 */
export async function verifyOTP(
  _phone: string,
  _otp: string
): Promise<OTPVerificationResult> {
  // TODO: Verify OTP against stored hash
  return { verified: true };
}
