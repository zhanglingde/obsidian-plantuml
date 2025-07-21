// plantuml.d.ts
declare global {
    interface Window {
        plantuml: {
            initialize: (path: string) => Promise<void>;
            renderPng: (content: string) => Promise<Blob>;
            isInitialized?: boolean;
        };
    }
}

export {};
