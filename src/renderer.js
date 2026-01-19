import fs from "fs/promises";
import { findLayout } from "./utils.js";
import mustache from "mustache";
import chalk from "chalk";
import { collectSitemapPaths } from "./sitemap.js";

const escapeXmlValue = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
};

const wrapCdata = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  const safeValue = String(value).replace(/]]>/g, "]]]]><![CDATA[>");
  return `<![CDATA[${safeValue}]]>`;
};

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
  sitemapTree,
  sitemapPath,
  baseUrl
) => {
  const sitemap = collectSitemapPaths(sitemapTree)
    .map((relativePath) => `<url><loc>${baseUrl}${relativePath}</loc></url>`)
    .join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${sitemap}
</urlset>`;

  await fs.writeFile(sitemapPath, sitemapXml);

  console.log(chalk.greenBright(`Rendered Sitemap: ${sitemapPath}`));

  return sitemapXml;
};

export const renderRss = async (rssItems, rssPath, rssConfig) => {
  const {
    title,
    link,
    description,
    language,
    generator,
    copyright,
    image,
    lastBuildDate,
  } = rssConfig;

  const imageBlock = image
    ? `
    <image>
      <url>${escapeXmlValue(image)}</url>
      <title>${escapeXmlValue(title)}</title>
      <link>${escapeXmlValue(link)}</link>
    </image>`
    : "";

  const items = rssItems
    .map((item) => {
      const categories = (item.categories || [])
        .map((category) => `<category>${escapeXmlValue(category)}</category>`)
        .join("\n      ");
      return `
    <item>
      <title>${escapeXmlValue(item.title)}</title>
      <link>${escapeXmlValue(item.link)}</link>
      <guid>${escapeXmlValue(item.guid || item.link)}</guid>
      <pubDate>${escapeXmlValue(item.pubDate)}</pubDate>
      <description>${wrapCdata(item.description || "")}</description>${categories ? `\n      ${categories}` : ""}
    </item>`;
    })
    .join("");

  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXmlValue(title)}</title>
    <link>${escapeXmlValue(link)}</link>
    <description>${wrapCdata(description || "")}</description>
    ${language ? `<language>${escapeXmlValue(language)}</language>` : ""}
    ${lastBuildDate ? `<lastBuildDate>${escapeXmlValue(lastBuildDate)}</lastBuildDate>` : ""}
    ${generator ? `<generator>${escapeXmlValue(generator)}</generator>` : ""}
    ${copyright ? `<copyright>${escapeXmlValue(copyright)}</copyright>` : ""}${imageBlock}
    ${items}
  </channel>
</rss>`;

  await fs.writeFile(rssPath, rssXml);

  console.log(chalk.greenBright(`Rendered RSS: ${rssPath}`));

  return rssXml;
};
