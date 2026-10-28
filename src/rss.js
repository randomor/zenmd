import path from "path";
import { minimatch } from "minimatch";
import { buildRelativeUrlPath } from "./sitemap.js";
import { joinUrl } from "./utils.js";

export const RSS_FILE_NAME = "rss.xml";
const DEFAULT_LIMIT = 20;
const MATCH_OPTIONS = { dot: true };

const toPosixPath = (value) => value.replace(/\\/g, "/");

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const pickText = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const toDate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
};

const hostnameOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const resolveEnabled = (value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().toLowerCase() !== "false";
  return Boolean(value);
};

const resolveLimit = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 1
    ? Math.floor(numeric)
    : DEFAULT_LIMIT;
};

/**
 * Exclude entries are paths relative to the input folder: a folder name
 * excludes everything beneath it, a file path excludes that file, and glob
 * patterns (e.g. `**\/drafts`) are supported via minimatch.
 */
export const normalizeExcludePatterns = (value) => {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((item) => item !== undefined && item !== null)
    .map((item) => toPosixPath(String(item)).trim())
    .map((item) => item.replace(/^(\.\/|\/)+/, "").replace(/\/+$/, ""))
    .filter(Boolean);
};

export const resolveRssConfig = (
  rawConfig = {},
  siteFrontMatter = {},
  baseUrl = "",
) => {
  const rss = isPlainObject(rawConfig) ? rawConfig : {};
  const frontMatter = isPlainObject(siteFrontMatter) ? siteFrontMatter : {};
  const link = pickText(baseUrl).replace(/\/+$/, "");
  const title =
    pickText(rss.title, frontMatter.title) || hostnameOf(link) || "RSS Feed";

  return {
    enabled: resolveEnabled(rss.enabled),
    title,
    description: pickText(rss.description, frontMatter.description) || title,
    language: pickText(rss.language),
    limit: resolveLimit(rss.limit),
    exclude: normalizeExcludePatterns(rss.exclude),
    link,
    feedUrl: link ? joinUrl(link, `/${RSS_FILE_NAME}`) : "",
  };
};

export const isExcludedFromRss = (relativeFilePath, excludePatterns = []) => {
  const target = toPosixPath(relativeFilePath);
  return excludePatterns.some(
    (pattern) =>
      minimatch(target, pattern, MATCH_OPTIONS) ||
      minimatch(target, `${pattern}/**`, MATCH_OPTIONS),
  );
};

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const fromCodePoint = (code, fallback) => {
  try {
    return String.fromCodePoint(code);
  } catch {
    return fallback;
  }
};

const decodeEntities = (text) =>
  text
    .replace(/&#(\d+);/g, (match, code) => fromCodePoint(Number(code), match))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) =>
      fromCodePoint(parseInt(code, 16), match),
    )
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp);/g,
      (_, name) => NAMED_ENTITIES[name],
    );

/** Plain text of the first non-empty paragraph, used when a page has no description. */
export const extractExcerpt = (html = "") => {
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (text) return text;
  }
  return "";
};

const resolveAgainst = (value, pageUrl) => {
  try {
    return new URL(value, pageUrl).href;
  } catch {
    return value;
  }
};

/** Rewrites relative href/src attributes so the HTML is self-contained in feed readers. */
export const absolutizeUrls = (html = "", pageUrl) =>
  html.replace(
    /(\s(?:href|src)=)(?:"([^"]*)"|'([^']*)')/gi,
    (full, prefix, doubleQuoted, singleQuoted) => {
      const value = doubleQuoted !== undefined ? doubleQuoted : singleQuoted;
      if (!value) return full;
      const quote = doubleQuoted !== undefined ? '"' : "'";
      return `${prefix}${quote}${resolveAgainst(value, pageUrl)}${quote}`;
    },
  );

// The leading H1 is the page title, which the feed already carries in <title>.
const stripLeadingHeading = (html = "") =>
  html.replace(/^\s*<h1\b[^>]*>[\s\S]*?<\/h1>\s*/i, "");

