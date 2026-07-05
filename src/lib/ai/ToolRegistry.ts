export interface ToolResult {
    success: boolean;
    type: string;
    data: unknown;
}

export interface AITool {
    name: string;
    description: string;

    execute(
        userId: string,
        parameters?: Record<string, unknown>
    ): Promise<ToolResult>;
}

export class ToolRegistry {

    private static tools = new Map<string, AITool>();

    public static register(tool: AITool): void {
        // Idempotent: skip silently if already registered (safe for hot-reload)
        if (this.tools.has(tool.name)) {
            return;
        }
        this.tools.set(tool.name, tool);
    }

    public static getTool(name: string): AITool | undefined {
        return this.tools.get(name);
    }

    public static hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    public static list(): string[] {
        return Array.from(this.tools.keys());
    }

    public static clear(): void {
        this.tools.clear();
    }

    public static getAllTools(): AITool[] {
        return Array.from(this.tools.values());
    }
}