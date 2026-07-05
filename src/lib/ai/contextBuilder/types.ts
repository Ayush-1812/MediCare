export interface ContextMetadata {
    generatedAt: string;
    intents: string[];
    sources: string[];
}

export interface ContextObject {
    metadata: ContextMetadata;
    data: Record<string, any>;
}
