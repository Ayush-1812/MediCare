import { NextResponse } from "next/server";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = searchParams.get("lat");
        const lng = searchParams.get("lng");

        if (!lat || !lng) {
            return NextResponse.json(
                { error: "Latitude and Longitude are required" },
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

        const pharmacies =
            data.local_results?.map((place: any) => ({
                name: place.title ?? "Unknown",
                address: place.address ?? "Address not available",
                rating: place.rating ?? null,
                reviews: place.reviews ?? null,
                open_state: place.open_state ?? "Unknown",
                phone: place.phone ?? null,
                thumbnail: place.thumbnail ?? null,
            })) || [];

        return NextResponse.json({ pharmacies });
    } catch (error) {
        console.error("SerpAPI Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch pharmacies" },
            { status: 500 }
        );
    }
}
