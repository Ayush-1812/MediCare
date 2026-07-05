export function deepCleanData(obj: any): any {
    if (obj === null || obj === undefined) {
        return undefined;
    }

    if (obj instanceof Date) {
        return obj.toISOString();
    }

    if (Array.isArray(obj)) {
        const cleanedArray = obj
            .map(item => deepCleanData(item))
            .filter(item => item !== undefined && item !== null);
        return cleanedArray.length > 0 ? cleanedArray : undefined;
    }

    if (typeof obj === 'object') {
        const cleanedObj: Record<string, any> = {};
        let hasKeys = false;

        for (const [key, value] of Object.entries(obj)) {
            // Strip out internal IDs and Prisma specific relational IDs
            if (key.toLowerCase() === 'id' || key.toLowerCase() === 'userid' || key.toLowerCase() === 'docid') {
                continue;
            }

            // Remove Prisma timestamps if not relevant
            if (key === 'createdAt' || key === 'updatedAt') {
                continue;
            }

            const cleanedValue = deepCleanData(value);
            if (cleanedValue !== undefined) {
                cleanedObj[key] = cleanedValue;
                hasKeys = true;
            }
        }

        return hasKeys ? cleanedObj : undefined;
    }

    return obj;
}
