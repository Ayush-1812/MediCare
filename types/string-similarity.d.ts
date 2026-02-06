declare module 'string-similarity' {
    interface Rating {
        target: string;
        rating: number;
    }

    interface BestMatch {
        ratings: Rating[];
        bestMatch: Rating;
        bestMatchIndex: number;
    }

    export function compareTwoStrings(string1: string, string2: string): number;
    export function findBestMatch(mainString: string, targetStrings: string[]): BestMatch;
}