// rehype-autolink-headings appends empty anchor links to headings; they add nothing in a feed.
const stripHeadingAnchors = (html = "") =>
  html.replace(
    /<a\b[^>]*\baria-hidden="true"[^>]*>\s*<span\b[^>]*><\/span>\s*<\/a>/gi,
    "",
  );

export const buildRssFeed = ({
  pages = [],
  entries = [],
  config,
  inputFolder,
  outputFolder,
}) => {
  const entriesByFile = new Map(
    entries
      .filter((entry) => entry?.inputFile)
      .map((entry) => [path.resolve(entry.inputFile), entry]),
  );

  const items = pages
    .filter((page) => page?.inputFile && page?.outputFilePath)
    .map((page) => ({
      page,
      relativeFilePath: toPosixPath(path.relative(inputFolder, page.inputFile)),
      relativeUrlPath: buildRelativeUrlPath(outputFolder, page.outputFilePath),
      entry: entriesByFile.get(path.resolve(page.inputFile)),
    }))
    .filter(
      ({ relativeFilePath, relativeUrlPath }) =>
        relativeUrlPath !== "/" &&
        !isExcludedFromRss(relativeFilePath, config.exclude),
    )
    .map(({ page, relativeUrlPath, entry }) => {
      const frontMatter = isPlainObject(page.pageFrontMatter)
        ? page.pageFrontMatter
        : {};
      const link = joinUrl(config.link, relativeUrlPath);
      const publishedAt = toDate(entry?.createdAt);
      const content = absolutizeUrls(
        stripHeadingAnchors(stripLeadingHeading(page.content)),
        link,
      );

      return {
        title: pickText(frontMatter.title, page.title),
        link,
        description:
          pickText(frontMatter.description) || extractExcerpt(page.content),
        content,
        publishedAt,
        updatedAt: toDate(entry?.updatedAt) || publishedAt,
        categories: Array.isArray(entry?.tags) ? entry.tags.map(String) : [],
      };
    })
    .sort(
      (a, b) =>
        (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0),
    )
    .slice(0, config.limit);

  const lastBuildDate = items.reduce(
    (latest, item) =>
      item.updatedAt && (!latest || item.updatedAt > latest)
        ? item.updatedAt
        : latest,
    null,
  );

  return {
    title: config.title,
    link: config.link,
    description: config.description,
    language: config.language,
    feedUrl: config.feedUrl,
    lastBuildDate,
    items,
  };
};

const XML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeXml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

const cdata = (value) =>
  `<![CDATA[${String(value).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

const toRfc822 = (date) => date.toUTCString();

const indent = (lines, depth) =>
  lines.filter(Boolean).map((line) => `${"  ".repeat(depth)}${line}`);

export const renderRssXml = (feed) => {
  const channel = indent(
    [
      `<title>${escapeXml(feed.title)}</title>`,
      `<link>${escapeXml(feed.link)}</link>`,
      `<description>${escapeXml(feed.description)}</description>`,
      feed.feedUrl &&
        `<atom:link href="${escapeXml(
          feed.feedUrl,
        )}" rel="self" type="application/rss+xml"/>`,
      feed.language && `<language>${escapeXml(feed.language)}</language>`,
      feed.lastBuildDate &&
        `<lastBuildDate>${toRfc822(feed.lastBuildDate)}</lastBuildDate>`,
      "<generator>ZenMD</generator>",
    ],
    2,
  );

  const items = (feed.items || []).flatMap((item) => [
    ...indent(["<item>"], 2),
    ...indent(
      [
        `<title>${escapeXml(item.title)}</title>`,
        `<link>${escapeXml(item.link)}</link>`,
        `<guid>${escapeXml(item.link)}</guid>`,
        item.publishedAt && `<pubDate>${toRfc822(item.publishedAt)}</pubDate>`,
        item.description &&
          `<description>${escapeXml(item.description)}</description>`,
        item.content &&
          `<content:encoded>${cdata(item.content)}</content:encoded>`,
        ...(item.categories || []).map(
          (category) => `<category>${escapeXml(category)}</category>`,
        ),
      ],
      3,
    ),
    ...indent(["</item>"], 2),
  ]);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">',
    "  <channel>",
    ...channel,
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
};
