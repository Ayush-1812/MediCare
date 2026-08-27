import { ContextObject } from '../contextBuilder/types';

export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}

export interface PromptPackage {
    systemPrompt: string;
    intentPrompts: string;
    context: ContextObject;
    userQuestion: string;
    /** Prior turns in this conversation, oldest first. Empty for the first message. */
    history: ConversationTurn[];
}
