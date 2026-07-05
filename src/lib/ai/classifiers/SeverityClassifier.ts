export type SeverityLevel = 'NORMAL' | 'CAUTION' | 'EMERGENCY';

export interface SeverityClassification {
    severity: SeverityLevel;
    confidence: number;
    matchedPatterns: string[];
}

export class SeverityClassifier {
    // High-risk keywords that indicate an emergency
    private static emergencyPatterns = [
        'chest pain', 'heart attack', 'difficulty breathing', 'can\'t breathe', 
        'stroke', 'loss of consciousness', 'fainted', 'passed out', 
        'severe allergic reaction', 'anaphylaxis', 'heavy bleeding', 
        'coughing blood', 'severe headache', 'sudden weakness', 'blurred vision'
    ];

    // Moderate-risk keywords that indicate caution
    private static cautionPatterns = [
        'high fever', 'persistent vomiting', 'severe abdominal pain', 
        'dehydration', 'dizzy', 'migraine', 'severe pain'
    ];

    /**
     * Categorizes a symptom description into a SeverityLevel.
     * Returns ONLY structured metadata. Does not generate medical advice.
     */
    public static classify(symptomDescription: string): SeverityClassification {
        if (!symptomDescription) {
            return { severity: 'NORMAL', confidence: 1.0, matchedPatterns: [] };
        }

        const lowerDesc = symptomDescription.toLowerCase();
        const matchedPatterns: string[] = [];

        // Check for emergencies
        for (const pattern of this.emergencyPatterns) {
            if (lowerDesc.includes(pattern)) {
                matchedPatterns.push(pattern);
            }
        }
        
        if (matchedPatterns.length > 0) {
            // Confidence scales up slightly if multiple severe patterns match
            const confidence = Math.min(0.85 + (matchedPatterns.length * 0.05), 0.99);
            return { severity: 'EMERGENCY', confidence, matchedPatterns };
        }

        // Check for caution
        for (const pattern of this.cautionPatterns) {
            if (lowerDesc.includes(pattern)) {
                matchedPatterns.push(pattern);
            }
        }

        if (matchedPatterns.length > 0) {
            // Confidence scales based on caution pattern matches
            const confidence = Math.min(0.70 + (matchedPatterns.length * 0.05), 0.90);
            return { severity: 'CAUTION', confidence, matchedPatterns };
        }

        // Default to normal
        return { severity: 'NORMAL', confidence: 0.95, matchedPatterns: [] };
    }
}

