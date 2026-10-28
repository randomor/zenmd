import fs from "fs/promises";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import path from "path";
import os from "os";

describe("processFolder", () => {
  const inputFolder = "./src/__test__";
  const fixturesRoot = path.join(inputFolder, "fixtures");
  let outputFolder;
  const allMarkdownFiles = [
    "src/__test__/example.md",
    "src/__test__/second level/nested.md",
    "src/__test__/second level/nested with space.md",
    "src/__test__/fixtures/favicon-builtin/index.md",
    "src/__test__/fixtures/favicon-root/index.md",
    "src/__test__/fixtures/site-config/index.md",
  ];
  beforeEach(async () => {
    outputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "zenmd-test-"));
  });
  afterEach(async () => {
    if (outputFolder) {
      await fs.rm(outputFolder, { recursive: true, force: true });
      outputFolder = undefined;
    }
  });

  it("picks markdown and convert", async () => {
    const { processFolder } = await import("./main.js");
    const parser = mock.fn((_) => ({
      title: "Example",
      content: "Hello World",
      pageFrontMatter: { favicon: "/favicon.svg" },
      inputFile: "src/__test__/example.md",
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: path.join(outputFolder, "example.html"),
    }));

    await processFolder(inputFolder, outputFolder, { parser });
    assert.strictEqual(parser.mock.calls.length, allMarkdownFiles.length);
    const seenFiles = parser.mock.calls.map((call) => call.arguments[0]).sort();
    const expectedFiles = [...allMarkdownFiles].sort();
    assert.deepStrictEqual(seenFiles, expectedFiles);
  });

  it("supports individual file", async () => {
    const { processFolder } = await import("./main.js");
    const inputArg = "src/__test__/second level/nested.md";
    const parser = mock.fn((_) => ({
      title: "Example",
      content: "Hello World",
      frontMatter: {},
      inputFile: inputArg,
      inputFolder: "src/__test__/second level",
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: path.join(outputFolder, "example.html"),
    }));
    await processFolder(inputArg, outputFolder, { parser });

    assert.strictEqual(parser.mock.calls.length, 1);
    assert.strictEqual(parser.mock.calls[0].arguments[0], inputArg);
  });

  it("supports tags", async () => {
    const { processFolder } = await import("./main.js");
    const inputArg = "src/__test__";
    const parser = mock.fn((_) => ({
      title: "Example",
      content: "Hello World",
      pageFrontMatter: { favicon: "/favicon.svg" },
      inputFile: inputArg + "/example.md",
      inputFolder: "src/__test__",
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: path.join(outputFolder, "example.html"),
    }));
    const tags = [
      ["tag1", "value1"],
      ["tag2", "value2"],
    ];
    await processFolder(inputArg, outputFolder, { parser, tags });

    assert.strictEqual(parser.mock.calls.length, allMarkdownFiles.length);
    assert.strictEqual(parser.mock.calls[0].arguments[3].tags, tags);
  });

  it("skips pages returning undefined", async () => {
    const { processFolder } = await import("./main.js");
    const parser = mock.fn((file) => {
      if (file.includes("second level/nested.md")) return undefined;
      return {
        title: "Example",
        content: "Hello World",
        pageFrontMatter: { favicon: "/favicon.svg" },
        inputFile: file,
        inputFolder,
        outputFileFolder: outputFolder,
        outputFileName: path.basename(file, ".md") + ".html",
        outputFilePath: path.join(
          outputFolder,
          path.basename(file, ".md") + ".html"
        ),
      };
    });

    const renderHtmlPageMock = mock.fn();
    const renderSitemapMock = mock.fn();

    await processFolder(inputFolder, outputFolder, {
      parser,
      renderHtmlPage: renderHtmlPageMock,
      renderSitemap: renderSitemapMock,
      sitemap: true,
      baseUrl: "https://example.com",
    });

    // parser called for all files
    assert.strictEqual(parser.mock.calls.length, allMarkdownFiles.length);
    // One page skipped, so only two pages rendered
    assert.strictEqual(
      renderHtmlPageMock.mock.calls.length,
      allMarkdownFiles.length - 1
    );
    const [sitemapTree] = renderSitemapMock.mock.calls[0].arguments;
    assert.ok(sitemapTree);
    assert.ok(Array.isArray(sitemapTree.children));
  });
    
  it("generates a default robots.txt", async () => {
    const { processFolder } = await import("./main.js");
    await processFolder(inputFolder, outputFolder);

    const robotsPath = path.join(outputFolder, "robots.txt");
    const exists = await fs
      .access(robotsPath)
      .then(() => true)
      .catch(() => false);
    assert.ok(exists, "robots.txt should exist");

    const content = await fs.readFile(robotsPath, "utf-8");
    assert.ok(content.includes("User-agent: *\nDisallow:"));
  });

  it("copies favicon from input root when no favicon is defined", async () => {
    const { processFolder } = await import("./main.js");
    const fixtureInput = path.join(fixturesRoot, "favicon-root");

    await processFolder(fixtureInput, outputFolder);

    const html = await fs.readFile(path.join(outputFolder, "index.html"), "utf-8");
    assert.ok(html.includes('<link rel="icon" href="/favicon.svg">'));

    const copiedExists = await fs
      .access(path.join(outputFolder, "favicon.svg"))
      .then(() => true)
      .catch(() => false);
    assert.ok(copiedExists);
  });

  it("uses built-in favicon and baseUrl when none is provided", async () => {
    const { processFolder } = await import("./main.js");
    const fixtureInput = path.join(fixturesRoot, "favicon-builtin");

    await processFolder(fixtureInput, outputFolder, {
      baseUrl: "https://example.com/docs",
    });

    const html = await fs.readFile(path.join(outputFolder, "index.html"), "utf-8");
    assert.ok(
      html.includes(
        '<link rel="icon" href="https://example.com/docs/favicon.png">'
      )
    );

    const copiedExists = await fs
      .access(path.join(outputFolder, "favicon.png"))
      .then(() => true)
      .catch(() => false);
    assert.ok(copiedExists);
  });

  it("merges front matter from site.yaml", async () => {
    const { processFolder } = await import("./main.js");
    const fixtureInput = path.join(fixturesRoot, "site-config");
    const siteYamlPath = path.join(fixtureInput, "site.yaml");

    await fs.writeFile(
      siteYamlPath,
      "front_matter:\n  description: Global description\n  favicon: /branding/icon.ico\n"
    );

    try {
      await processFolder(fixtureInput, outputFolder, {
        baseUrl: "https://example.com",
      });

      const html = await fs.readFile(path.join(outputFolder, "index.html"), "utf-8");
      assert.ok(
        html.includes(
          '<meta name="description" content="Global description">'
        )
      );
      assert.ok(
        html.includes(
          '<link rel="icon" href="https://example.com/branding/icon.ico">'
        )
      );
    } finally {
      await fs.rm(siteYamlPath, { force: true });
    }
  });

  it("uses page ogImage when specified", async () => {
    const { processFolder } = await import("./main.js");
    
    // Add ogImage to existing test file
    const testFile = path.join(inputFolder, "example.md");
    const originalContent = await fs.readFile(testFile, "utf-8");
    await fs.writeFile(testFile, "---\nogImage: assets/testImage.webp\n---\n" + originalContent);

    try {
      await processFolder(inputFolder, outputFolder, {
        baseUrl: "https://example.com",
      });

      const html = await fs.readFile(path.join(outputFolder, "example.html"), "utf-8");
      assert.ok(
        html.includes('<meta property="og:image" content="https://example.com/assets/testImage.webp">'),
        "Should use page ogImage"
      );
    } finally {
      await fs.writeFile(testFile, originalContent);
    }
  });

  it("uses first image from content as ogImage fallback", async () => {
    const { processFolder } = await import("./main.js");
    
    // Add image to existing test file
    const testFile = path.join(inputFolder, "example.md");
    const originalContent = await fs.readFile(testFile, "utf-8");
    await fs.writeFile(
      testFile,
      originalContent + "\n\n![Test](./assets/testImage.webp)"
    );

    try {
      await processFolder(inputFolder, outputFolder, {
        baseUrl: "https://example.com",
      });

      const html = await fs.readFile(path.join(outputFolder, "example.html"), "utf-8");
      const expectedMeta =
        '<meta property="og:image" content="https://example.com/assets/testImage.webp">';
      assert.ok(
        html.includes(expectedMeta),
        "Should use first image as ogImage"
      );
      assert.ok(
        !html.includes('content="https://example.com/./'),
        "Should not include ./ in og:image URL"
      );
    } finally {
      await fs.writeFile(testFile, originalContent);
    }
  });

  it("nests ogImage URLs for first-content image on nested pages", async () => {
    const { processFolder } = await import("./main.js");

    await processFolder(inputFolder, outputFolder, {
      baseUrl: "https://example.com/docs/child/",
    });

    const nestedHtml = await fs.readFile(
      path.join(outputFolder, "second-level/nested.html"),
      "utf-8"
    );
    const expectedMeta =
      '<meta property="og:image" content="https://example.com/docs/child/second-level/assets/testImage.webp">';
    assert.ok(
      nestedHtml.includes(expectedMeta),
      "Should include nested path in og:image"
    );
  });

  it("generates ogUrl with baseUrl and handles subdirectory paths", async () => {
    const { processFolder } = await import("./main.js");

    await processFolder(inputFolder, outputFolder, {
      baseUrl: "https://example.com",
    });

    const html = await fs.readFile(path.join(outputFolder, "example.html"), "utf-8");
    assert.ok(
      html.includes('<meta property="og:url" content="https://example.com/example">'),
      "Should generate ogUrl without .html"
    );
    assert.ok(!html.includes('/./'), "Should not have /./ in URLs");
    
    const nestedHtml = await fs.readFile(
      path.join(outputFolder, "second-level/nested.html"),
      "utf-8"
    );
    assert.ok(
      nestedHtml.includes('<meta property="og:url" content="https://example.com/second-level/nested">'),
      "Should handle nested paths"
    );
  });

  it("omits ogUrl when no baseUrl provided", async () => {
    const { processFolder } = await import("./main.js");

    await processFolder(inputFolder, outputFolder);

    const html = await fs.readFile(path.join(outputFolder, "example.html"), "utf-8");
    assert.ok(
      !html.includes('property="og:url"'),
      "Should not include ogUrl without baseUrl"
    );
  });
});

