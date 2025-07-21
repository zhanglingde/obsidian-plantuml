import {
    addIcon, Platform,
    Plugin
} from 'obsidian';
import {DEFAULT_SETTINGS, PlantUMLSettings, PlantUMLSettingsTab} from "./settings";
import {LocalProcessors} from "./processors/localProcessors";
import {DebouncedProcessors} from "./processors/debouncedProcessors";
import {LOGO_SVG} from "./const";
import {Processor} from "./processors/processor";
import {ServerProcessor} from "./processors/serverProcessor";
import {Replacer} from "./functions";
import {PumlView, VIEW_TYPE} from "./PumlView";
import localforage from "localforage";
import {PumlEmbed} from "./embed";

// 声明模块
declare module "obsidian" {
    interface Workspace {
        on(
            name: "hover-link",
            callback: (e: MouseEvent) => any,
            ctx?: any,
        ): EventRef;
    }
    interface App {
        embedRegistry: EmbedRegistry;
    }
    interface EmbedRegistry extends Events {
        registerExtensions(extensions: string[], embedCreator: EmbedCreator): void;
        unregisterExtensions(extensions: string[]): void;
    }
    interface EmbedChild extends Component {
        loadFile(): Promise<void>;
    }
    type EmbedCreator = (context: EmbedContext, file: TFile, path?: string) => Component;
    interface EmbedContext {
        app: App;
        containerEl: HTMLElement;
    }
}

export default class PlantumlPlugin extends Plugin {
    // 配置文件
    settings: PlantUMLSettings;

    // 远程 url 处理器
    serverProcessor: Processor;
    // 本地 jar 处理器
    localProcessor: Processor;
    replacer: Replacer;

    observer: MutationObserver;

    public hover: {
        linkText: string;
        sourcePath: string;
    } = {
        linkText: null,
        sourcePath: null,
    };

    getProcessor(): Processor {
        if (Platform.isMobileApp) {
            return this.serverProcessor;
        }
        if (this.settings.localJar.length > 0) {
            return this.localProcessor;
        }
        return this.serverProcessor;
    }

