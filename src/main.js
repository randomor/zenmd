import path from "path";
import { glob } from "glob";
import { renderHtmlPage, renderSitemap } from "./renderer.js";
import { parseMarkdown } from "./parser.js";
import fs from "fs/promises";
import { fileExists } from "./utils.js";
import YAML from "yaml";
import { fileURLToPath } from "url";

const FAVICON_EXTENSIONS = ["ico", "png", "svg", "jpg", "jpeg", "webp", "gif"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadSiteFrontMatter = async (inputFolder) => {
  const siteConfigPath = path.join(inputFolder, "site.yaml");
  if (!(await fileExists(siteConfigPath))) {
    return {};
  }

  try {
    const siteConfigContent = await fs.readFile(siteConfigPath, "utf8");
    const parsedConfig = YAML.parse(siteConfigContent) || {};
    if (
      parsedConfig &&
      typeof parsedConfig === "object" &&
      parsedConfig.front_matter &&
      typeof parsedConfig.front_matter === "object"
    ) {
      return parsedConfig.front_matter;
    }
  } catch (error) {
    console.error("Error reading site.yaml:", error);
  }

  return {};
};

const findFaviconCandidate = async (inputFolder, subDirectory = "") => {
  const searchDirectory = subDirectory
    ? path.join(inputFolder, subDirectory)
    : inputFolder;

  for (const extension of FAVICON_EXTENSIONS) {
    const candidatePath = path.join(searchDirectory, `favicon.${extension}`);
    if (await fileExists(candidatePath)) {
      return { path: candidatePath, extension };
    }
  }

  return null;
};

const copyFaviconToOutput = async (sourcePath, outputFolder, extension) => {
  const outputPath = path.join(outputFolder, `favicon.${extension}`);
  if (path.resolve(sourcePath) === path.resolve(outputPath)) {
    return { outputPath, publicPath: `/favicon.${extension}` };
  }

  await fs.copyFile(sourcePath, outputPath);
  return { outputPath, publicPath: `/favicon.${extension}` };
};

const ensureFallbackFavicon = async (inputFolder, outputFolder) => {
  const directFavicon = await findFaviconCandidate(inputFolder);
  if (directFavicon) {
    return copyFaviconToOutput(
      directFavicon.path,
      outputFolder,
      directFavicon.extension
    );
  }

  const assetsFavicon = await findFaviconCandidate(inputFolder, "assets");
  if (assetsFavicon) {
    return copyFaviconToOutput(
      assetsFavicon.path,
      outputFolder,
      assetsFavicon.extension
    );
  }

  const builtinPath = path.join(__dirname, "static", "favicon.png");
  return copyFaviconToOutput(builtinPath, outputFolder, "png");
};

const isAbsoluteUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

const joinUrl = (base, pathPart) => {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  if (pathPart.startsWith("/")) {
    return `${normalizedBase}${pathPart}`;
  }
  return `${normalizedBase}/${pathPart}`;
};

const resolveFaviconUrl = (faviconValue, baseUrl, fallbackPublicPath) => {
  if (faviconValue) {
    if (isAbsoluteUrl(faviconValue)) {
      return faviconValue;
    }

    if (baseUrl) {
      if (faviconValue.startsWith("/")) {
        return joinUrl(baseUrl, faviconValue);
      }
      return joinUrl(baseUrl, `/${faviconValue}`);
    }

    return faviconValue;
  }

  if (!fallbackPublicPath) {
    return undefined;
  }

  if (baseUrl) {
    return joinUrl(baseUrl, fallbackPublicPath);
  }

  return fallbackPublicPath;
};

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

    const globalFrontMatter = await loadSiteFrontMatter(inputFolder);
    const parseOptions = { ...options, globalFrontMatter };
    delete parseOptions.parser;
    delete parseOptions.renderHtmlPage;
    delete parseOptions.renderSitemap;

    const pagePromises = files.map((file) =>
      parse(file, inputFolder, outputFolder, parseOptions)
    );
    const pageAttributesList = (await Promise.all(pagePromises)).filter(Boolean);

    let fallbackFavicon;
    const needsFaviconFallback = pageAttributesList.some(
      (attributes) => !attributes?.frontMatter?.favicon
    );

    if (needsFaviconFallback) {
      fallbackFavicon = await ensureFallbackFavicon(inputFolder, outputFolder);
    }

    const fallbackPublicPath = fallbackFavicon?.publicPath;

    const enhancedPageAttributes = pageAttributesList.map((attributes) => {
      const resolvedFavicon = resolveFaviconUrl(
        attributes?.frontMatter?.favicon,
        baseUrl,
        fallbackPublicPath
      );

      const updatedFrontMatter = {
        ...(attributes.frontMatter || {}),
      };

      if (resolvedFavicon) {
        updatedFrontMatter.favicon = resolvedFavicon;
      }

      return {
        ...attributes,
        frontMatter: updatedFrontMatter,
        favicon: resolvedFavicon,
      };
    });

    // render SiteMap
    if (sitemap && baseUrl) {
      await renderSitemapFn(
        enhancedPageAttributes,
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

    for (const pageAttributes of enhancedPageAttributes) {
      await renderHtmlPageFn(pageAttributes, options.layout);
    }
  } catch (err) {
    console.error("Error converting Markdown to HTML:", err);
  }
};
