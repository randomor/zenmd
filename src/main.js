import path from "path";
import { glob } from "glob";
import { renderHtmlPage, renderSitemap } from "./renderer.js";
import { parseMarkdown } from "./parser.js";
import fs from "fs/promises";
import { fileExists } from "./utils.js";

// Load Markdown file and convert it to HTML
export const processFolder = async (inputArg, outputFolder, options = {}) => {
  const parse = options.parser || parseMarkdown;
  const sitemap = options.sitemap !== undefined ? options.sitemap : true;
  const baseUrl = options.baseUrl;
  const renderSitemapFn = options.renderSitemap || renderSitemap;
  const renderHtmlPageFn = options.renderHtmlPage || renderHtmlPage;
  try {
    // Ensure the output directory exists to allow writing robots.txt
    await fs.mkdir(outputFolder, { recursive: true });
    const globOptions = {
      cwd: process.cwd(),
    };
    const isFileArg = inputArg.endsWith(".md");
    const inputFolder = isFileArg ? path.dirname(inputArg) : inputArg;
    const inputGlob = isFileArg ? inputArg : path.join(inputFolder, "**/*.md");
    const files = await glob(inputGlob, globOptions);

    const pageAttributesList = await Promise.all(
      files
        .map(async (file) => {
          return parse(file, inputFolder, outputFolder, options);
        })
        .filter((pageAttributes) => pageAttributes)
    );

    // render SiteMap
    if (sitemap && baseUrl) {
      await renderSitemapFn(
        pageAttributesList,
        path.join(outputFolder, "sitemap.xml"),
        baseUrl
      );
    }

    // generate robots.txt that allows everything if none exists in output folder
    const robotsOutputPath = path.join(outputFolder, "robots.txt");
    if (!(await fileExists(robotsOutputPath))) {
      try {
        await fs.writeFile(robotsOutputPath, "User-agent: *\nDisallow:");
      } catch (err) {
        console.error("Error writing robots.txt:", err);
      }
    }

    for (const pageAttributes of pageAttributesList) {
      await renderHtmlPageFn(pageAttributes, options.layout);
    }
  } catch (err) {
    console.error("Error converting Markdown to HTML:", err);
  }
};
