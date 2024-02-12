import path from 'path';
import { glob } from 'glob';
import { renderHtmlPage } from "./renderer.js";
import { parseMarkdown } from "./parser.js";

// Load Markdown file and convert it to HTML
export const processFolder = async (
  inputArg,
  outputFolder,
  options = { parser: parseMarkdown, tags, sitemap: true }
) => {
  const parse = options.parser || parseMarkdown;
  try {
    const globOptions = {
      cwd: process.cwd(),
    };
    const isFileArg = inputArg.endsWith(".md");
    const inputFolder = isFileArg ? path.dirname(inputArg) : inputArg;
    const inputGlob = isFileArg ? inputArg : path.join(inputFolder, "**/*.md");
    const files = await glob(inputGlob, globOptions);

    const pageAttributesList = await Promise.all(
      files.map(async (file) => {
        return parse(file, inputFolder, outputFolder, options);
      })
    );

    // render SiteMap
    if (options.sitemap) {
      await generateSitemap(pageAttributesList);
    }

    for (const pageAttributes of pageAttributesList) {
      await renderHtmlPage(pageAttributes);
    }
  } catch (err) {
    console.error("Error converting Markdown to HTML:", err);
  }
};

const generateSitemap = async (pageAttributesList) => {
  const sitemap = pageAttributesList
    .map((pageAttributes) => {
      const pageUrl = pageAttributes.path;
      return `<url><loc>${pageUrl}</loc></url>`;
    })
    .join("\n");

  const sitemapXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${sitemap}
    </urlset>
    `;

  return sitemapXml;
};