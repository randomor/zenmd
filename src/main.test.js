import fs from "fs/promises";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import path from "path";

describe("processFolder", () => {
  const inputFolder = "./src/__test__";
  const outputFolder = "./dist";
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
      frontMatter: {},
      inputFile: "src/__test__/example.md",
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: "dist/example.html",
    }));

    await processFolder(inputFolder, outputFolder, { parser });
    const fileList = [
      "src/__test__/example.md",
      "src/__test__/second level/nested.md",
      "src/__test__/second level/nested with space.md",
    ];

    assert.strictEqual(parser.mock.calls.length, 3);
    fileList.forEach((file, index) => {
      assert.strictEqual(parser.mock.calls[index].arguments[0], file);
    });
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
      frontMatter: {},
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

    assert.strictEqual(parser.mock.calls.length, 3);
    assert.strictEqual(parser.mock.calls[0].arguments[3].tags, tags);
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
