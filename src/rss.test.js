import assert from "node:assert";
import path from "path";
import { describe, it } from "node:test";
import {
  absolutizeUrls,
  buildRssFeed,
  extractExcerpt,
  isExcludedFromRss,
  normalizeExcludePatterns,
  renderRssXml,
  resolveRssConfig,
} from "./rss.js";

describe("resolveRssConfig", () => {
  it("falls back to site front matter and the base url", () => {
    const config = resolveRssConfig(
      {},
      { title: "My Site", description: "Hello there" },
      "https://example.com/",
    );

    assert.strictEqual(config.enabled, true);
    assert.strictEqual(config.title, "My Site");
    assert.strictEqual(config.description, "Hello there");
    assert.strictEqual(config.language, "");
    assert.strictEqual(config.limit, 20);
    assert.deepStrictEqual(config.exclude, []);
    assert.strictEqual(config.link, "https://example.com");
    assert.strictEqual(config.feedUrl, "https://example.com/rss.xml");
  });

  it("uses the hostname when neither rss nor front matter define a title", () => {
    const config = resolveRssConfig(
      undefined,
      undefined,
      "https://blog.example.com/docs",
    );
    assert.strictEqual(config.title, "blog.example.com");
    assert.strictEqual(config.description, "blog.example.com");
    assert.strictEqual(config.feedUrl, "https://blog.example.com/docs/rss.xml");
  });

  it("prefers values from the rss block", () => {
    const config = resolveRssConfig(
      {
        title: "Feed title",
        description: "Feed description",
        language: "en-GB",
        limit: "5",
        exclude: ["./drafts/", "about.md"],
      },
      { title: "Site", description: "Site description" },
      "https://example.com",
    );

    assert.strictEqual(config.title, "Feed title");
    assert.strictEqual(config.description, "Feed description");
    assert.strictEqual(config.language, "en-GB");
    assert.strictEqual(config.limit, 5);
    assert.deepStrictEqual(config.exclude, ["drafts", "about.md"]);
  });

  it("only disables the feed for an explicit false", () => {
    assert.strictEqual(resolveRssConfig({ enabled: false }).enabled, false);
    assert.strictEqual(resolveRssConfig({ enabled: "false" }).enabled, false);
    assert.strictEqual(resolveRssConfig({ enabled: "FALSE" }).enabled, false);
    assert.strictEqual(resolveRssConfig({ enabled: true }).enabled, true);
    assert.strictEqual(resolveRssConfig({ enabled: "yes" }).enabled, true);
    assert.strictEqual(resolveRssConfig({}).enabled, true);
  });

  it("ignores invalid limits", () => {
    assert.strictEqual(resolveRssConfig({ limit: 0 }).limit, 20);
    assert.strictEqual(resolveRssConfig({ limit: -3 }).limit, 20);
    assert.strictEqual(resolveRssConfig({ limit: "lots" }).limit, 20);
    assert.strictEqual(resolveRssConfig({ limit: 2.7 }).limit, 2);
  });

  it("accepts a single exclude string", () => {
    assert.deepStrictEqual(resolveRssConfig({ exclude: "drafts" }).exclude, [
      "drafts",
    ]);
  });

  it("tolerates a non-object rss block", () => {
    assert.strictEqual(
      resolveRssConfig("nope", {}, "https://example.com").enabled,
      true,
    );
  });
});

describe("normalizeExcludePatterns", () => {
  it("strips leading ./ or / and trailing slashes and drops blanks", () => {
    assert.deepStrictEqual(
      normalizeExcludePatterns([
        "./drafts/",
        "/about.md",
        " posts/old ",
        "",
        null,
        "nested\\win",
      ]),
      ["drafts", "about.md", "posts/old", "nested/win"],
    );
  });
});

describe("isExcludedFromRss", () => {
  it("matches folders, files and glob patterns relative to the input folder", () => {
    assert.strictEqual(isExcludedFromRss("drafts/post.md", ["drafts"]), true);
    assert.strictEqual(
      isExcludedFromRss("drafts/nested/post.md", ["drafts"]),
      true,
    );
    assert.strictEqual(
      isExcludedFromRss("posts/drafts/post.md", ["drafts"]),
      false,
    );
    assert.strictEqual(
      isExcludedFromRss("posts/drafts/post.md", ["**/drafts"]),
      true,
    );
    assert.strictEqual(isExcludedFromRss("about.md", ["about.md"]), true);
    assert.strictEqual(isExcludedFromRss("about-us.md", ["about.md"]), false);
    assert.strictEqual(isExcludedFromRss("about.md", ["*.md"]), true);
    assert.strictEqual(isExcludedFromRss("posts/a.md", ["*.md"]), false);
    assert.strictEqual(
      isExcludedFromRss("Second Level/nested.md", ["Second Level"]),
      true,
    );
    assert.strictEqual(isExcludedFromRss("posts/a.md", []), false);
  });
});

