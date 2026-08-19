import { lookup } from "dns/promises";
import net from "net";
import { AppError } from "./errors";

// The CRM webhook URL is supplied by any signed-up user and is then fetched by
// the server itself, from inside the deployment's private network. Unvalidated,
// that turns the app into a proxy for whatever the *server* can reach but the
// user can't: other services on the LAN, the container network (postgres,
// redis, minio, livekit), the loopback API, and cloud instance-metadata
// endpoints — with the meeting payload POSTed to an endpoint the attacker
// controls and reads. These checks keep such a URL from ever being requested.

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed — treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return true; // unspecified + loopback
  // IPv4-mapped (::ffff:10.0.0.1) must be judged by its embedded IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) return ipv4IsPrivate(mapped[1]);
  if (/^f[cd]/.test(normalized)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(normalized)) return true; // fe80::/10 link-local
  if (normalized.startsWith("ff")) return true; // multicast
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return ipv4IsPrivate(ip);
  if (version === 6) return ipv6IsPrivate(ip);
  return true; // not an IP at all — treat as unsafe
}

// Rejects anything that isn't a plain https URL pointing at a publicly
// routable address. Called both when the user saves the URL (fail fast, with a
// clear message) and again immediately before the request is made, because DNS
// can be re-pointed at a private address between those two moments.
export async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, "Webhook URL is not a valid URL");
  }

  // Blocks file:, data:, gopher:, and plain http (which would also send the
  // meeting payload in clear text).
  if (url.protocol !== "https:") {
    throw new AppError(400, "Webhook URL must use https");
  }
  if (url.username || url.password) {
    throw new AppError(400, "Webhook URL must not contain credentials");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // A literal IP needs no DNS resolution — check it directly.
  if (net.isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new AppError(400, "Webhook URL must point to a public address");
    }
    return url;
  }

  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".internal")) {
    throw new AppError(400, "Webhook URL must point to a public address");
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new AppError(400, "Webhook URL hostname could not be resolved");
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new AppError(400, "Webhook URL must point to a public address");
  }

  return url;
}
