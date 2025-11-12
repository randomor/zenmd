import fs from "fs/promises";
import { findLayout } from "./utils.js";
import mustache from "mustache";
import chalk from "chalk";
import path from "path";

export const renderHtmlPage = async (pageAttributes, layoutOption = 'default') => {
  const {
    title,
    description,
    frontMatter = {},
    content,
    inputFile,
    inputFolder,
    outputFileFolder,
    outputFilePath,
  } = pageAttributes;
  const templatePath = await findLayout(inputFile, inputFolder, layoutOption);
  const template = await fs.readFile(templatePath, "utf8");
  const rendered = mustache.render(template, {
    ...frontMatter,
    title,
    description,
    content,
  });

  try {
    await fs.access(outputFileFolder);
  } catch (error) {
    await fs.mkdir(outputFileFolder, { recursive: true });
  }

  await fs.writeFile(outputFilePath, rendered);

  console.log(chalk.greenBright(`Rendered: ${outputFilePath}`));

  return rendered;
};

export const renderSitemap = async (
  pageAttributesList,
  sitemapPath,
  baseUrl
) => {
  const outputFolder = path.dirname(sitemapPath);
  const sitemap = pageAttributesList
    .map(({ outputFilePath }) => {
      // compute path relative to sitemap folder
      let relPath = path.relative(outputFolder, outputFilePath);
      // normalize to forward slashes
      relPath = relPath.replace(/\\/g, "/");
      // remove index.html and .html
      relPath = relPath.replace(/index\.html$/, "");
      relPath = relPath.replace(/\.html$/, "");
      // ensure leading slash
      const pageUrl = relPath.startsWith("/") ? relPath : `/${relPath}`;
      return `<url><loc>${baseUrl}${pageUrl}</loc></url>`;
    })
    .join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemap}
</urlset>`;

  await fs.writeFile(sitemapPath, sitemapXml);

  console.log(chalk.greenBright(`Rendered Sitemap: ${sitemapPath}`));

  return sitemapXml;
};
