export interface PincodePostOffice {
  Name: string;
  BranchType: string;
  DeliveryStatus: string;
  Circle: string;
  District: string;
  Division: string;
  Region: string;
  Block: string;
  State: string;
  Country: string;
  Pincode: string;
}

export function joinAddressParts(parts: (string | null | undefined)[]): string {
  const cleaned = parts.map((p) => p?.trim()).filter((p): p is string => !!p);
  return cleaned.length ? `${cleaned.join(', ')}.` : '';
}

export function postOfficeToFields(office: PincodePostOffice): Record<string, string> {
  return {
    'Post Office': office.Name ?? '',
    'Branch Type': office.BranchType ?? '',
    'Delivery Status': office.DeliveryStatus ?? '',
    Circle: office.Circle ?? '',
    District: office.District ?? '',
    Division: office.Division ?? '',
    Region: office.Region ?? '',
    Block: office.Block ?? '',
    State: office.State ?? '',
    Country: office.Country ?? '',
    Pincode: office.Pincode ?? '',
  };
}

export function buildStreetViewLink(lat: string | number, lng: string | number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

export function buildStreetViewEmbedUrl(lat: string | number, lng: string | number): string {
  return `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,0,0,0,0&output=embed`;
}

export function buildMapEmbedUrl(lat: string | number, lng: string | number): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=16&output=embed`;
}

export function buildMapEmbedFromQuery(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

export async function geocodeAddress(
  query: string,
): Promise<{ latitude: string; longitude: string } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SwarajyaFinanceDigitalVerification/1.0' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    if (!Array.isArray(data) || !data[0]?.lat || !data[0]?.lon) return null;
    return { latitude: String(data[0].lat), longitude: String(data[0].lon) };
  } catch {
    return null;
  }
}
