import { Injectable, Logger } from '@nestjs/common';

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName?: string;
  source: string;
}

/** Rough city centroids used when remote geocoders fail. */
const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  pune: { lat: 18.5204, lng: 73.8567 },
  surat: { lat: 21.1702, lng: 72.8311 },
  vadodara: { lat: 22.3072, lng: 73.1812 },
  anand: { lat: 22.5645, lng: 72.9289 },
  nadiad: { lat: 22.6939, lng: 72.8616 },
  rajkot: { lat: 22.3039, lng: 70.8022 },
  delhi: { lat: 28.6139, lng: 77.209 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  indore: { lat: 22.7196, lng: 75.8577 },
  nagpur: { lat: 21.1458, lng: 79.0882 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  chandigarh: { lat: 30.7333, lng: 76.7794 },
};

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly cache = new Map<string, GeocodeResult | null>();

  async geocode(query: string): Promise<GeocodeResult | null> {
    const cleaned = query?.trim();
    if (!cleaned) return null;

    const cacheKey = cleaned.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    // Try progressively simpler queries so messy addresses still resolve.
    const candidates = this.buildQueryCandidates(cleaned);
    for (const candidate of candidates) {
      const nominatim = await this.geocodeNominatim(candidate);
      if (nominatim) {
        this.cache.set(cacheKey, nominatim);
        return nominatim;
      }
    }

    const cityFallback = this.cityCentroidFallback(cleaned);
    if (cityFallback) {
      this.cache.set(cacheKey, cityFallback);
      return cityFallback;
    }

    this.cache.set(cacheKey, null);
    return null;
  }

  private buildQueryCandidates(query: string): string[] {
    const parts = query
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    const pincode = parts.find((p) => /^\d{6}$/.test(p));
    const city = parts.find((p) => /ahmedabad|mumbai|pune|surat|anand|delhi|bengaluru|bangalore|hyderabad|chennai|kolkata|jaipur|vadodara|rajkot|nadiad/i.test(p));
    const state = parts.find((p) => /gujarat|maharashtra|karnataka|delhi|rajasthan|tamil|telangana|west bengal/i.test(p));

    const candidates: string[] = [`${query}, India`];
    if (pincode) candidates.push(`${pincode}, India`);
    if (city && state) candidates.push(`${city}, ${state}, India`);
    if (city) candidates.push(`${city}, India`);
    if (pincode && state) candidates.push(`${pincode}, ${state}, India`);

    return [...new Set(candidates)];
  }

  private async geocodeNominatim(query: string): Promise<GeocodeResult | null> {
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SwarajyaFinance/1.0 (physical-verification-distance)',
        },
      });
      if (!res.ok) {
        this.logger.warn(`Nominatim HTTP ${res.status} for "${query}"`);
        return null;
      }
      const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
      if (!data?.length) return null;

      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      // Nominatim usage policy: max ~1 req/sec
      await new Promise((r) => setTimeout(r, 200));

      return {
        lat,
        lng,
        displayName: data[0].display_name,
        source: 'nominatim',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'geocode failed';
      this.logger.warn(`Nominatim error for "${query}": ${message}`);
      return null;
    }
  }

  private cityCentroidFallback(query: string): GeocodeResult | null {
    const lower = query.toLowerCase();
    for (const [city, coords] of Object.entries(CITY_CENTROIDS)) {
      if (lower.includes(city)) {
        return { ...coords, displayName: city, source: 'city-centroid' };
      }
    }
    return null;
  }
}
