

// plantumlRenderer.ts
export async function renderPlantUML(pumlContent: string): Promise<string> {
    // 确保 plantuml 已初始化
    if (!(window as any).plantuml) {
        throw new Error('PlantUML is not initialized');
    }

    const plantuml = (window as any).plantuml;

    // 初始化（如果尚未初始化）
    if (!plantuml.isInitialized) {
        await plantuml.initialize('/app/plantuml-wasm');
    }

    const blob: Blob = await plantuml.renderPng(pumlContent);

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // 返回 Base64 数据（包含 data URL 前缀）
            const base64String = reader.result as string;
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}



