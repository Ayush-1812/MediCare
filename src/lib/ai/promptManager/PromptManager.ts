import { ContextObject } from '../contextBuilder/types';
import { PromptPackage } from './types';
import { systemPrompt } from '../prompts/system';
import { appointmentPrompt } from '../prompts/appointment';
import { prescriptionPrompt } from '../prompts/prescription';
import { reportPrompt } from '../prompts/report';
import { profilePrompt } from '../prompts/profile';
import { timelinePrompt } from '../prompts/timeline';
import { healthSummaryPrompt } from '../prompts/healthSummary';
import { symptomCheckerPrompt } from '../prompts/symptomChecker';
import { homeRemediesPrompt } from '../prompts/homeRemedies';
import { diseaseExplorerPrompt } from '../prompts/diseaseExplorer';
import { symptomAssessmentPrompt } from '../prompts/symptomAssessment';

export class PromptManager {
    private static promptRegistry: Record<string, string> = {
        appointment: appointmentPrompt,
        prescription: prescriptionPrompt,
        report: reportPrompt,
        profile: profilePrompt,
        timeline: timelinePrompt,
        health_summary: healthSummaryPrompt,
        symptom_checker: symptomCheckerPrompt,
        home_remedies: homeRemediesPrompt,
        disease_explorer: diseaseExplorerPrompt,
        general_wellness: symptomAssessmentPrompt
    };

    /**
     * Registers a new prompt dynamically, allowing extensibility without modifying existing code.
     */
    public static registerPrompt(intent: string, promptText: string): void {
        this.promptRegistry[intent] = promptText;
    }

    /**
     * Builds a provider-independent PromptPackage containing the global system prompt,
     * combined intent prompts, cleaned context, and the user's question.
     */
    public static buildPrompt(userQuestion: string, intents: string[], context: ContextObject): PromptPackage {
        
        // Collect specific prompts for the detected intents
        const specificPrompts = intents
            .map(intent => this.promptRegistry[intent])
            .filter(prompt => prompt !== undefined);

        // Merge multiple intent prompts if they exist
        const combinedIntentPrompts = specificPrompts.length > 0
            ? specificPrompts.join('\n\n')
            : 'You are assisting the user with a general healthcare inquiry.';

        return {
            systemPrompt: systemPrompt,
            intentPrompts: combinedIntentPrompts,
            context: context,
            userQuestion: userQuestion
        };
    }
}
