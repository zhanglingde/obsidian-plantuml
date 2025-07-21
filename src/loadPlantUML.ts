import {DEFAULT_SETTINGS, PlantUMLSettings, PlantUMLSettingsTab} from "./settings";

// loadPlantUML.ts
export async function loadPlantUML(): Promise<void> {
    return new Promise((resolve, reject) => {
        debugger
        const script = document.createElement('script');
        script.src = DEFAULT_SETTINGS.plantumlJsPath + '/plantuml.js'; // 本地路径或 CDN
        script.onload = () => {
            console.log('PlantUML.js 加载完成');
            resolve();
        };
        script.onerror = (e) => {
            console.error('加载 PlantUML.js 失败', e);
            reject(new Error('加载 PlantUML.js 失败'));
        };
        document.head.appendChild(script);
    });
}
