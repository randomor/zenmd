import fs from "fs/promises";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import remarkWikiLink from "remark-wiki-link";
import remarkFrontmatter from "remark-frontmatter";
// import remarkParseFrontmatter from "remark-parse-frontmatter";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeInferTitleMeta from "rehype-infer-title-meta";
import path from "path";
import chalk from "chalk";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { normalizePath, isUrl } from "./utils.js";

export const configParser = (
  currentFile,
  inputFolder,
  outputFileFolder,
  imageDir = ""
) => {
  const relativePathToInputFolder = path.relative(
    path.dirname(currentFile),
    inputFolder
  );

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkWikiLink, {
      pageResolver: (name) => [
        path.join(relativePathToInputFolder, normalizePath(name)),
      ],
      hrefTemplate: (permalink) => `${permalink}.html`,
    })
    .use(remarkGfm)
    .use(() => (tree) => {
      visit(tree, "link", (node) => {
        // all current domain path (path that begins with `.` or `/` or direct path e.g. example.md) with extension .md will be replaced with .html
        if (!isUrl(node.url) && node.url.match(/\.md$/)) {
          node.url = normalizePath(node.url).replace(/\.md$/, ".html");
        }
      });
    })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(() => (tree) => {
      visit(tree, ["image", "element"], async (node) => {
        if (
          node.tagName === "img" &&
          node?.properties?.src &&
          !isUrl(node.properties.src)
        ) {
          const decodedUrl = decodeURI(node.properties.src);
          const targetHref = path.join(imageDir, decodedUrl);
          const outputPath = path.join(outputFileFolder, imageDir, decodedUrl);
          await fs.mkdir(path.dirname(outputPath), { recursive: true });
          const currentFileDir = path.dirname(currentFile);
          const imagePath = path.join(currentFileDir, decodedUrl);

          try {
            await fs.copyFile(imagePath, outputPath);
          } catch (error) {
            console.error(
              chalk.red(
                `Error copying image from ${imagePath} to ${outputPath}: ${error.message}`
              )
            );
          }

          node.properties.src = `./${targetHref}`;
        }
      });
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
    const data = await fs.readFile(inputFile, "utf8");
    const processor = await configParser(
      inputFile,
      inputFolder,
      outputFileFolder
    );
    const file = await processor.process(data);
    const frontMatter = file.data.frontmatter || {};

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

    if (Object.keys(frontMatter).length > 0) {
      console.log(chalk.blueBright("Front Matter:"), frontMatter);
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
