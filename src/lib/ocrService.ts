import stringSimilarity from 'string-similarity';
import { medicineDatabase } from './medicine-db';

interface ExtractedMedicine {
    original: string;
    normalized: string;
    confidence: number;
    dosage?: string;
    frequency?: string;
    duration?: string;
}


export function normalizeMedicineData(rawText: string): ExtractedMedicine[] {
    const lines = rawText.split('\n').filter(line => line.trim().length > 0);
    const results: ExtractedMedicine[] = [];

    // Regex helpers
    const dosageRegex = /(\d+(?:mg|g|ml|mcg))/i;
    const frequencyRegex = /\b(OD|BD|TDS|QID|HS|SOS)\b/i;
    const durationRegex = /\b(\d+)\s*(days?|weeks?|months?)\b/i;

    lines.forEach(line => {
        // Simple heuristic: Assume medicine name is the first word(s) before numbers
        // This is a naive implementation for demonstration
        const parts = line.split(' ');
        let potentialName = parts[0];
        if (parts.length > 1 && isNaN(parseInt(parts[1]))) {
            potentialName += " " + parts[1]; // Try two-word names
        }

        // Fuzzy match against database
        const matches = stringSimilarity.findBestMatch(potentialName, medicineDatabase);
        const bestMatch = matches.bestMatch;

        // If strict confidence is met, or if it looks like a medicine line
        if (bestMatch.rating > 0.4) {

            // Extract attributes
            const dosageMatch = line.match(dosageRegex);
            const freqMatch = line.match(frequencyRegex);
            const durationMatch = line.match(durationRegex);

            results.push({
                original: potentialName,
                normalized: bestMatch.target,
                confidence: bestMatch.rating,
                dosage: dosageMatch ? dosageMatch[0] : undefined,
                frequency: freqMatch ? freqMatch[0].toUpperCase() : undefined,
                duration: durationMatch ? durationMatch[0] : undefined
            });
        }
    });

    return results;
}
