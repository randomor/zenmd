import path from 'path';
import { glob } from 'glob';
import { renderHtmlPage, renderSitemap } from "./renderer.js";
import { parseMarkdown } from "./parser.js";
import fs from "fs/promises";
import { fileExists } from "./utils.js";

// Load Markdown file and convert it to HTML
export const processFolder = async (
  inputArg,
  outputFolder,
  options = { parser: parseMarkdown, tags, sitemap: true, baseUrl }
) => {
  const parse = options.parser || parseMarkdown;
  const sitemap = options.sitemap || true;
  const baseUrl = options.baseUrl;
  try {
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
      await renderSitemap(
        pageAttributesList,
        path.join(outputFolder, "sitemap.xml"),
        baseUrl
      );
    }

    // generate robots.txt that allows everything if none exists in output folder
    const robotsOutputPath = path.join(outputFolder, "robots.txt");
    if (!(await fileExists(robotsOutputPath))) {
      await fs.writeFile(robotsOutputPath, "User-agent: *\nDisallow:");
    }

    for (const pageAttributes of pageAttributesList) {
      await renderHtmlPage(pageAttributes);
    }
  } catch (err) {
    console.error("Error converting Markdown to HTML:", err);
  }
};