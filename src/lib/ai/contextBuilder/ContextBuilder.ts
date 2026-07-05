import { ToolResult } from '../ToolRegistry';
import { ContextObject } from './types';
import { deepCleanData } from './helpers';

export class ContextBuilder {
    public build(toolResults: ToolResult[], intents: string[]): ContextObject {
        const metadataSources = new Set<string>();
        const mergedData: Record<string, any> = {};

        for (const result of toolResults) {
            if (!result.success || !result.data) {
                continue;
            }

            const sourceName = result.type; // Tool type determines the category
            metadataSources.add(sourceName);

            // Clean the data (removes nulls, undefined, IDs)
            const cleanedData = deepCleanData(result.data);

            if (cleanedData !== undefined) {
                // If category already exists, we merge it.
                // For this simple mock architecture, we assume single return per type, 
                // but we handle arrays to append data if multiple tools return the same type.
                if (mergedData[sourceName]) {
                    if (Array.isArray(mergedData[sourceName]) && Array.isArray(cleanedData)) {
                        mergedData[sourceName] = [...mergedData[sourceName], ...cleanedData];
                    } else if (typeof mergedData[sourceName] === 'object' && typeof cleanedData === 'object') {
                        mergedData[sourceName] = { ...mergedData[sourceName], ...cleanedData };
                    } else {
                        // Fallback overwrite if structure is mismatched
                        mergedData[sourceName] = cleanedData;
                    }
                } else {
                    mergedData[sourceName] = cleanedData;
                }
            }
        }

        return {
            metadata: {
                generatedAt: new Date().toISOString(),
                intents: intents,
                sources: Array.from(metadataSources)
            },
            data: mergedData
        };
    }
}