describe("processFolder - Sitemap", () => {
  const inputFolder = "./src/__test__";
  let outputFolder;

  beforeEach(async () => {
    outputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "zenmd-test-"));
  });

  afterEach(async () => {
    if (outputFolder) {
      await fs.rm(outputFolder, { recursive: true, force: true });
      outputFolder = undefined;
    }
  });

  it("calls renderSitemap with correct arguments when sitemap is true and baseUrl is provided", async () => {
    const { processFolder } = await import("./main.js");
    const parser = mock.fn((file) => ({
      title: "Example",
      content: "Hello World",
      frontMatter: {},
      inputFile: file,
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: path.basename(file, ".md") + ".html",
      outputFilePath: path.join(
        outputFolder,
        path.basename(file, ".md") + ".html"
      ),
    }));

    const renderSitemapMock = mock.fn();
    const renderHtmlPageMock = mock.fn();

    const baseUrl = "https://example.com";
    await processFolder(inputFolder, outputFolder, {
      parser,
      sitemap: true,
      baseUrl,
      renderSitemap: renderSitemapMock,
      renderHtmlPage: renderHtmlPageMock,
    });

    // Should be called once
    assert.strictEqual(renderSitemapMock.mock.calls.length, 1);
    const [sitemapTree, sitemapPath, calledBaseUrl] =
      renderSitemapMock.mock.calls[0].arguments;
    assert.ok(sitemapTree);
    assert.ok(Array.isArray(sitemapTree.children));
    assert.strictEqual(typeof sitemapPath, "string");
    assert.strictEqual(calledBaseUrl, baseUrl);
    assert.ok(sitemapPath.endsWith("sitemap.xml"));
    assert.ok(sitemapTree.children.length > 0);
    // Ensure renderHtmlPage is called for each page
    assert.strictEqual(
      renderHtmlPageMock.mock.calls.length,
      parser.mock.calls.length
    );
  });

  it("does not call renderSitemap when sitemap is false", async () => {
    const { processFolder } = await import("./main.js");
    const parser = mock.fn((file) => ({
      title: "Example",
      content: "Hello World",
      frontMatter: {},
      inputFile: file,
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: path.basename(file, ".md") + ".html",
      outputFilePath: path.join(
        outputFolder,
        path.basename(file, ".md") + ".html"
      ),
    }));

    const renderSitemapMock = mock.fn();
    const renderHtmlPageMock = mock.fn();

    const baseUrl = "https://example.com";
    await processFolder(inputFolder, outputFolder, {
      parser,
      sitemap: false,
      baseUrl,
      renderSitemap: renderSitemapMock,
      renderHtmlPage: renderHtmlPageMock,
    });

    assert.strictEqual(renderSitemapMock.mock.calls.length, 0);
    // Still render HTML pages
    assert.strictEqual(
      renderHtmlPageMock.mock.calls.length,
      parser.mock.calls.length
    );
  });
});

