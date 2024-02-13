import path from 'path';
import { glob } from 'glob';
import { renderHtmlPage, renderSitemap } from "./renderer.js";
import { parseMarkdown } from "./parser.js";

// Load Markdown file and convert it to HTML
export const processFolder = async (
  inputArg,
  outputFolder,
  options = { parser: parseMarkdown, tags, sitemap: true }
) => {
  const parse = options.parser || parseMarkdown;
  const sitemap = options.sitemap || true;
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
    if (sitemap) {
      await renderSitemap(
        pageAttributesList,
        path.join(outputFolder, "sitemap.xml")
      );
    }

    for (const pageAttributes of pageAttributesList) {
      await renderHtmlPage(pageAttributes);
    }
  } catch (err) {
    console.error("Error converting Markdown to HTML:", err);
  }
};