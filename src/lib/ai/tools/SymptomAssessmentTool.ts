import { AITool, ToolResult } from '../ToolRegistry';
import { SeverityClassifier } from '../classifiers/SeverityClassifier';

interface SymptomMetadata {
    raw: string;
    normalized: string;
    source: 'user_message';
}

export class SymptomAssessmentTool implements AITool {
    name = 'SymptomAssessmentTool';
    description = 'Extracts rich symptom context and severity metadata from user input.';

    async execute(userId: string, parameters?: Record<string, unknown>): Promise<ToolResult> {
        const userInput = (parameters?.message as string) || '';

        // Extract metadata using the severity classifier
        const classification = SeverityClassifier.classify(userInput);

        // Richer Context Extraction Logic
        const extractedSymptoms = this.extractSymptoms(userInput);
        const duration = this.extractDuration(userInput);
        const onset = this.extractOnset(userInput);
        const location = this.extractLocation(userInput);

        // Clarification logic
        let needsClarification = false;
        const clarificationQuestions: string[] = [];

        if (extractedSymptoms.length === 0 && userInput.length < 25 && userInput.toLowerCase().includes('pain')) {
            needsClarification = true;
            clarificationQuestions.push('Where exactly is the pain located?');
        } else if (extractedSymptoms.length === 0 && userInput.length > 5) {
            // General vagueness catch-all
            needsClarification = true;
            clarificationQuestions.push('Could you provide a few more details about what you are experiencing?');
        }

        return {
            success: true,
            type: 'symptom_assessment',
            data: {
                symptoms: extractedSymptoms.length > 0 ? extractedSymptoms : undefined,
                duration: duration || undefined,
                onset: onset || undefined,
                location: location || undefined,
                severity: classification.severity,
                confidence: classification.confidence,
                matchedSeverityPatterns: classification.matchedPatterns.length > 0 ? classification.matchedPatterns : undefined,
                needsClarification: needsClarification ? true : undefined,
                clarificationQuestions: needsClarification ? clarificationQuestions : undefined,
                patientContext: {
                    allergies: [],
                    prescriptions: [],
                    chronicConditions: [],
                    medicalHistory: []
                }
            }
        };
    }

    private extractSymptoms(input: string): SymptomMetadata[] {
        const symptoms: SymptomMetadata[] = [];
        const commonSymptomsMap: Record<string, string> = {
            'headache': 'headache',
            'head hurts': 'headache',
            'blurred vision': 'blurred vision',
            'chest pain': 'chest pain',
            'heart hurts': 'chest pain',
            'fever': 'fever',
            'hot': 'fever',
            'cough': 'cough',
            'coughing': 'cough',
            'cold': 'cold',
            'stomach ache': 'abdominal pain',
            'stomach hurts': 'abdominal pain',
            'nausea': 'nausea',
            'vomiting': 'vomiting',
            'throw up': 'vomiting',
            'dizzy': 'dizziness',
            'fatigue': 'fatigue',
            'tired': 'fatigue',
            'diarrhea': 'diarrhea'
        };
        
        const lowerInput = input.toLowerCase();
        for (const [rawVariant, normalized] of Object.entries(commonSymptomsMap)) {
            if (lowerInput.includes(rawVariant)) {
                symptoms.push({
                    raw: rawVariant,
                    normalized: normalized,
                    source: 'user_message'
                });
            }
        }
        return symptoms;
    }

    private extractDuration(input: string): string | null {
        const lowerInput = input.toLowerCase();
        if (lowerInput.includes('since yesterday')) return 'since yesterday';
        if (lowerInput.includes('for a week')) return 'for a week';
        if (lowerInput.includes('for a few days')) return 'for a few days';
        if (lowerInput.includes('all day')) return 'all day';
        return null;
    }

    private extractOnset(input: string): string | null {
        const lowerInput = input.toLowerCase();
        if (lowerInput.includes('sudden')) return 'sudden';
        if (lowerInput.includes('gradual')) return 'gradual';
        return null;
    }

    private extractLocation(input: string): string | null {
        const lowerInput = input.toLowerCase();
        if (lowerInput.includes('left knee')) return 'left knee';
        if (lowerInput.includes('right knee')) return 'right knee';
        if (lowerInput.includes('head')) return 'head';
        if (lowerInput.includes('stomach')) return 'stomach';
        if (lowerInput.includes('back')) return 'back';
        if (lowerInput.includes('chest')) return 'chest';
        if (lowerInput.includes('throat')) return 'throat';
        return null;
    }
}

