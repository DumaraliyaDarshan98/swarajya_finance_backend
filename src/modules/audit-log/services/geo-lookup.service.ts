import { Injectable, Logger } from '@nestjs/common';

export type GeoLookupResult = {
  city: string | null;
  region: string | null;
  country: string | null;
  locationLabel: string | null;
};

@Injectable()
export class GeoLookupService {
  private readonly logger = new Logger(GeoLookupService.name);
  private readonly cache = new Map<string, { at: number; value: GeoLookupResult }>();
  private readonly ttlMs = 6 * 60 * 60 * 1000; // 6h

  private isPrivateIp(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    );
  }

  async lookup(ip: string | null | undefined): Promise<GeoLookupResult> {
    const empty: GeoLookupResult = {
      city: null,
      region: null,
      country: null,
      locationLabel: null,
    };
    if (!ip || this.isPrivateIp(ip)) {
      return {
        ...empty,
        locationLabel: ip ? 'Local network' : 'Unknown',
        country: ip ? 'Local' : null,
      };
    }

    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.at < this.ttlMs) {
      return cached.value;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
        { signal: controller.signal },
      );
      clearTimeout(timer);
      if (!res.ok) {
        return empty;
      }
      const data = (await res.json()) as {
        status?: string;
        country?: string;
        regionName?: string;
        city?: string;
      };
      if (data.status !== 'success') {
        return empty;
      }
      const parts = [data.city, data.regionName, data.country].filter(Boolean);
      const value: GeoLookupResult = {
        city: data.city || null,
        region: data.regionName || null,
        country: data.country || null,
        locationLabel: parts.length ? parts.join(', ') : null,
      };
      this.cache.set(ip, { at: Date.now(), value });
      return value;
    } catch (err) {
      this.logger.debug(
        `Geo lookup failed for ${ip}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return empty;
    }
  }
}
