import {MarkdownPostProcessorContext, request} from "obsidian";
import {DEFAULT_SETTINGS} from "../settings";
import * as plantuml from "plantuml-encoder";
import PlantumlPlugin from "../main";
import {Processor} from "./processor";
import {insertAsciiImage, insertImageWithMap, insertSvgImage} from "../functions";

export class ServerProcessor implements Processor {
    plugin: PlantumlPlugin;

    constructor(plugin: PlantumlPlugin) {
        this.plugin = plugin;
    }

    svg = async(source: string, el: HTMLElement, _: MarkdownPostProcessorContext) => {
        //make sure url is defined. once the setting gets reset to default, an empty string will be returned by settings
        let url = this.plugin.settings.server_url;
        if (url.length == 0) {
            url = DEFAULT_SETTINGS.server_url;
        }
        // debugger
        const imageUrlBase = url + "/svg/";
        const encodedDiagram = plantuml.encode(source);
        request({url: imageUrlBase + encodedDiagram, method: 'GET'}).then((value: string) => {
            // value 为 <svg> 标签 ，包含元素的坐标，颜色等信息
            insertSvgImage(el, value);
        }).catch((error: Error) => {
            if (error)
                console.error(error);
        });
    };

    png = async(source: string, el: HTMLElement, _: MarkdownPostProcessorContext) => {
        //make sure url is defined. once the setting gets reset to default, an empty string will be returned by settings
        let url = this.plugin.settings.server_url;
        if (url.length == 0) {
            url = DEFAULT_SETTINGS.server_url;
        }
        // https://www.plantuml.com/plantuml/png/
        const imageUrlBase = url + "/png/";
        // base64 编码
        const encodedDiagram = plantuml.encode(source);
        const image = imageUrlBase + encodedDiagram;

        //get image map data to support clicking links in diagrams
        // https://www.plantuml.com/plantuml/map/
        const mapUrlBase = url + "/map/";
        // <img> 标签的 map 属性
        const map = await request({url: mapUrlBase + encodedDiagram, method: "GET"});

        insertImageWithMap(el, image, map, encodedDiagram);
    }
    ascii = async(source: string, el: HTMLElement, _: MarkdownPostProcessorContext) => {
        //make sure url is defined, once the setting gets reset to default, an empty string will be returned by settings
        let url = this.plugin.settings.server_url;
        if (url.length == 0) {
            url = DEFAULT_SETTINGS.server_url;
        }
        const asciiUrlBase = url + "/txt/";
        const encodedDiagram = plantuml.encode(source);
        debugger
        const result = await request({url: asciiUrlBase + encodedDiagram});

        if (result.startsWith("�PNG")) {
            const text = document.createElement("p");
            text.style.color = "red";
            text.innerText = "Your configured PlantUML Server does not support ASCII Art";
            el.appendChild(text);
            return;
        }

        insertAsciiImage(el, result);
    }
}
