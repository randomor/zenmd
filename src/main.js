import path from "path";
import { glob } from "glob";
import { renderHtmlPage, renderSitemap } from "./renderer.js";
import { parseMarkdown } from "./parser.js";
import fs from "fs/promises";
import { fileExists } from "./utils.js";
import YAML from "yaml";
import { fileURLToPath } from "url";

const FAVICON_EXTENSIONS = ["ico", "png", "svg", "jpg", "jpeg", "webp", "gif"];
const OG_IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];

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

const extractFirstImageFromHtml = (htmlContent) => {
  // Match <img> tags and extract the src attribute
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/i;
  const match = htmlContent.match(imgRegex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
};

const findOgImageCandidate = async (inputFolder, subDirectory = "") => {
  const searchDirectory = subDirectory
    ? path.join(inputFolder, subDirectory)
    : inputFolder;

  for (const extension of OG_IMAGE_EXTENSIONS) {
    const candidatePath = path.join(searchDirectory, `og_image.${extension}`);
    if (await fileExists(candidatePath)) {
      return { path: candidatePath, extension };
    }
  }

  return null;
};

const copyOgImageToOutput = async (sourcePath, outputFolder, extension) => {
  const outputPath = path.join(outputFolder, `og_image.${extension}`);
  if (path.resolve(sourcePath) === path.resolve(outputPath)) {
    return { outputPath, publicPath: `/og_image.${extension}` };
  }

  await fs.copyFile(sourcePath, outputPath);
  return { outputPath, publicPath: `/og_image.${extension}` };
};

const copyRelativeImageToOutput = async (
  imageSrc,
  inputFolder,
  outputFolder
) => {
  // imageSrc is relative to inputFolder (e.g., "./img_assets/photo.jpg")
  const cleanSrc = imageSrc.replace(/^\.\//, "");
  const sourcePath = path.join(inputFolder, cleanSrc);
  const outputPath = path.join(outputFolder, cleanSrc);

  try {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    // Check if source exists before copying
    if (await fileExists(sourcePath)) {
      // Don't copy if source and destination are the same
      if (path.resolve(sourcePath) !== path.resolve(outputPath)) {
        await fs.copyFile(sourcePath, outputPath);
      }
      return { outputPath, publicPath: `/${cleanSrc}` };
    }
  } catch (error) {
    console.error(`Error copying OG image from ${sourcePath} to ${outputPath}:`, error.message);
  }

  return null;
};

const ensureFallbackOgImage = async (inputFolder, outputFolder) => {
  const directOgImage = await findOgImageCandidate(inputFolder);
  if (directOgImage) {
    return copyOgImageToOutput(
      directOgImage.path,
      outputFolder,
      directOgImage.extension
    );
  }

  const assetsOgImage = await findOgImageCandidate(inputFolder, "assets");
  if (assetsOgImage) {
    return copyOgImageToOutput(
      assetsOgImage.path,
      outputFolder,
      assetsOgImage.extension
    );
  }

  const builtinPath = path.join(__dirname, "static", "og_image.png");
  return copyOgImageToOutput(builtinPath, outputFolder, "png");
};

const resolveOgImageUrl = (ogImageValue, baseUrl, fallbackPublicPath) => {
  if (ogImageValue) {
    if (isAbsoluteUrl(ogImageValue)) {
      return ogImageValue;
    }

    if (baseUrl) {
      if (ogImageValue.startsWith("/")) {
        return joinUrl(baseUrl, ogImageValue);
      }
      return joinUrl(baseUrl, `/${ogImageValue}`);
    }

    return ogImageValue;
  }

  if (!fallbackPublicPath) {
    return undefined;
  }

  if (baseUrl) {
    return joinUrl(baseUrl, fallbackPublicPath);
  }

  return fallbackPublicPath;
};

const resolveOgUrl = (outputFilePath, outputFolder, baseUrl) => {
  if (!baseUrl) {
    return undefined;
  }

  // Compute path relative to output folder
  let relPath = path.relative(outputFolder, outputFilePath);
  // Normalize to forward slashes
  relPath = relPath.replace(/\\/g, "/");
  // Remove index.html and .html extension
  relPath = relPath.replace(/index\.html$/, "");
  relPath = relPath.replace(/\.html$/, "");
  // Ensure leading slash
  const pageUrl = relPath.startsWith("/") ? relPath : `/${relPath}`;

  return joinUrl(baseUrl, pageUrl);
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

    // Process OG images for all pages
    let fallbackOgImage;
    const needsOgImageFallback = pageAttributesList.some(
      (attributes) => {
        const hasPageOgImage = attributes?.frontMatter?.og_image;
        const hasFirstImage = extractFirstImageFromHtml(attributes.content);
        const hasSiteOgImage = globalFrontMatter?.og_image;
        return !hasPageOgImage && !hasFirstImage && !hasSiteOgImage;
      }
    );

    if (needsOgImageFallback) {
      fallbackOgImage = await ensureFallbackOgImage(inputFolder, outputFolder);
    }

    const fallbackOgImagePublicPath = fallbackOgImage?.publicPath;

    const enhancedPageAttributes = await Promise.all(
      pageAttributesList.map(async (attributes) => {
        const resolvedFavicon = resolveFaviconUrl(
          attributes?.frontMatter?.favicon,
          baseUrl,
          fallbackPublicPath
        );

        // Determine OG image with fallback hierarchy
        let ogImageSource = null;
        let isRelativeImage = false;

        // 1. Page-level og_image from frontmatter
        if (attributes?.frontMatter?.og_image) {
          ogImageSource = attributes.frontMatter.og_image;
        }
        // 2. First image found in article
        else {
          const firstImage = extractFirstImageFromHtml(attributes.content);
          if (firstImage) {
            ogImageSource = firstImage;
            isRelativeImage = !isAbsoluteUrl(firstImage);
          }
        }
        // 3. Site-level og_image from site.yaml
        if (!ogImageSource && globalFrontMatter?.og_image) {
          ogImageSource = globalFrontMatter.og_image;
        }
        // 4. Fallback to built-in og_image.png
        if (!ogImageSource && fallbackOgImagePublicPath) {
          ogImageSource = fallbackOgImagePublicPath;
        }

        // If it's a relative image from the content, we need to copy it
        // The image should already be in the output folder from the parser
        // We just need to resolve its public path
        let resolvedOgImage = null;
        if (ogImageSource) {
          if (isRelativeImage && !ogImageSource.startsWith("/")) {
            // The image is already copied by the parser
            // We just need to resolve the URL
            resolvedOgImage = resolveOgImageUrl(
              ogImageSource,
              baseUrl,
              null
            );
          } else if (!isAbsoluteUrl(ogImageSource)) {
            // It's a relative path from frontmatter, need to copy it
            const copied = await copyRelativeImageToOutput(
              ogImageSource,
              inputFolder,
              outputFolder
            );
            if (copied) {
              resolvedOgImage = resolveOgImageUrl(
                copied.publicPath,
                baseUrl,
                null
              );
            }
          } else {
            // It's an absolute URL
            resolvedOgImage = ogImageSource;
          }
        }

        // If we still don't have a resolved OG image, use the fallback
        if (!resolvedOgImage) {
          resolvedOgImage = resolveOgImageUrl(
            null,
            baseUrl,
            fallbackOgImagePublicPath
          );
        }

        // Resolve OG URL for the page
        const ogUrl = resolveOgUrl(
          attributes.outputFilePath,
          outputFolder,
          baseUrl
        );

        const updatedFrontMatter = {
          ...(attributes.frontMatter || {}),
        };

        if (resolvedFavicon) {
          updatedFrontMatter.favicon = resolvedFavicon;
        }

        if (resolvedOgImage) {
          updatedFrontMatter.og_image = resolvedOgImage;
        }

        if (ogUrl) {
          updatedFrontMatter.og_url = ogUrl;
        }

        return {
          ...attributes,
          frontMatter: updatedFrontMatter,
          favicon: resolvedFavicon,
          og_image: resolvedOgImage,
          og_url: ogUrl,
        };
      })
    );

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
