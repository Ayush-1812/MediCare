import { ContextObject } from '../contextBuilder/types';

export interface PromptPackage {
    systemPrompt: string;
    intentPrompts: string;
    context: ContextObject;
    userQuestion: string;
}
