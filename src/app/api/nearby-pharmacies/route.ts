import { NextResponse } from "next/server";

type SerpApiPlace = {
    title?: string;
    address?: string;
    rating?: number;
    reviews?: number;
    open_state?: string;
    phone?: string;
    thumbnail?: string;
    place_id?: string;
    gps_coordinates?: { latitude?: number; longitude?: number };
};

/**
 * Great-circle distance in kilometres between two lat/lng points (haversine formula).
 * Accurate enough for "how far is this pharmacy" — it ignores road routing, but at
 * city-block distances the difference from a real driving distance is negligible.
 */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawLat = searchParams.get("lat");
        const rawLng = searchParams.get("lng");

        // A missing param must fail validation, not silently become a coordinate:
        // `Number(null)` is `0`, so checking `Number.isFinite` on the converted value alone
        // let a request with no `lng` at all through as `lng=0` (the Gulf of Guinea) rather
        // than being rejected. Emptiness is checked on the raw string, before conversion.
        if (!rawLat || !rawLng) {
            return NextResponse.json(
                { error: "Latitude and Longitude are required" },
                { status: 400 }
            );
        }

        const lat = Number(rawLat);
        const lng = Number(rawLng);

        // The old check only verified the params were *present* — "lat=abc" passed it and
        // was sent to SerpAPI as a malformed `ll=@abc,...`, which the provider silently
        // interpreted its own way rather than rejecting.
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return NextResponse.json(
                { error: "Latitude and Longitude must be valid numbers" },
                { status: 400 }
            );
        }

        const apiKey = process.env.SERPAPI_KEY;
        if (!apiKey) {
            throw new Error("SERPAPI_KEY missing");
        }

        const url = `https://serpapi.com/search.json?engine=google_maps&q=Pharmacy&ll=@${lat},${lng},14z&api_key=${apiKey}`;

        const response = await fetch(url, { cache: "no-store" });
        const data = await response.json();

        if (data?.search_metadata?.status !== "Success") {
            throw new Error("SerpAPI failed");
        }

        const origin = { lat, lng };

        const pharmacies = ((data.local_results ?? []) as SerpApiPlace[])
            .map((place) => {
                const coords = place.gps_coordinates;
                const hasCoords =
                    typeof coords?.latitude === "number" && typeof coords?.longitude === "number";

                return {
                    name: place.title ?? "Unknown",
                    address: place.address ?? "Address not available",
                    rating: place.rating ?? null,
                    reviews: place.reviews ?? null,
                    open_state: place.open_state ?? "Unknown",
                    phone: place.phone ?? null,
                    thumbnail: place.thumbnail ?? null,
                    placeId: place.place_id ?? null,
                    lat: hasCoords ? coords!.latitude! : null,
                    lng: hasCoords ? coords!.longitude! : null,
                    // Rounded to one decimal for display — "3.3 km" reads better than
                    // "3.312482...", and the underlying figure isn't that precise anyway.
                    distanceKm: hasCoords
                        ? Math.round(distanceKm(origin, { lat: coords!.latitude!, lng: coords!.longitude! }) * 10) / 10
                        : null,
                };
            })
            // SerpAPI's own order is Google's relevance ranking (rating, prominence,
            // ad placement) — not proximity. A pharmacy 3km away regularly outranked one
            // 1km away. Sorting here is what actually answers "nearby".
            .sort((a, b) => {
                if (a.distanceKm === null) return 1; // No coordinates: can't rank it, push to the end.
                if (b.distanceKm === null) return -1;
                return a.distanceKm - b.distanceKm;
            });

        return NextResponse.json({ pharmacies });
    } catch (error) {
        console.error("SerpAPI Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch pharmacies" },
            { status: 500 }
        );
    }
}
