import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { normalizePath } from "./utils.js";

const toPosixPath = (value) => value.replace(/\\/g, "/");

const cleanHeadingText = (value) =>
  value.replace(/\s+#+\s*$/, "").trim();

const extractFirstH1 = (content) => {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)/);
    if (match) {
      return cleanHeadingText(match[1]);
    }
  }
  return null;
};

const toIsoDate = (value, fallbackDate) => {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }
  return fallbackDate.toISOString();
};

const normalizeTags = (tagsValue) => {
  if (Array.isArray(tagsValue)) {
    return tagsValue;
  }
  if (tagsValue !== undefined && tagsValue !== null) {
    return [tagsValue];
  }
  return [];
};

const parseOrder = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const buildRelativeUrlPath = (outputFolder, outputFilePath) => {
  let relPath = path.relative(outputFolder, outputFilePath);
  relPath = toPosixPath(relPath);
  relPath = relPath.replace(/index\.html$/, "");
  relPath = relPath.replace(/\.html$/, "");
  if (!relPath || relPath === ".") {
    return "/";
  }
  return relPath.startsWith("/") ? relPath : `/${relPath}`;
};

export const scanMarkdownMetadata = async (
  inputFile,
  inputFolder,
  outputFolder,
  options = {}
) => {
  const { tags = [], siteFrontMatter = {} } = options;
  const data = await fs.readFile(inputFile, "utf8");
  const parsed = matter(data);
  const fileFrontMatter = parsed.data || {};
  const frontMatterForFiltering = {
    ...siteFrontMatter,
    ...fileFrontMatter,
  };

  if (tags.length > 0) {
    const shouldRender = tags.every(([key, value]) => {
      if (value === "true") {
        return (
          frontMatterForFiltering[key] &&
          frontMatterForFiltering[key].toString() === value
        );
      }
      if (value === "false") {
        return (
          !frontMatterForFiltering[key] ||
          frontMatterForFiltering[key].toString() !== "true"
        );
      }
      return true;
    });
    if (!shouldRender) {
      return null;
    }
  }

  const stats = await fs.stat(inputFile);
  const firstH1 = extractFirstH1(parsed.content || "");
  const inputFileName = normalizePath(path.parse(inputFile).name);
  const title = fileFrontMatter.title || firstH1 || inputFileName;

  const relativePath = path.relative(inputFolder, inputFile);
  const normalizedRelativePath = normalizePath(relativePath);
  const outputFileFolder = path.join(
    outputFolder,
    path.dirname(normalizedRelativePath)
  );
  const outputFileName = `${inputFileName}.html`;
  const outputFilePath = path.join(outputFileFolder, outputFileName);
  const relativeUrlPath = buildRelativeUrlPath(outputFolder, outputFilePath);

  return {
    title,
    relative_path: relativeUrlPath,
    relativeFilePath: toPosixPath(normalizedRelativePath),
    order: parseOrder(fileFrontMatter.nav_order),
    createdAt: toIsoDate(fileFrontMatter.createdAt, stats.birthtime),
    updatedAt: toIsoDate(fileFrontMatter.updatedAt, stats.mtime),
    tags: normalizeTags(fileFrontMatter.tags),
  };
};

const createNode = ({
  title,
  relative_path,
  order = null,
  createdAt = null,
  updatedAt = null,
  tags = [],
}) => ({
  title,
  relative_path,
  order,
  createdAt,
  updatedAt,
  tags,
  children: [],
});

export const buildSitemapTree = (entries) => {
  const rootEntry = entries.find((entry) => entry.relative_path === "/");
  const root = createNode({
    title: rootEntry?.title || "root",
    relative_path: "/",
    order: rootEntry?.order ?? null,
    createdAt: rootEntry?.createdAt ?? null,
    updatedAt: rootEntry?.updatedAt ?? null,
    tags: rootEntry?.tags ?? [],
  });

  for (const entry of entries) {
    if (entry.relative_path === "/") {
      continue;
    }

    const dirPath = toPosixPath(path.dirname(entry.relativeFilePath));
    const segments =
      dirPath === "." ? [] : dirPath.split("/").filter(Boolean);
    let current = root;

    segments.forEach((segment, index) => {
      const segmentPath = `/${segments.slice(0, index + 1).join("/")}`;
      let existing = current.children.find(
        (child) => child.relative_path === segmentPath && !child.createdAt
      );

      if (!existing) {
        existing = createNode({
          title: segment,
          relative_path: segmentPath,
        });
        current.children.push(existing);
      }
      current = existing;
    });

    current.children.push(
      createNode({
        title: entry.title,
        relative_path: entry.relative_path,
        order: entry.order,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        tags: entry.tags,
      })
    );
  }

  const sortNodes = (node) => {
    node.children.sort((a, b) => {
      const aOrder = typeof a.order === "number" ? a.order : null;
      const bOrder = typeof b.order === "number" ? b.order : null;
      if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      if (aOrder !== null) {
        return -1;
      }
      if (bOrder !== null) {
        return 1;
      }
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
    node.children.forEach(sortNodes);
  };

  sortNodes(root);
  return root;
};

export const collectSitemapPaths = (node, paths = []) => {
  if (node?.createdAt && node.relative_path) {
    const normalized =
      node.relative_path.startsWith("/")
        ? node.relative_path
        : `/${node.relative_path}`;
    paths.push(normalized);
  }

  node?.children?.forEach((child) => collectSitemapPaths(child, paths));
  return paths;
};
