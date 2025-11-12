import fs from "fs/promises";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import path from "path";

describe("processFolder", () => {
  const inputFolder = "./src/__test__";
  const fixturesRoot = path.join(inputFolder, "fixtures");
  const outputFolder = "./dist";
  const allMarkdownFiles = [
    "src/__test__/example.md",
    "src/__test__/second level/nested.md",
    "src/__test__/second level/nested with space.md",
    "src/__test__/fixtures/favicon-builtin/index.md",
    "src/__test__/fixtures/favicon-root/index.md",
    "src/__test__/fixtures/site-config/index.md",
  ];
  beforeEach(
    async () => await fs.rm(outputFolder, { recursive: true, force: true })
  );
  afterEach(
    async () =>
      await fs.rm(path.join(outputFolder, "robots.txt"), { force: true })
  );

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
      outputFilePath: "dist/example.html",
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
      outputFilePath: "dist/example.html",
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
      outputFilePath: "dist/example.html",
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
    const [pages] = renderSitemapMock.mock.calls[0].arguments;
    assert.strictEqual(pages.length, allMarkdownFiles.length - 1);
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
  const outputFolder = "./dist";
  beforeEach(
    async () => await fs.rm(outputFolder, { recursive: true, force: true })
  );

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
    const [pageAttributesList, sitemapPath, calledBaseUrl] =
      renderSitemapMock.mock.calls[0].arguments;
    assert.ok(Array.isArray(pageAttributesList));
    assert.strictEqual(typeof sitemapPath, "string");
    assert.strictEqual(calledBaseUrl, baseUrl);
    assert.ok(sitemapPath.endsWith("sitemap.xml"));
    assert.ok(pageAttributesList.length > 0);
    assert.ok(pageAttributesList[0].outputFilePath);
    // Ensure renderHtmlPage is called for each page
    assert.strictEqual(
      renderHtmlPageMock.mock.calls.length,
      pageAttributesList.length
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
