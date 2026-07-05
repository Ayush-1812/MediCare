export enum Intent {
    APPOINTMENT = 'appointment',
    PRESCRIPTION = 'prescription',
    MEDICAL_REPORT = 'medical_report',
    TIMELINE = 'timeline',
    PROFILE = 'profile',
    HEALTH_SUMMARY = 'health_summary',
    GENERAL_WELLNESS = 'general_wellness',
    UNKNOWN = 'unknown'
}

export interface IntentMatch {
    intents: Intent[];
    confidence: number;
    recommendedTools: string[];
}

export class IntentRouter {
    private static keywordMap: Record<Intent, string[]> = {
        [Intent.APPOINTMENT]: ['appointment', 'doctor', 'book', 'schedule', 'visit', 'consultation'],
        [Intent.PRESCRIPTION]: ['prescription', 'medicine', 'pill', 'drug', 'medication', 'pharmacy'],
        [Intent.MEDICAL_REPORT]: ['report', 'lab', 'test', 'blood', 'x-ray', 'scan', 'result'],
        [Intent.TIMELINE]: ['timeline', 'history', 'past', 'previous'],
        [Intent.PROFILE]: ['profile', 'account', 'address', 'phone', 'detail'],
        [Intent.HEALTH_SUMMARY]: ['summary', 'health', 'overall', 'score', 'status'],
        [Intent.GENERAL_WELLNESS]: [
            'headache', 'fever', 'cough', 'cold', 'stomach', 'flu', 'allergy', 'ache', 'pain', 
            'acid', 'constipation', 'diarrhea', 'fatigue', 'wellness', 'dizzy', 'sore',
            'i have a', 'hurts', 'is sore', 'i\'ve been', 'i feel', 'my back', 'my neck', 'my head'
        ],
        [Intent.UNKNOWN]: []
    };

    private static toolMap: Record<Intent, string[]> = {
        [Intent.APPOINTMENT]: ['AppointmentTool'],
        [Intent.PRESCRIPTION]: ['PrescriptionTool'],
        [Intent.MEDICAL_REPORT]: ['ReportTool'],
        [Intent.TIMELINE]: ['TimelineTool'],
        [Intent.PROFILE]: ['ProfileTool'],
        [Intent.HEALTH_SUMMARY]: ['HealthSummaryTool'],
        [Intent.GENERAL_WELLNESS]: ['SymptomAssessmentTool'],
        [Intent.UNKNOWN]: []
    };

    public static route(message: string): IntentMatch {
        const lowerMessage = message.toLowerCase();
        const matchedIntents = new Set<Intent>();
        let highestConfidence = 0.0;

        for (const [intent, keywords] of Object.entries(this.keywordMap)) {
            let matchCount = 0;
            for (const keyword of keywords) {
                if (lowerMessage.includes(keyword)) {
                    matchCount++;
                }
            }

            if (matchCount > 0) {
                matchedIntents.add(intent as Intent);
                // Simple confidence calculation for mock purposes
                const confidence = Math.min(matchCount * 0.3, 0.95);
                if (confidence > highestConfidence) {
                    highestConfidence = confidence;
                }
            }
        }

        if (matchedIntents.size === 0) {
            return {
                intents: [Intent.UNKNOWN],
                confidence: 1.0,
                recommendedTools: []
            };
        }

        const intentsArray = Array.from(matchedIntents);
        const recommendedTools = intentsArray.flatMap(intent => this.toolMap[intent as Intent]);

        return {
            intents: intentsArray,
            confidence: highestConfidence,
            recommendedTools: Array.from(new Set(recommendedTools))
        };
    }
}