describe("extractExcerpt", () => {
  it("returns the first paragraph with text, as plain text", () => {
    const html =
      '<h1>Title</h1>\n<p><img src="a.png"></p>\n' +
      "<p>Hello <em>world</em> &amp; friends &#39;quoted&#39;\n  twice</p>\n<p>Second</p>";

    assert.strictEqual(
      extractExcerpt(html),
      "Hello world & friends 'quoted' twice",
    );
  });

  it("returns an empty string without paragraphs", () => {
    assert.strictEqual(extractExcerpt("<h1>Only a heading</h1>"), "");
    assert.strictEqual(extractExcerpt(undefined), "");
  });
});

describe("absolutizeUrls", () => {
  it("rewrites relative href and src attributes against the page url", () => {
    const html =
      '<a href="./other.html">x</a><img src="assets/img.png">' +
      "<a href='../up.html'>y</a><a href=\"#top\">z</a>" +
      '<a href="https://ex.org/a">w</a><a href="mailto:a@b.c">m</a><a href="">e</a>';

    assert.strictEqual(
      absolutizeUrls(html, "https://example.com/posts/first"),
      '<a href="https://example.com/posts/other.html">x</a>' +
        '<img src="https://example.com/posts/assets/img.png">' +
        "<a href='https://example.com/up.html'>y</a>" +
        '<a href="https://example.com/posts/first#top">z</a>' +
        '<a href="https://ex.org/a">w</a><a href="mailto:a@b.c">m</a><a href="">e</a>',
    );
  });

  it("resolves against the folder for index pages", () => {
    assert.strictEqual(
      absolutizeUrls('<img src="./pic.png">', "https://example.com/posts/"),
      '<img src="https://example.com/posts/pic.png">',
    );
  });
});

describe("buildRssFeed", () => {
  const inputFolder = "/site";
  const outputFolder = "/dist";

  const makePage = (relative, overrides = {}) => ({
    title: path.basename(relative),
    content: `<h1>${path.basename(relative)}</h1>\n<p>Body of ${relative}</p>`,
    pageFrontMatter: {},
    inputFile: path.join(inputFolder, `${relative}.md`),
    outputFilePath: path.join(outputFolder, `${relative}.html`),
    ...overrides,
  });

  const makeEntry = (
    relative,
    createdAt,
    updatedAt = createdAt,
    tags = [],
  ) => ({
    inputFile: path.join(inputFolder, `${relative}.md`),
    createdAt,
    updatedAt,
    tags,
  });

  const config = resolveRssConfig(
    { exclude: ["drafts"], limit: 2 },
    { title: "Site" },
    "https://example.com",
  );

  it("skips the homepage and excluded paths, sorts newest first and applies the limit", () => {
    const feed = buildRssFeed({
      pages: [
        makePage("index"),
        makePage("drafts/wip"),
        makePage("posts/old"),
        makePage("posts/new"),
        makePage("posts/mid"),
      ],
      entries: [
        makeEntry("index", "2024-05-01T00:00:00.000Z"),
        makeEntry("drafts/wip", "2024-06-01T00:00:00.000Z"),
        makeEntry("posts/old", "2024-01-01T00:00:00.000Z"),
        makeEntry("posts/new", "2024-03-01T00:00:00.000Z"),
        makeEntry("posts/mid", "2024-02-01T00:00:00.000Z"),
      ],
      config,
      inputFolder,
      outputFolder,
    });

    assert.deepStrictEqual(
      feed.items.map((item) => item.link),
      ["https://example.com/posts/new", "https://example.com/posts/mid"],
    );
    assert.strictEqual(feed.title, "Site");
    assert.strictEqual(feed.link, "https://example.com");
    assert.strictEqual(feed.feedUrl, "https://example.com/rss.xml");
  });

  it("builds items from page attributes and sitemap metadata", () => {
    const feed = buildRssFeed({
      pages: [
        makePage("posts/first", {
          title: "Inferred title",
          pageFrontMatter: {
            title: "Front matter title",
            description: "Described",
          },
          content:
            '<h1 id="x">Inferred title<a aria-hidden="true" tabindex="-1" href="#x"><span class="icon icon-link"></span></a></h1>\n' +
            '<h2 id="y">Sub<a aria-hidden="true" tabindex="-1" href="#y"><span class="icon icon-link"></span></a></h2>\n' +
            '<p>Intro with <a href="./second.html">link</a></p>',
        }),
        makePage("posts/index"),
      ],
      entries: [
        makeEntry(
          "posts/first",
          "2024-01-01T00:00:00.000Z",
          "2024-01-05T00:00:00.000Z",
          ["news", 42],
        ),
        makeEntry("posts/index", "2024-01-02T00:00:00.000Z"),
      ],
      config,
      inputFolder,
      outputFolder,
    });

    const [indexItem, firstItem] = feed.items;

    assert.strictEqual(firstItem.title, "Front matter title");
    assert.strictEqual(firstItem.description, "Described");
    assert.strictEqual(
      firstItem.content,
      '<h2 id="y">Sub</h2>\n<p>Intro with <a href="https://example.com/posts/second.html">link</a></p>',
    );
    assert.strictEqual(
      firstItem.publishedAt.toISOString(),
      "2024-01-01T00:00:00.000Z",
    );
    assert.strictEqual(
      firstItem.updatedAt.toISOString(),
      "2024-01-05T00:00:00.000Z",
    );
    assert.deepStrictEqual(firstItem.categories, ["news", "42"]);

    assert.strictEqual(indexItem.link, "https://example.com/posts/");
    assert.strictEqual(indexItem.title, "index");
    assert.strictEqual(indexItem.description, "Body of posts/index");
    assert.strictEqual(indexItem.content, "<p>Body of posts/index</p>");
    assert.deepStrictEqual(indexItem.categories, []);

    assert.strictEqual(
      feed.lastBuildDate.toISOString(),
      "2024-01-05T00:00:00.000Z",
    );
  });

  it("copes with pages that have no sitemap entry", () => {
    const feed = buildRssFeed({
      pages: [makePage("posts/orphan")],
      entries: [],
      config,
      inputFolder,
      outputFolder,
    });

    assert.strictEqual(feed.items.length, 1);
    assert.strictEqual(feed.items[0].publishedAt, null);
    assert.strictEqual(feed.lastBuildDate, null);
  });
});

