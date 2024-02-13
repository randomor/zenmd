import fs from 'fs/promises';
import { findLayout } from "./utils.js";
import mustache from "mustache";
import chalk from "chalk";

export const renderHtmlPage = async (pageAttributes) => {
  const {
    title,
    content,
    inputFile,
    inputFolder,
    outputFileFolder,
    outputFilePath,
  } = pageAttributes;
  const templatePath = await findLayout(inputFile, inputFolder);
  const template = await fs.readFile(templatePath, "utf8");
  const rendered = mustache.render(template, { title, content });

  try {
    await fs.access(outputFileFolder);
  } catch (error) {
    await fs.mkdir(outputFileFolder, { recursive: true });
  }

  await fs.writeFile(outputFilePath, rendered);

  console.log(chalk.greenBright(`Rendered: ${outputFilePath}`));

  return rendered;
};

export const renderSitemap = async (pageAttributesList, sitemapPath) => {
  const sitemap = pageAttributesList
    .map((pageAttributes) => {
      const { outputFileFolder, outputFilePath } = pageAttributes;
      // pageUrl is the relative path to the output fileFolder
      // also remove .html and index.html from the url and normalize the path
      const pageUrl = outputFilePath
        .replace(outputFileFolder, "")
        .replace(/(\\|\/)/g, "/")
        .replace(/index.html$/, "")
        .replace(/\.html$/, "");
      return `<url><loc>${pageUrl}</loc></url>`;
    })
    .join("\n");

  const sitemapXml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ${sitemap}
      </urlset>
      `;

  await fs.writeFile(sitemapPath, sitemapXml);

  console.log(chalk.greenBright(`Rendered Sitemap: ${sitemapPath}`));

  return sitemapXml;
};
