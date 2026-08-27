import { AITool, ToolResult } from '../ToolRegistry';
import { SeverityClassifier } from '../classifiers/SeverityClassifier';
import prisma from '@/lib/prisma';

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
                patientContext: await this.buildPatientContext(userId)
            }
        };
    }

    /**
     * Real allergy, medication and diagnosis history for this patient — assessing
     * symptoms with this permanently empty (the previous behaviour) meant every patient's
     * guidance was generated as if they had no allergies, took no medications and had no
     * history at all, regardless of what was actually on file.
     */
    private async buildPatientContext(userId: string) {
        try {
            const [user, prescriptions, recentDiagnoses] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId }, select: { allergies: true } }),
                prisma.prescription.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: { medicines: true },
                }),
                prisma.appointment.findMany({
                    where: { userId, isCompleted: true, NOT: { diagnosis: null } },
                    orderBy: { updatedAt: 'desc' },
                    take: 3,
                    select: { diagnosis: true },
                }),
            ]);

            const context: Record<string, unknown> = {};

            // Allergies are free text with no "unset" default, so a blank value is
            // genuinely ambiguous between "never answered" and "has none" — the field is
            // simply omitted rather than asserted either way. See src/lib/profile.ts.
            if (user?.allergies?.trim()) context.allergies = user.allergies.trim();

            const medicationNames = prescriptions
                .flatMap((p) => (Array.isArray(p.medicines) ? p.medicines : []))
                .map((m) => (m && typeof m === 'object' && 'name' in m ? String((m as { name: unknown }).name) : String(m)))
                .filter(Boolean);
            if (medicationNames.length > 0) context.currentMedications = Array.from(new Set(medicationNames));

            const diagnoses = recentDiagnoses.map((a) => a.diagnosis).filter((d): d is string => Boolean(d));
            if (diagnoses.length > 0) context.recentDiagnoses = diagnoses;

            return context;
        } catch (error) {
            console.error('[SymptomAssessmentTool] Failed to load patient context:', error);
            // A lookup failure must not block the symptom assessment itself — it proceeds
            // with an empty context, same as a patient with no history on file.
            return {};
        }
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

