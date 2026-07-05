import { IntentRouter } from './IntentRouter';
import { ToolRegistry } from './ToolRegistry';
import { ResponseFormatter } from './ResponseFormatter';
import { ContextBuilder } from './contextBuilder/ContextBuilder';
import { PromptManager } from './promptManager/PromptManager';
import { GeminiService } from './services/geminiService';
import { 
    AppointmentTool, 
    PrescriptionTool, 
    ReportTool, 
    TimelineTool, 
    ProfileTool, 
    HealthSummaryTool 
} from './tools/MockTools';
import { SymptomAssessmentTool } from './tools/SymptomAssessmentTool';

export class AIOrchestrator {
    private geminiService: GeminiService;

    constructor() {
        // Use per-tool checks — safe for hot-reload re-registration
        const tools = [
            new AppointmentTool(),
            new PrescriptionTool(),
            new ReportTool(),
            new TimelineTool(),
            new ProfileTool(),
            new HealthSummaryTool(),
            new SymptomAssessmentTool(),
        ];
        for (const tool of tools) {
            ToolRegistry.register(tool); // idempotent — skips if already registered
        }

        // Initialize Gemini Service
        this.geminiService = GeminiService.getInstance();
    }

    public async handleRequest(userId: string, message: string): Promise<string> {
        try {
            // 1. Invoke Intent Router
            const intentMatch = IntentRouter.route(message);

            const toolResults: any[] = [];

            // 2. Resolve appropriate tool(s) and Execute
            for (const toolName of intentMatch.recommendedTools) {
                const tool = ToolRegistry.getTool(toolName);
                if (tool) {
                    try {
                        const result = await tool.execute(userId, { message });
                        toolResults.push(result);
                    } catch (error) {
                        console.error(`Error executing tool ${toolName}:`, error);
                    }
                }
            }

            // 3. Build Context
            const contextBuilder = new ContextBuilder();
            const context = contextBuilder.build(toolResults, intentMatch.intents);

            // 4. Build Prompt Package
            const promptPackage = PromptManager.buildPrompt(message, intentMatch.intents, context);

            // 5. Generate LLM Response via Gemini Service
            const llmResponse = await this.geminiService.generateResponse(promptPackage);

            // 6. Pass LLM Response to Response Formatter for optional post-processing
            const formattedResponse = ResponseFormatter.formatLLMResponse(llmResponse);

            return formattedResponse;
        } catch (error: any) {
            console.error('[AIOrchestrator] Error handling request:', error);
            return error.message || "I encountered an error processing your request.";
        }
    }
}

