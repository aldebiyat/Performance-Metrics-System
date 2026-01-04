import { Request, Response, NextFunction } from 'express';

/**
 * Validates whether an IP address is a private/internal IP per RFC 1918.
 * This prevents bypass attacks where public IPs contain private range substrings
 * (e.g., '1.1.172.1' contains '172.' but is not actually private).
 *
 * @param ip - The IP address to validate
 * @returns true if the IP is private/internal, false otherwise
 */
export const isPrivateIP = (ip: string): boolean => {
  // Handle IPv6 localhost
  if (ip === '::1') return true;

  // Extract IPv4 from IPv6-mapped addresses (::ffff:x.x.x.x)
  const ipv4Match = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
  const ipv4 = ipv4Match ? ipv4Match[1] : ip;

  // Parse octets
  const parts = ipv4.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return false;
  }

  const [a, b] = parts;

  // Check private ranges per RFC 1918
  if (a === 127) return true;                              // 127.0.0.0/8 (localhost)
  if (a === 10) return true;                               // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;        // 172.16.0.0/12
  if (a === 192 && b === 168) return true;                 // 192.168.0.0/16

  return false;
};

/**
 * Middleware to authenticate access to the metrics endpoint.
 *
 * If METRICS_TOKEN is configured:
 * - Requires a valid Bearer token in the Authorization header
 *
 * If METRICS_TOKEN is not configured:
 * - Only allows access from private/internal IP addresses
 */
export const metricsAuth = (req: Request, res: Response, next: NextFunction): void => {
  const metricsToken = process.env.METRICS_TOKEN;

  // If no token configured, only allow internal/localhost access
  if (!metricsToken) {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    if (isPrivateIP(clientIp)) {
      next();
      return;
    }
    res.status(403).json({ error: 'Metrics endpoint restricted to internal access' });
    return;
  }

  // Check bearer token
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${metricsToken}`) {
    next();
    return;
  }

  res.status(401).json({ error: 'Unauthorized' });
};
