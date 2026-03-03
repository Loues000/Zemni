import crypto from "node:crypto";

type GuestFingerprintResult =
  | { ok: true; key: string }
  | { ok: false; reason: "missing_salt" };

const getClientIp = (request: Request): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  return "unknown";
};

/**
 * Builds a stable guest fingerprint key from request metadata.
 */
export function buildGuestRateLimitKey(request: Request): GuestFingerprintResult {
  const salt = process.env.RATE_LIMIT_GUEST_SALT;
  if (!salt) {
    return { ok: false, reason: "missing_salt" };
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.trim() || "unknown";
  const acceptLanguage = request.headers.get("accept-language")?.trim() || "unknown";

  const raw = `${ip}:${userAgent}:${acceptLanguage}:${salt}`;
  const hash = crypto.createHash("sha256").update(raw).digest("hex");

  return { ok: true, key: `guest:${hash}` };
}