describe("processFolder - RSS", () => {
  let inputFolder;
  let outputFolder;
  const baseUrl = "https://example.com";

  const writeSiteConfig = (rssLines) =>
    fs.writeFile(
      path.join(inputFolder, "site.yaml"),
      [
        "front_matter:",
        "  title: Example Site",
        "  description: Example description",
        "rss:",
        ...rssLines,
        "",
      ].join("\n")
    );

  beforeEach(async () => {
    inputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "zenmd-rss-input-"));
    outputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "zenmd-rss-output-"));

    await fs.mkdir(path.join(inputFolder, "posts"));
    await fs.mkdir(path.join(inputFolder, "drafts"));
    await fs.writeFile(path.join(inputFolder, "index.md"), "# Home\n\nWelcome\n");
    await fs.writeFile(path.join(inputFolder, "about.md"), "# About\n\nAbout us\n");
    await fs.writeFile(
      path.join(inputFolder, "drafts", "wip.md"),
      "# Work in progress\n\nNot yet\n"
    );
    await fs.writeFile(
      path.join(inputFolder, "posts", "first.md"),
      [
        "---",
        "createdAt: 2024-01-01",
        "tags: [news]",
        "---",
        "# First post",
        "",
        "First paragraph with a [link](./second.md).",
        "",
      ].join("\n")
    );
    await fs.writeFile(
      path.join(inputFolder, "posts", "second.md"),
      [
        "---",
        "createdAt: 2024-03-01",
        "description: Second description",
        "---",
        "# Second post",
        "",
        "Body",
        "",
      ].join("\n")
    );
    await writeSiteConfig(["  exclude:", "    - drafts", "    - about.md"]);
  });

  afterEach(async () => {
    await fs.rm(inputFolder, { recursive: true, force: true });
    await fs.rm(outputFolder, { recursive: true, force: true });
  });

  it("writes rss.xml honouring site.yaml exclusions and advertises it in pages", async () => {
    const { processFolder } = await import("./main.js");
    await processFolder(inputFolder, outputFolder, { baseUrl });

    const rss = await fs.readFile(path.join(outputFolder, "rss.xml"), "utf-8");

    assert.ok(rss.includes("<title>Example Site</title>"));
    assert.ok(rss.includes("<description>Example description</description>"));
    assert.ok(rss.includes("<link>https://example.com</link>"));
    assert.ok(
      rss.includes(
        '<atom:link href="https://example.com/rss.xml" rel="self" type="application/rss+xml"/>'
      )
    );

    assert.ok(rss.includes("<title>First post</title>"));
    assert.ok(rss.includes("<title>Second post</title>"));
    assert.ok(
      rss.indexOf("<title>Second post</title>") < rss.indexOf("<title>First post</title>"),
      "newer post should come first"
    );
    assert.ok(rss.includes("<link>https://example.com/posts/first</link>"));
    assert.ok(rss.includes("<pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>"));
    assert.ok(rss.includes("<category>news</category>"));
    assert.ok(rss.includes("<description>Second description</description>"));
    assert.ok(rss.includes("<description>First paragraph with a link.</description>"));
    assert.ok(rss.includes('href="https://example.com/posts/second.html"'));

    assert.ok(!rss.includes("Work in progress"), "drafts folder should be excluded");
    assert.ok(!rss.includes("<title>About</title>"), "about.md should be excluded");
    assert.ok(!rss.includes("<title>Home</title>"), "homepage should be excluded");

    const html = await fs.readFile(
      path.join(outputFolder, "posts", "first.html"),
      "utf-8"
    );
    assert.ok(
      html.includes(
        '<link rel="alternate" type="application/rss+xml" title="Example Site" href="https://example.com/rss.xml">'
      )
    );

    // Excluded pages are still built and still in the sitemap.
    const sitemap = await fs.readFile(path.join(outputFolder, "sitemap.xml"), "utf-8");
    assert.ok(sitemap.includes("<loc>https://example.com/drafts/wip</loc>"));
    await fs.access(path.join(outputFolder, "about.html"));
  });

  it("applies the limit from site.yaml", async () => {
    const { processFolder } = await import("./main.js");
    await writeSiteConfig(["  limit: 1", "  exclude:", "    - drafts", "    - about.md"]);
    await processFolder(inputFolder, outputFolder, { baseUrl });

    const rss = await fs.readFile(path.join(outputFolder, "rss.xml"), "utf-8");
    assert.strictEqual(rss.match(/<item>/g).length, 1);
    assert.ok(rss.includes("<title>Second post</title>"));
  });

  it("skips the feed when rss.enabled is false", async () => {
    const { processFolder } = await import("./main.js");
    await writeSiteConfig(["  enabled: false"]);
    await processFolder(inputFolder, outputFolder, { baseUrl });

    const exists = await fs
      .access(path.join(outputFolder, "rss.xml"))
      .then(() => true)
      .catch(() => false);
    assert.strictEqual(exists, false);

    const html = await fs.readFile(path.join(outputFolder, "index.html"), "utf-8");
    assert.ok(!html.includes('rel="alternate"'));
  });

  it("skips the feed without a baseUrl", async () => {
    const { processFolder } = await import("./main.js");
    await processFolder(inputFolder, outputFolder);

    const exists = await fs
      .access(path.join(outputFolder, "rss.xml"))
      .then(() => true)
      .catch(() => false);
    assert.strictEqual(exists, false);
  });

  it("passes the feed to a custom renderRss", async () => {
    const { processFolder } = await import("./main.js");
    const renderRssMock = mock.fn();
    await processFolder(inputFolder, outputFolder, {
      baseUrl,
      renderRss: renderRssMock,
    });

    assert.strictEqual(renderRssMock.mock.calls.length, 1);
    const [feed, rssPath] = renderRssMock.mock.calls[0].arguments;
    assert.strictEqual(rssPath, path.join(outputFolder, "rss.xml"));
    assert.strictEqual(feed.title, "Example Site");
    assert.deepStrictEqual(
      feed.items.map((item) => item.link),
      ["https://example.com/posts/second", "https://example.com/posts/first"]
    );
  });
});