describe("renderRssXml", () => {
  it("renders an RSS 2.0 document with escaped text and CDATA content", () => {
    const xml = renderRssXml({
      title: "Tom & Jerry",
      link: "https://example.com",
      description: "<b>Bold</b> claims",
      language: "en",
      feedUrl: "https://example.com/rss.xml",
      lastBuildDate: new Date("2024-01-05T00:00:00.000Z"),
      items: [
        {
          title: 'Say "hi"',
          link: "https://example.com/posts/hi?a=1&b=2",
          description: "It's here",
          content: "<p>Body with ]]> inside</p>",
          publishedAt: new Date("2024-01-01T00:00:00.000Z"),
          updatedAt: new Date("2024-01-05T00:00:00.000Z"),
          categories: ["a&b"],
        },
      ],
    });

    assert.ok(
      xml.startsWith(
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"',
      ),
    );
    assert.ok(xml.includes('xmlns:atom="http://www.w3.org/2005/Atom"'));
    assert.ok(
      xml.includes('xmlns:content="http://purl.org/rss/1.0/modules/content/"'),
    );
    assert.ok(xml.includes("<title>Tom &amp; Jerry</title>"));
    assert.ok(
      xml.includes("<description>&lt;b&gt;Bold&lt;/b&gt; claims</description>"),
    );
    assert.ok(xml.includes("<language>en</language>"));
    assert.ok(
      xml.includes(
        '<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>',
      ),
    );
    assert.ok(
      xml.includes(
        "<lastBuildDate>Fri, 05 Jan 2024 00:00:00 GMT</lastBuildDate>",
      ),
    );
    assert.ok(xml.includes("<title>Say &quot;hi&quot;</title>"));
    assert.ok(
      xml.includes("<link>https://example.com/posts/hi?a=1&amp;b=2</link>"),
    );
    assert.ok(
      xml.includes("<guid>https://example.com/posts/hi?a=1&amp;b=2</guid>"),
    );
    assert.ok(xml.includes("<pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>"));
    assert.ok(xml.includes("<description>It&#39;s here</description>"));
    assert.ok(
      xml.includes(
        "<content:encoded><![CDATA[<p>Body with ]]]]><![CDATA[> inside</p>]]></content:encoded>",
      ),
    );
    assert.ok(xml.includes("<category>a&amp;b</category>"));
    assert.ok(xml.trimEnd().endsWith("</rss>"));
  });

  it("omits optional elements that have no value", () => {
    const xml = renderRssXml({
      title: "Feed",
      link: "https://example.com",
      description: "Feed",
      language: "",
      feedUrl: "",
      lastBuildDate: null,
      items: [
        {
          title: "Bare",
          link: "https://example.com/bare",
          description: "",
          content: "",
          publishedAt: null,
          updatedAt: null,
          categories: [],
        },
      ],
    });

    assert.ok(!xml.includes("<language>"));
    assert.ok(!xml.includes("<atom:link"));
    assert.ok(!xml.includes("<lastBuildDate>"));
    assert.ok(!xml.includes("<pubDate>"));
    assert.ok(!xml.includes("<content:encoded>"));
    assert.ok(!xml.includes("<category>"));
    assert.strictEqual(xml.match(/<description>/g).length, 1);
    assert.ok(xml.includes("<item>"));
  });
});