    async onload(): Promise<void> {
        console.log('loading plugin plantuml');
        await this.loadSettings();
        // 1. 加载设置
        this.addSettingTab(new PlantUMLSettingsTab(this));
        // ??? 什么作用
        this.replacer = new Replacer(this);

        this.serverProcessor = new ServerProcessor(this);
        if (Platform.isDesktopApp) {
            this.localProcessor = new LocalProcessors(this);
        }

        // DebouncedProcessors ??? 作用
        const processor = new DebouncedProcessors(this);

        addIcon("document-" + VIEW_TYPE, LOGO_SVG);
        // 注册 View
        this.registerView(VIEW_TYPE, (leaf) => {
            return new PumlView(leaf, this);
        });
        this.registerExtensions(["puml", "pu"], VIEW_TYPE);
        // 注册代码块执行处理方式
        this.registerMarkdownCodeBlockProcessor("plantuml", processor.default);
        this.registerMarkdownCodeBlockProcessor("plantuml-png", processor.png);
        this.registerMarkdownCodeBlockProcessor("plantuml-ascii", processor.ascii);
        this.registerMarkdownCodeBlockProcessor("plantuml-svg", processor.svg);
        this.registerMarkdownCodeBlockProcessor("puml", processor.default);
        this.registerMarkdownCodeBlockProcessor("puml-png", processor.png);
        this.registerMarkdownCodeBlockProcessor("puml-svg", processor.svg);
        this.registerMarkdownCodeBlockProcessor("puml-ascii", processor.ascii);

        //keep this processor for backwards compatibility
        this.registerMarkdownCodeBlockProcessor("plantuml-map", processor.png);

        this.app.embedRegistry.registerExtensions(['puml', 'pu'], (ctx, file, subpath) => new PumlEmbed(this, file, ctx));

        this.cleanupLocalStorage();
        localforage.config({
            name: 'puml',
            description: 'PlantUML plugin'
        });
        await this.cleanupCache();


        //internal links 监听 DOM 变化
        this.observer = new MutationObserver(async (mutation) => {
            if (mutation.length !== 1) return;
            if (mutation[0].addedNodes.length !== 1) return;
            // 当前没有悬停的链接文本，直接返回
            if (this.hover.linkText === null) return;
            //@ts-ignore
            if (mutation[0].addedNodes[0].className !== "popover hover-popover file-embed is-loaded") return;

            // 获取悬停链接指向的文件目标
            const file = this.app.metadataCache.getFirstLinkpathDest(this.hover.linkText, this.hover.sourcePath);
            if (!file) return;
            // 只处理.puml或.pu文件
            if (file.extension !== "puml" && file.extension !== "pu") return;
            // 读取文件内容
            const fileContent = await this.app.vault.read(file);
            // 创建用于显示图像的div
            const imgDiv = createDiv();
            // 根据设置处理文件内容并生成相应图像
            if(this.settings.defaultProcessor === "png") {
                await this.getProcessor().png(fileContent, imgDiv, null);
            }else {
                await this.getProcessor().svg(fileContent, imgDiv, null);
            }

            // 清空触发事件的节点内容，准备插入新内容
            const node: Node = mutation[0].addedNodes[0];
            node.empty();

            // 创建新的div来包裹图像内容，并设置点击事件以在新视图中打开文件
            const div = createDiv("", async (element) => {
                element.appendChild(imgDiv);
                element.setAttribute('src', file.path);
                element.onClickEvent((event => {
                    event.stopImmediatePropagation();
                    const leaf = this.app.workspace.getLeaf(event.ctrlKey);
                    leaf.setViewState({
                        type: VIEW_TYPE,
                        state: {file: file.path}
                    })
                }));
            });
            // 将包含图像内容的div添加到事件节点中
            node.appendChild(div);

        });

        // 注册事件监听器以处理悬停链接事件
        this.registerEvent(this.app.workspace.on("hover-link", async (event: any) => {
            // 获取悬停的链接文本和源路径
            const linkText: string = event.linktext;
            if (!linkText) return;
            const sourcePath: string = event.sourcePath;

            // 只处理以.puml或.pu结尾的链接文本
            if (!linkText.endsWith(".puml") && !linkText.endsWith(".pu")) {
                return;
            }

            // 更新悬停状态
            this.hover.linkText = linkText;
            this.hover.sourcePath = sourcePath;
        }));

        // 开始监听DOM树的变化
        this.observer.observe(document, {childList: true, subtree: true});
    }

    async cleanupCache() {
        await localforage.iterate((value, key) => {
            if(key.startsWith('ts-')) {
                const encoded = key.split('-')[1];
                if(value < new Date().getTime() - (this.settings.cache * 24 * 60 * 60 * 1000)) {
                    localforage.removeItem('png-' + encoded);
                    localforage.removeItem('svg-' + encoded);
                    localforage.removeItem('map-' + encoded);
                    localforage.removeItem('ascii-' + encoded);
                }
            }
        });
    }

    /*
     * older versions used to store generated images in local storage when using local generation.
     * To fix issues with the local storage quota we have to clean this up when upgrading from a version that supported this.
     */
    cleanupLocalStorage() {
        for (const key of Object.keys(localStorage)) {
            if(key.endsWith('-map') || key.endsWith('-png') || key.endsWith('-svg') || key.endsWith('ascii')) {
                localStorage.removeItem(key);
            }
        }
    }

    async onunload(): Promise<void> {
        console.log('unloading plugin plantuml');
        this.observer.disconnect();
        this.app.embedRegistry.unregisterExtensions(['puml', 'pu']);
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    async onExternalSettingsChange() {
        await this.loadSettings();
    }
}
