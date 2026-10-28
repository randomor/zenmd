import path from "path";
import { minimatch } from "minimatch";
import { buildRelativeUrlPath, normalizeTags } from "./sitemap.js";
import {
  isPlainObject,
  joinUrl,
  normalizeBoolean,
  toPosixPath,
} from "./utils.js";

export const RSS_FILE_NAME = "rss.xml";
const DEFAULT_LIMIT = 20;
const MATCH_OPTIONS = { dot: true };

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
  return Boolean(normalizeBoolean(value));
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

const toPlainText = (html = "") =>
  decodeEntities(String(html).replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();

/** Plain text of the first non-empty paragraph, used when a page has no description. */
export const extractExcerpt = (html = "") => {
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = toPlainText(match[1]);
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

const ATTRIBUTE_URLS = /(\s(?:href|src)=)(?:"([^"]*)"|'([^']*)')/gi;
// Code samples and comments may contain literal `href="..."` text that must stay untouched.
const PROTECTED_RANGES =
  /<pre\b[\s\S]*?<\/pre>|<code\b[\s\S]*?<\/code>|<!--[\s\S]*?-->/gi;

const rewriteAttributeUrls = (html, pageUrl) =>
  html.replace(ATTRIBUTE_URLS, (full, prefix, doubleQuoted, singleQuoted) => {
    const value = doubleQuoted !== undefined ? doubleQuoted : singleQuoted;
    if (!value) return full;
    const quote = doubleQuoted !== undefined ? '"' : "'";
    return `${prefix}${quote}${resolveAgainst(value, pageUrl)}${quote}`;
  });

/** Rewrites relative href/src attributes so the HTML is self-contained in feed readers. */
export const absolutizeUrls = (html = "", pageUrl) => {
  let result = "";
  let cursor = 0;
  for (const match of html.matchAll(PROTECTED_RANGES)) {
    result += rewriteAttributeUrls(html.slice(cursor, match.index), pageUrl);
    result += match[0];
    cursor = match.index + match[0].length;
  }
  return result + rewriteAttributeUrls(html.slice(cursor), pageUrl);
};

/** Removes the first H1 when it repeats the item title, which the feed already carries in <title>. */
export const stripTitleHeading = (html = "", title = "") => {
  const match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>\s*/i);
  if (!match) return html;
  const headingText = toPlainText(match[1]);
  if (!headingText || headingText !== toPlainText(title)) return html;
  return html.slice(0, match.index) + html.slice(match.index + match[0].length);
};

// rehype-autolink-headings appends empty anchor links to headings; they add nothing in a feed.
const stripHeadingAnchors = (html = "") =>
  html.replace(
    /<a\b[^>]*\baria-hidden="true"[^>]*>\s*<span\b[^>]*><\/span>\s*<\/a>/gi,
    "",
  );

// Dated pages first, newest to oldest; undated pages last, by link for a stable order.
const compareByDate = (a, b) => {
  if (a.publishedAt && b.publishedAt) return b.publishedAt - a.publishedAt;
  if (a.publishedAt) return -1;
  if (b.publishedAt) return 1;
  return a.link.localeCompare(b.link);
};

export const buildRssFeed = ({
  pages = [],
  config,
  inputFolder,
  outputFolder,
}) => {
  // Only the pages that make the cut get the (comparatively costly) content transforms.
  const selected = pages
    .filter((page) => page?.inputFile && page?.outputFilePath)
    .map((page) => ({
      page,
      relativeFilePath: toPosixPath(path.relative(inputFolder, page.inputFile)),
      relativeUrlPath: buildRelativeUrlPath(outputFolder, page.outputFilePath),
    }))
    .filter(
      ({ relativeFilePath, relativeUrlPath }) =>
        relativeUrlPath !== "/" &&
        !isExcludedFromRss(relativeFilePath, config.exclude),
    )
    .map(({ page, relativeUrlPath }) => {
      const frontMatter = isPlainObject(page.pageFrontMatter)
        ? page.pageFrontMatter
        : {};
      // Only front matter dates count: file timestamps are checkout times on CI.
      const publishedAt = toDate(frontMatter.createdAt);
      return {
        page,
        frontMatter,
        link: joinUrl(config.link, relativeUrlPath),
        publishedAt,
        updatedAt: toDate(frontMatter.updatedAt) || publishedAt,
      };
    })
    .sort(compareByDate)
    .slice(0, config.limit);

  const items = selected.map(
    ({ page, frontMatter, link, publishedAt, updatedAt }) => {
      const title = pickText(frontMatter.title, page.title);
      const content = absolutizeUrls(
        stripHeadingAnchors(stripTitleHeading(page.content, title)),
        link,
      );

      return {
        title,
        link,
        description:
          pickText(frontMatter.description) || extractExcerpt(page.content),
        content,
        publishedAt,
        updatedAt,
        categories: normalizeTags(frontMatter.tags)
          .filter((tag) => tag !== undefined && tag !== null)
          .map(String),
      };
    },
  );

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

// Control characters outside tab/newline/CR are not allowed anywhere in XML 1.0.
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const sanitizeXml = (value) =>
  String(value ?? "").replace(INVALID_XML_CHARS, "");

const XML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeXml = (value) =>
  sanitizeXml(value).replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);

const cdata = (value) =>
  `<![CDATA[${sanitizeXml(value).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

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
