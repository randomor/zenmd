import fs from "fs/promises";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import remarkWikiLink from "remark-wiki-link";
import remarkFrontmatter from "remark-frontmatter";
import remarkParseFrontmatter from "remark-parse-frontmatter";
import remarkToc from "remark-toc";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeInferTitleMeta from "rehype-infer-title-meta";
import path from "path";
import chalk from "chalk";
import { unified } from "unified";
import { visit } from "unist-util-visit";
// Sync fs functions removed as findImageRecursiveSync is being removed
import { normalizePath, isUrl, findImageRecursive } from "./utils.js";

export const configParser = (
  currentFile,
  inputFolder,
  outputFileFolder,
  imageDir = "",
  options = {}
) => {
  const { cleanLink = false } = options;
  const relativePathToInputFolder = path.relative(
    path.dirname(currentFile),
    inputFolder
  );

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkParseFrontmatter)
    // 1. remarkWikiLink: Handles [[wikiLinks]] and outputs 'wikiLink' mdast nodes.
    // Obsidian-style ![[...]] image embeds are already converted to standard
    // Markdown images in parseMarkdown, so remark-wiki-link only sees wiki links.
    .use(remarkWikiLink, {
      pageResolver: (name) => [
        path.join(relativePathToInputFolder, normalizePath(name)),
      ],
      hrefTemplate: (permalink) =>
        cleanLink ? permalink : `${permalink}.html`, // Only for non-embed links
    })
    // 2. remarkGfm: Standard GFM processing.
    // Obsidian image embeds are pre-processed into standard Markdown images in
    // parseMarkdown, so no special remark plugin is needed for them here.
    .use(remarkGfm)
    // 3. remarkToc: Generate table of contents when a `## Contents` or
    //    `## Table of contents` heading is present.
    .use(remarkToc)
    // 4. Custom image attributes parser: Adds support for attribute syntax like {#id .class key=value}
    // This allows decorating images and other elements with custom attributes.
    // Example: ![Cat](cat.png){#hero-cat .rounded width=320 height=240}
    .use(() => (tree, file) => {
      const source = String(file);

      visit(tree, "paragraph", (paragraph) => {
        if (!paragraph.children) return;

        for (let i = 0; i < paragraph.children.length; i++) {
          const node = paragraph.children[i];

          if (node.type !== "image" || !node.position) continue;

          const start = node.position.end.offset;
          const remaining = source.slice(start);

          // Check if there's an attribute block right after the image
          const attrMatch = remaining.match(/^\{([^}]+)\}/);
          if (!attrMatch) continue;

          const attrString = attrMatch[1];
          const attrs = {};
          const classes = [];

          // Parse attributes: #id, .class, key=value, key="value with spaces"
          const attrRegex = /(#[\w-]+)|(\.[\w-]+)|([\w-]+)=(?:"([^"]*)"|'([^']*)'|([\S]+))/g;
          let match;

          while ((match = attrRegex.exec(attrString)) !== null) {
            if (match[1]) {
              // #id
              attrs.id = match[1].slice(1);
            } else if (match[2]) {
              // .class
              classes.push(match[2].slice(1));
            } else if (match[3]) {
              // key=value (match[3] is the key)
              const key = match[3];
              // Value can be in match[4] (double quotes), match[5] (single quotes), or match[6] (unquoted)
              const value = match[4] !== undefined ? match[4] : (match[5] !== undefined ? match[5] : match[6]);
              attrs[key] = value;
            }
          }

          if (classes.length > 0) {
            attrs.className = classes.join(' ');
          }

          // Store attributes in data.hProperties for rehype
          if (!node.data) node.data = {};
          if (!node.data.hProperties) node.data.hProperties = {};
          Object.assign(node.data.hProperties, attrs);

          // Remove the attribute block from the next text node if it starts with {
          const nextNode = paragraph.children[i + 1];
          if (nextNode && nextNode.type === "text" && nextNode.value) {
            const textAttrMatch = nextNode.value.match(/^\{[^}]+\}/);
            if (textAttrMatch) {
              nextNode.value = nextNode.value.slice(textAttrMatch[0].length);
              // If the text node is now empty, remove it
              if (nextNode.value === "") {
                paragraph.children.splice(i + 1, 1);
              }
            }
          }
        }
      });
    })
    // 5. Link normalizer for .md extensions in standard links.
    .use(() => (tree) => {
      visit(tree, "link", (node) => {
        if (!isUrl(node.url) && node.url.match(/\.md$/)) {
          node.url = normalizePath(node.url).replace(/\.md$/, ".html");
        }
      });
    })
    // 6. Standard Markdown image URL decoder: For standard ![]() images,
    // ensures URL is decoded. Path remains relative to the MD file.
    .use(() => (tree) => {
      visit(tree, "image", (node) => {
        if (node.url && !isUrl(node.url)) {
          node.url = decodeURI(node.url);
        }
      });
    })
    // 7. remarkRehype: Converts Markdown AST (mdast) to HTML AST (hast).
    // 'html' mdast nodes (from remarkObsidianImageEmbeds) will be passed through.
    // 'image' mdast nodes will be converted to <img> elements in hast.
    .use(remarkRehype, { allowDangerousHtml: true })
    // 8. rehypeRaw: Parses raw HTML content within the hast.
    // This is crucial for the <img> tags generated by remarkObsidianImageEmbeds
    // to become actual 'element' nodes in the hast.
    .use(rehypeRaw)
    // 9. rehypeSlug: Adds 'id' attributes to headings.
    .use(rehypeSlug)
    // 10. Unified Rehype Image Processor: Handles all <img> elements in the hast.
    // This plugin copies image files and adjusts their 'src' paths.
    .use(() => (tree) => {
      const promises = [];
      visit(tree, "element", (node) => {
        if (
          node.tagName === "img" &&
          node?.properties?.src &&
          !isUrl(node.properties.src)
        ) {
          const imageSrcOriginal = node.properties.src;
          const decodedUrl = decodeURI(imageSrcOriginal); // Path relative to MD file (e.g., "image.png" or "assets/image.png")

          // targetHref is path relative to output HTML file's directory, including imageDir and original subdirectories.
          // E.g., if imageDir="img_assets", decodedUrl="sub/pic.png", then targetHref="img_assets/sub/pic.png".
          // If imageDir="", decodedUrl="foo/bar.png", targetHref="foo/bar.png".
          const targetHref = path.join(imageDir, decodedUrl).replace(/\\/g, "/");

          const outputPathAbsolute = path.join(outputFileFolder, targetHref);
          const currentFileDir = path.dirname(currentFile);
          const sourceImagePathAbsolute = path.resolve(currentFileDir, decodedUrl);

          promises.push(
            fs.mkdir(path.dirname(outputPathAbsolute), { recursive: true })
              .then(() => fs.copyFile(sourceImagePathAbsolute, outputPathAbsolute))
              .catch(error => {
                console.error(
                  chalk.red(
                    `Error copying image from ${sourceImagePathAbsolute} to ${outputPathAbsolute}: ${error.message}`
                  )
                );
                // Optionally rethrow or handle error
              })
          );
          // Update the src to be relative to the HTML file's location, with URL encoding for path segments
          const encodedTargetHref = targetHref.split('/').map(encodeURIComponent).join('/');
          node.properties.src = `./${encodedTargetHref}`;
        }
      });
      if (promises.length > 0) {
        return Promise.all(promises).then(() => tree);
      }
      return tree;
    })
    .use(rehypeAutolinkHeadings, {
      behavior: "append",
    })
    .use(rehypeInferTitleMeta)
    .use(rehypeStringify, { allowDangerousHtml: true });

  return processor;
};

