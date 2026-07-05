import { ContextObject } from './contextBuilder/types';

export class ResponseFormatter {
    private static formatDate(dateStr: string): string {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    private static getHeading(identifier: string): string {
        const id = identifier.toLowerCase();
        if (id.includes('appointment')) return '📋 Upcoming Appointments';
        if (id.includes('prescription') || id.includes('medic')) return '💊 Current Medications';
        if (id.includes('report') || id.includes('lab') || id.includes('test')) return '🩺 Medical Reports';
        if (id.includes('timeline') || id.includes('history')) return '📅 Healthcare Timeline';
        if (id.includes('summary')) return '📈 Health Summary';
        if (id.includes('profile')) return '👤 Patient Profile';
        return '📑 Health Information';
    }

    public static formatLLMResponse(llmResponse: string): string {
        if (!llmResponse || llmResponse.trim() === '') {
            return "I couldn't generate a response at this time. Please try again.";
        }
        
        // Post-process the LLM response if necessary
        // For example, ensuring consistent spacing or stripping unwanted artifacts
        return llmResponse.trim();
    }

    public static formatContext(context: ContextObject): string {
        const dataEntries = Object.entries(context.data);
        
        if (dataEntries.length === 0) {
            return "I couldn't find any specific information related to your request right now. Could you please provide more details or ask about your appointments, medications, or medical reports?";
        }

        let formattedResponse = `Here is the information I found for you:\n\n`;
        let hasData = false;

        for (const [identifier, data] of dataEntries) {
            const heading = this.getHeading(identifier);

            if (Array.isArray(data)) {
                if (data.length === 0) {
                    formattedResponse += `### ${heading}\n\nYou have no records available in this category.\n\n`;
                } else {
                    hasData = true;
                    formattedResponse += `### ${heading}\n\n`;
                    for (const item of data) {
                        formattedResponse += `- `;
                        const keys = Object.keys(item);
                        const parts = [];
                        for (const key of keys) {
                            if (key.toLowerCase() === 'id') continue; // Hide IDs
                            
                            let value = item[key];
                            if (key.toLowerCase().includes('date') && typeof value === 'string') {
                                value = this.formatDate(value);
                            }
                            
                            const cleanKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            parts.push(`**${cleanKey}:** ${value}`);
                        }
                        formattedResponse += parts.join('  •  ') + `\n`;
                    }
                    formattedResponse += `\n`;
                }
            } else if (typeof data === 'object' && data !== null) {
                hasData = true;
                formattedResponse += `### ${heading}\n\n`;
                for (const [key, value] of Object.entries(data)) {
                    if (key.toLowerCase() === 'id') continue; // Hide IDs
                    
                    const cleanKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                    
                    if (Array.isArray(value)) {
                        if (value.length === 0) {
                            formattedResponse += `**${cleanKey}:** None\n\n`;
                        } else {
                            formattedResponse += `**${cleanKey}:**\n`;
                            for (const v of value) {
                                if (typeof v === 'object' && v !== null) {
                                    const subKeys = Object.keys(v).filter(k => k.toLowerCase() !== 'id');
                                    const parts = subKeys.map(k => {
                                        let subVal = v[k];
                                        if (k.toLowerCase().includes('date') && typeof subVal === 'string') {
                                            subVal = this.formatDate(subVal);
                                        }
                                        const cleanSubKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                                        
                                        return `**${cleanSubKey}:** ${subVal}`;
                                    });
                                    formattedResponse += `  - ${parts.join('  •  ')}\n`;
                                } else {
                                    formattedResponse += `  - ${v}\n`;
                                }
                            }
                            formattedResponse += `\n`;
                        }
                    } else if (typeof value === 'object' && value !== null) {
                        formattedResponse += `**${cleanKey}:**\n`;
                        const subKeys = Object.keys(value).filter(k => k.toLowerCase() !== 'id');
                        const parts = subKeys.map(k => {
                            let subVal = (value as Record<string, any>)[k];
                            if (k.toLowerCase().includes('date') && typeof subVal === 'string') {
                                subVal = this.formatDate(subVal);
                            }
                            const cleanSubKey = k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            return `**${cleanSubKey}:** ${subVal}`;
                        });
                        formattedResponse += `  - ${parts.join('  •  ')}\n\n`;
                    } else {
                        let displayValue = value;
                        if (key.toLowerCase().includes('date') && typeof value === 'string') {
                            displayValue = this.formatDate(value);
                        }
                        formattedResponse += `**${cleanKey}:** ${displayValue}\n\n`;
                    }
                }
            } else if (data) {
                hasData = true;
                formattedResponse += `### ${heading}\n\n${data}\n\n`;
            }
        }

        if (!hasData) {
            return "I checked your records, but I couldn't find any active data for this request.";
        }

        return formattedResponse.trim();
    }
}
