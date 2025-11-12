import path from "path";
import { glob } from "glob";
import { renderHtmlPage, renderSitemap } from "./renderer.js";
import { parseMarkdown } from "./parser.js";
import fs from "fs/promises";
import { fileExists, deepMerge } from "./utils.js";
import YAML from "yaml";
import { fileURLToPath } from "url";
import chalk from "chalk";

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

const ensureFallbackOgImage = async (outputFolder) => {
  const builtinPath = path.join(__dirname, "static", "og_image.png");
  const outputPath = path.join(outputFolder, "og_image.png");
  
  if (path.resolve(builtinPath) === path.resolve(outputPath)) {
    return { outputPath, publicPath: "/og_image.png" };
  }

  await fs.copyFile(builtinPath, outputPath);
  return { outputPath, publicPath: "/og_image.png" };
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

const stripLeadingDotSlash = (value) => {
  if (typeof value !== "string") {
    return value;
  }

  let normalized = value;
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  return normalized;
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

const copyOgImageToOutput = async (
  sourcePath,
  outputFileFolder,
  relativePath
) => {
  const normalizedRelativePath =
    stripLeadingDotSlash(relativePath) || relativePath;
  const outputPath = path.join(outputFileFolder, normalizedRelativePath);
  
  if (path.resolve(sourcePath) === path.resolve(outputPath)) {
    return { outputPath, relativePath: normalizedRelativePath };
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.copyFile(sourcePath, outputPath);
  return { outputPath, relativePath: normalizedRelativePath };
};

const resolveOgImageForPage = async (
  pageAttributes,
  siteFrontMatter,
  baseUrl,
  fallbackOgImage
) => {
  const {
    pageFrontMatter,
    firstImageRelative,
    inputFile,
    inputFolder,
    outputFileFolder,
  } = pageAttributes;

  // 1. Check page front matter ogImage
  if (pageFrontMatter?.ogImage) {
    const ogImageValue = pageFrontMatter.ogImage;
    
    if (isAbsoluteUrl(ogImageValue)) {
      // Absolute URL: use as-is
      return ogImageValue;
    }
    
    // Relative path: copy from input file dir to output
    const currentFileDir = path.dirname(inputFile);
    const sourceImagePath = path.resolve(currentFileDir, ogImageValue);
    
    try {
      await fs.access(sourceImagePath);
      const copied = await copyOgImageToOutput(
        sourceImagePath,
        outputFileFolder,
        ogImageValue
      );
      
      if (baseUrl) {
        const urlPath = copied.relativePath.startsWith("/") 
          ? copied.relativePath 
          : `/${copied.relativePath}`;
        return joinUrl(baseUrl, urlPath);
      }
      return `./${copied.relativePath}`;
    } catch (error) {
      console.error(
        chalk.yellow(
          `Warning: ogImage "${ogImageValue}" not found at ${sourceImagePath}`
        )
      );
    }
  }

  // 2. Check first image from markdown content
  if (firstImageRelative) {
    const normalizedFirstImageRelative =
      stripLeadingDotSlash(firstImageRelative);

    if (baseUrl) {
      const urlPath = normalizedFirstImageRelative.startsWith("/")
        ? normalizedFirstImageRelative
        : `/${normalizedFirstImageRelative}`;
      return joinUrl(baseUrl, urlPath);
    }
    return `./${normalizedFirstImageRelative}`;
  }

  // 3. Check global front matter ogImage
  if (siteFrontMatter?.ogImage) {
    const ogImageValue = siteFrontMatter.ogImage;
    
    if (isAbsoluteUrl(ogImageValue)) {
      return ogImageValue;
    }
    
    // Try to find relative to input folder (strip leading / if present)
    const relativeOgImageValue = ogImageValue.startsWith("/") 
      ? ogImageValue.slice(1) 
      : ogImageValue;
    const sourceImagePath = path.resolve(inputFolder, relativeOgImageValue);
    
    try {
      await fs.access(sourceImagePath);
      const copied = await copyOgImageToOutput(
        sourceImagePath,
        outputFileFolder,
        ogImageValue
      );
      
      if (baseUrl) {
        const urlPath = copied.relativePath.startsWith("/") 
          ? copied.relativePath 
          : `/${copied.relativePath}`;
        return joinUrl(baseUrl, urlPath);
      }
      return `./${copied.relativePath}`;
    } catch (error) {
      console.error(
        chalk.yellow(
          `Warning: global ogImage "${ogImageValue}" not found at ${sourceImagePath}`
        )
      );
    }
  }

  // 4. Use built-in fallback
  if (fallbackOgImage) {
    if (baseUrl) {
      return joinUrl(baseUrl, fallbackOgImage.publicPath);
    }
    return fallbackOgImage.publicPath;
  }

  return undefined;
};

const computeOgUrl = (outputFilePath, inputFolder, outputFolder, baseUrl) => {
  if (!baseUrl) {
    return undefined;
  }

  const relativePath = path.relative(outputFolder, outputFilePath);
  let urlPath = relativePath.replace(/\\/g, "/");
  
  // Remove .html extension
  if (urlPath.endsWith(".html")) {
    urlPath = urlPath.slice(0, -5);
  }
  
  // For index pages, use trailing slash
  if (urlPath.endsWith("/index") || urlPath === "index") {
    urlPath = urlPath.replace(/index$/, "");
  }
  
  // Ensure leading slash
  if (!urlPath.startsWith("/")) {
    urlPath = "/" + urlPath;
  }
  
  return joinUrl(baseUrl, urlPath);
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

    const siteFrontMatter = await loadSiteFrontMatter(inputFolder);
    const parseOptions = {
      ...options,
      siteFrontMatter,
    };
    delete parseOptions.parser;
    delete parseOptions.renderHtmlPage;
    delete parseOptions.renderSitemap;

    const pagePromises = files.map((file) =>
      parse(file, inputFolder, outputFolder, parseOptions)
    );
    const pageAttributesList = (await Promise.all(pagePromises)).filter(Boolean);

    let fallbackFavicon;
    const siteHasFavicon = Boolean(siteFrontMatter?.favicon);
    const needsFaviconFallback =
      !siteHasFavicon &&
      pageAttributesList.some(
        (attributes) => !attributes?.pageFrontMatter?.favicon
      );

    if (needsFaviconFallback) {
      fallbackFavicon = await ensureFallbackFavicon(inputFolder, outputFolder);
    }

    const fallbackPublicPath = fallbackFavicon?.publicPath;

    // Ensure fallback OG image is available
    const fallbackOgImage = await ensureFallbackOgImage(outputFolder);

    // Resolve OG images and URLs for all pages
    const ogImagePromises = pageAttributesList.map((attributes) =>
      resolveOgImageForPage(
        attributes,
        siteFrontMatter,
        baseUrl,
        fallbackOgImage
      )
    );
    const resolvedOgImages = await Promise.all(ogImagePromises);

    const enhancedPageAttributes = pageAttributesList.map((attributes, index) => {
      const pageFrontMatter = attributes.pageFrontMatter || {};
      const effectiveFrontMatter = deepMerge(
        {},
        siteFrontMatter || {},
        pageFrontMatter
      );

      const faviconSource =
        pageFrontMatter?.favicon ?? siteFrontMatter?.favicon;
      const resolvedFavicon = resolveFaviconUrl(
        faviconSource,
        baseUrl,
        fallbackPublicPath
      );

      const resolvedOgImage = resolvedOgImages[index];
      const ogUrl = computeOgUrl(
        attributes.outputFilePath,
        inputFolder,
        outputFolder,
        baseUrl
      );

      if (resolvedFavicon) {
        effectiveFrontMatter.favicon = resolvedFavicon;
      }

      if (resolvedOgImage) {
        effectiveFrontMatter.ogImage = resolvedOgImage;
      }

      if (ogUrl) {
        effectiveFrontMatter.ogUrl = ogUrl;
      }

      const resolvedTitle =
        effectiveFrontMatter.title || attributes.title;
      const resolvedDescription =
        effectiveFrontMatter.description ||
        attributes.description ||
        `A page about ${resolvedTitle}`;

      return {
        ...attributes,
        title: resolvedTitle,
        description: resolvedDescription,
        siteFrontMatter,
        pageFrontMatter,
        frontMatter: effectiveFrontMatter,
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
