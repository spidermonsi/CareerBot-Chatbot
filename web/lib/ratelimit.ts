import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Limiters = { guest: Ratelimit; ip: Ratelimit };

export type LimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

// created on first use, not when the file loads
let cached: Limiters | null | undefined;

function getLimiters(): Limiters | null {
  if (cached !== undefined) return cached;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn("Upstash env vars are missing: rate limiting is OFF");
    cached = null;
    return cached;
  }

  const redis = Redis.fromEnv(); // reads the two env vars
  cached = {
    // each guest: 20 messages per 10 minutes
    guest: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 m"),
      prefix: "rl:guest",
    }),
    // each IP address: 60 messages per hour
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 h"),
      prefix: "rl:ip",
    }),
  };
  return cached;
}

// best guess of the visitor's IP address
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function checkRateLimit(guestId: string, ip: string): Promise<LimitResult> {
  const limiters = getLimiters();
  if (!limiters) return { allowed: true };

  try {
    const [guest, byIp] = await Promise.all([
      limiters.guest.limit(guestId),
      limiters.ip.limit(ip),
    ]);

    if (!guest.success || !byIp.success) {
      // wait until the later of the limits that were hit resets
      const resetAt = Math.max(guest.success ? 0 : guest.reset, byIp.success ? 0 : byIp.reset);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
      };
    }
    return { allowed: true };
  } catch (err) {
    // if Upstash is down, let the chat keep working
    console.error("Rate limit check failed:", err);
    return { allowed: true };
  }
}