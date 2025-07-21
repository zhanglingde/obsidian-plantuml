/**
 * replace all non-breaking spaces with actual spaces
 * @param text
 * @param path
 */
import {MarkdownPostProcessorContext} from "obsidian";
import PlantumlPlugin from "./main";

export class Replacer {
    plugin: PlantumlPlugin;

    constructor(plugin: PlantumlPlugin) {
        this.plugin = plugin;
    }

    public decodeWhiteSpaces(text: string): string {
        return text.replace(/&nbsp;/gi, " ");
    }

    /**
     * replace all links in the plugin syntax with valid plantuml links to note inside the vault
     * @param text the text, in which to replace all links
     * @param path path of the current file
     * @param filetype
     */
    public replaceLinks(text: string, path: string, filetype: string) : string {
        return text.replace(/\[\[\[([\s\S]*?)\]\]\]/g, ((_, args) => {
            const split = args.split("|");
            const file = this.plugin.app.metadataCache.getFirstLinkpathDest(split[0], path);
            if(!file) {
                return "File with name: " + split[0] + " not found";
            }
            let alias = file.basename;
            if(filetype === "png") {
                //@ts-ignore
                const url = this.plugin.app.getObsidianUrl(file);
                if (split[1]) {
                    alias = split[1];
                }
                return "[[" + url + " " + alias + "]]";
            }
            return "[[" + file.basename + "]]";
        }));
    }

    /**
     * get the absolute path on the users computer
     * @param path vault local path
     */
    public getFullPath(path: string) {
        if (path.length === 0) {
            //@ts-ignore
            return this.plugin.app.vault.adapter.getFullPath("");
        }
        const file = this.plugin.app.vault.getAbstractFileByPath(path);

        if(!file) {
            //@ts-ignore
            return this.plugin.app.vault.adapter.getFullPath("");
        }

        //@ts-ignore
        const folder = this.plugin.app.vault.getDirectParent(file);
        //@ts-ignore
        return this.plugin.app.vault.adapter.getFullPath(folder.path);
    }

    public getPath(ctx: MarkdownPostProcessorContext) {
        return this.getFullPath(ctx ? ctx.sourcePath : '');
    }

}

export function insertImageWithMap(el: HTMLElement, image: string, map: string, encodedDiagram: string) {
    // 清空元素el的内容，以为后续添加新的图像元素做准备
    el.empty();

    // 创建一个新的图像元素
    const img = document.createElement("img");
    if(image.startsWith("http")) {
        img.src = image;
    }else {  // 本地: data:image/png;base64, base64编码的图像数据
        img.src = "data:image/png;base64," + image;
    }
    // 设置图像元素的useMap属性，使其关联到特定的图像映射
    img.useMap = "#" + encodedDiagram;

    // 如果map中包含映射信息，则更新el的HTML内容，并设置第一个子元素的name属性
    if (map.contains("map")) {
        el.innerHTML = map;
        el.children[0].setAttr("name", encodedDiagram);
    }
    // 将创建的图像元素添加到el中
    el.appendChild(img);
}

export function insertAsciiImage(el: HTMLElement, image: string) {
    el.empty();

    const pre = document.createElement("pre");
    const code = document.createElement("code");
    pre.appendChild(code);
    code.setText(image);
    el.appendChild(pre);
}

export function insertSvgImage(el: HTMLElement, image: string) {
    el.empty();
    const parser = new DOMParser();
    // 使用 parser 解析 SVG 图像字符串
    const svg = parser.parseFromString(image, "image/svg+xml");

    // 获取SVG中所有的链接元素（实际获取到的是空 ?? 什么场景会用到）
    const links = svg.getElementsByTagName("a");
    // 遍历每个链接元素
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        // 为当前链接元素添加内部链接样式类
        link.addClass("internal-link");
    }
    // 将SVG元素的HTML代码插入到指定元素的末尾
    el.insertAdjacentHTML('beforeend', svg.documentElement.outerHTML);


}
