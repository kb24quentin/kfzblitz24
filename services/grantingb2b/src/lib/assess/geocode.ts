/**
 * Adress-Validierung gegen OpenStreetMap Nominatim.
 * Frei, kein API-Key — aber rate-limited (1 Request/Sekunde, fairer Gebrauch
 * vorausgesetzt). User-Agent ist Pflicht.
 *
 * Doku: https://nominatim.org/release-docs/develop/api/Search/
 */

export type GeocodeResult =
  | {
      ok: true;
      found: boolean;
      displayName?: string;
      lat?: number;
      lon?: number;
      matchedPostcode?: string;
      matchedCity?: string;
      matchedStreet?: string;
      // Wie gut passte die Antwort zur eingegebenen Adresse (0..1)?
      addressMatchScore?: number;
    }
  | { ok: false; error: string };

export async function geocodeAddress(
  args: { street: string; postalCode: string; city: string; country: string },
  timeoutMs = 8000
): Promise<GeocodeResult> {
  const userAgent =
    process.env.NOMINATIM_USER_AGENT?.trim() || "kfzblitz24-grantingb2b";
  const query = new URLSearchParams({
    street: args.street,
    postalcode: args.postalCode,
    city: args.city,
    country: args.country,
    format: "json",
    addressdetails: "1",
    limit: "1",
  });
  const url = `https://nominatim.openstreetmap.org/search?${query.toString()}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": userAgent, "Accept-Language": "de" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `Nominatim HTTP ${res.status} ${res.statusText}` };
    }
    const json = (await res.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      address?: {
        road?: string;
        postcode?: string;
        city?: string;
        town?: string;
        village?: string;
        suburb?: string;
      };
    }>;
    if (!Array.isArray(json) || json.length === 0) {
      return { ok: true, found: false };
    }
    const top = json[0];
    const addr = top.address ?? {};
    const matchedCity = addr.city ?? addr.town ?? addr.village ?? addr.suburb;

    // Plausibility scoring: how many of the four parts match exactly?
    let matchPoints = 0;
    let matchTotal = 0;
    if (args.postalCode) {
      matchTotal++;
      if (addr.postcode && addr.postcode === args.postalCode) matchPoints++;
    }
    if (args.city) {
      matchTotal++;
      if (
        matchedCity &&
        matchedCity.toLowerCase().includes(args.city.toLowerCase())
      ) {
        matchPoints++;
      }
    }
    if (args.street && addr.road) {
      matchTotal++;
      // Compare road name only (without house number)
      const streetName = args.street
        .replace(/\d+[a-zA-Z]?$/, "")
        .trim()
        .toLowerCase();
      if (addr.road.toLowerCase().includes(streetName) && streetName.length > 1) {
        matchPoints++;
      }
    }
    const addressMatchScore = matchTotal > 0 ? matchPoints / matchTotal : 0;

    return {
      ok: true,
      found: true,
      displayName: top.display_name,
      lat: Number(top.lat),
      lon: Number(top.lon),
      matchedPostcode: addr.postcode,
      matchedCity,
      matchedStreet: addr.road,
      addressMatchScore,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, error: "Nominatim Timeout" };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}