export const parseMarkdown = async (
  inputFile,
  inputFolder,
  outputFolder,
  options = { tags: [] }
) => {
  const relativePath = path.relative(inputFolder, inputFile);
  const outputFileFolder = path.join(
    outputFolder,
    path.dirname(normalizePath(relativePath))
  );
  const inputFileName = normalizePath(path.parse(inputFile).name);
  const outputFileName = `${inputFileName}.html`;
  const outputFilePath = path.join(outputFileFolder, outputFileName);

  console.log(chalk.blue("Converting: ", inputFile, outputFileFolder));
  try {
    let data = await fs.readFile(inputFile, "utf8"); // Use let as data will be modified

    // Pre-processing step for Obsidian image embeds ![[...]]
    const imageEmbedRegex = /\!\[\[(.*?)\]\]/g;
    const matches = [];
    let regexMatch;
    while ((regexMatch = imageEmbedRegex.exec(data)) !== null) {
      matches.push({
        fullMatch: regexMatch[0], // e.g., ![[image.png]]
        capturedPath: regexMatch[1], // e.g., image.png
        index: regexMatch.index,
      });
    }

    const currentFileDir = path.dirname(inputFile);
    const replacementValues = [];

    for (const item of matches) {
      const decodedUserPath = decodeURIComponent(item.capturedPath);
      let effectivePath = decodedUserPath; // Default to original path

      const foundImagePath = await findImageRecursive(decodedUserPath, currentFileDir);

      if (foundImagePath) {
        // foundImagePath is already relative to currentFileDir
        effectivePath = foundImagePath;
      } else {
        console.warn(
          chalk.yellow(
            `[Warning] Image "${decodedUserPath}" not found in directory or subdirectories of "${inputFile}". Using original path link.`
          )
        );
      }

      const finalEncodedPath = effectivePath
        .split("/")
        .map(encodeURIComponent) // Encode each path segment
        .join("/");
      replacementValues.push({
        fullMatch: item.fullMatch,
        replacementString: `![](./${finalEncodedPath})`,
      });
    }

    // Perform replacements. Iterating backwards is safer if there were index-based replacements.
    // For string-based replacement, order doesn't strictly matter unless replacements create new matches.
    // Here, each `fullMatch` is distinct for ![[...]] embeds due to the captured path.
    for (const r of replacementValues) {
      data = data.replace(r.fullMatch, r.replacementString);
    }

    const processor = await configParser(
      inputFile,
      inputFolder,
      outputFileFolder,
      "",
      options
    );
    const file = await processor.process(data);
    const fileFrontMatter = file.data.frontmatter || {};
    const globalFrontMatter =
      (options && options.globalFrontMatter) || {};
    const frontMatter = {
      ...globalFrontMatter,
      ...fileFrontMatter,
    };

    // match front matter with tags and return if not match
    const tags = options.tags || [];
    if (tags.length > 0) {
      const shouldRender = tags.every(([key, value]) => {
        if (value === "true") {
          return frontMatter[key] && frontMatter[key].toString() === value;
        } else if (value === "false") {
          return !frontMatter[key] || frontMatter[key].toString() !== "true";
        } else {
          return true;
        }
      });
      console.log(
        chalk.yellow("Frontmatter::::", frontMatter, tags, shouldRender)
      );
      if (!shouldRender) {
        console.log(chalk.yellow(`Skipped: ${inputFile}`));
        return;
      }
    }

    const htmlContent = String(file.value);

    const title = file.data.meta?.title || frontMatter.title || inputFileName;
    const description = frontMatter.description || `A page about ${title}`;

    if (Object.keys(fileFrontMatter).length > 0) {
      console.log(chalk.blueBright("Front Matter:"), fileFrontMatter);
    }

    try {
      await fs.access(outputFileFolder);
    } catch (error) {
      await fs.mkdir(outputFileFolder, { recursive: true });
    }
    console.log(chalk.greenBright(`Parsed: ${outputFilePath}`));

    return {
      title,
      description,
      content: htmlContent,
      frontMatter,
      inputFile,
      inputFolder,
      outputFileFolder,
      outputFileName,
      outputFilePath,
    };
  } catch (err) {
    console.error(chalk.red(`Error parsing file ${inputFile}:`), err);
  }
};
// Removed findImageRecursiveSync function
