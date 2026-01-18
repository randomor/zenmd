import fs from "fs/promises";
import assert from "node:assert";
import path from "path";
import os from "os";
import { describe, it, beforeEach, afterEach } from "node:test";
import { renderHtmlPage, renderSitemap } from "./renderer.js";

const inputFolder = "./src/__test__";
describe("renderHtmlPage", () => {
  let outputFolder;

  beforeEach(async () => {
    outputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "zenmd-render-page-"));
  });

  afterEach(async () => {
    if (outputFolder) {
      await fs.rm(outputFolder, { recursive: true, force: true });
      outputFolder = undefined;
    }
  });

  it("renders layout", async () => {
    const sourceFile = "./src/__test__/example.md";
    const outputFilePath = path.join(outputFolder, "example.html");
    const pageAttributes = {
      title: "Example",
      content: "Hello World",
      inputFile: sourceFile,
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath,
    };
    await renderHtmlPage(pageAttributes);

    const fileContent = await fs.readFile(
      outputFilePath,
      "utf-8"
    );
    const renderedWithLayout = fileContent.includes("layout from root");
    const renderedWithTitle = fileContent.includes("Example");
    assert(renderedWithLayout, "Layout not found");
    assert(renderedWithTitle, "Title not found");
  });

  it("converts second level file to html with right path", async () => {
    const sourceFile = "./src/__test__/second level/nested.md";
    const outputFileFolder = path.join(outputFolder, "second-level");
    const resultFile = path.join(outputFileFolder, "nested.html");
    const pageAttributes = {
      title: "Nested",
      content: "Hello World",
      inputFile: sourceFile,
      inputFolder,
      outputFileFolder,
      outputFileName: "nested.html",
      outputFilePath: resultFile,
    };
    await renderHtmlPage(pageAttributes);
    const fileExists = await fs
      .access(resultFile)
      .then(() => true)
      .catch(() => false);

    assert(fileExists);
  });

  it("renders favicon link when provided", async () => {
    const sourceFile = "./src/__test__/example.md";
    const outputFilePath = path.join(outputFolder, "example.html");
    const pageAttributes = {
      title: "Example",
      content: "Hello World",
      inputFile: sourceFile,
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath,
      frontMatter: { description: "Desc", favicon: "/favicon.ico" },
      favicon: "/favicon.ico",
    };

    await renderHtmlPage(pageAttributes);
    const fileContent = await fs.readFile(outputFilePath, "utf-8");
    assert.ok(fileContent.includes('<link rel="icon" href="/favicon.ico">'));
  });

  it("renders og:image and og:url meta tags when provided", async () => {
    const sourceFile = "./src/__test__/example.md";
    const outputFilePath = path.join(outputFolder, "example.html");
    const pageAttributes = {
      title: "Example",
      content: "Hello World",
      inputFile: sourceFile,
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath,
      frontMatter: {
        ogImage: "https://example.com/og.png",
        ogUrl: "https://example.com/example",
      },
    };

    await renderHtmlPage(pageAttributes);
    const fileContent = await fs.readFile(outputFilePath, "utf-8");
    assert.ok(
      fileContent.includes('<meta property="og:image" content="https://example.com/og.png">'),
      "Should render og:image"
    );
    assert.ok(
      fileContent.includes('<meta property="og:url" content="https://example.com/example">'),
      "Should render og:url"
    );
  });
});

describe("renderSitemap", () => {
  const baseUrl = "https://example.com";
  let outputFolder;
  let sitemapPath;
  let sitemapTree;

  beforeEach(async () => {
    outputFolder = await fs.mkdtemp(path.join(os.tmpdir(), "zenmd-render-sitemap-"));
    sitemapPath = path.join(outputFolder, "sitemap.xml");
    await fs.mkdir(path.join(outputFolder, "second-level"), { recursive: true });
    sitemapTree = {
      title: "root",
      relative_path: "/",
      order: null,
      createdAt: null,
      updatedAt: null,
      tags: [],
      children: [
        {
          title: "Example",
          relative_path: "/example",
          order: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
          tags: [],
          children: [],
        },
        {
          title: "second-level",
          relative_path: "/second-level",
          order: null,
          createdAt: null,
          updatedAt: null,
          tags: [],
          children: [
            {
              title: "Nested",
              relative_path: "/second-level/nested",
              order: null,
              createdAt: "2024-01-03T00:00:00.000Z",
              updatedAt: "2024-01-04T00:00:00.000Z",
              tags: [],
              children: [],
            },
            {
              title: "Index",
              relative_path: "/second-level/",
              order: null,
              createdAt: "2024-01-05T00:00:00.000Z",
              updatedAt: "2024-01-06T00:00:00.000Z",
              tags: [],
              children: [],
            },
          ],
        },
      ],
    };
  });

  afterEach(async () => {
    if (outputFolder) {
      await fs.rm(outputFolder, { recursive: true, force: true });
      outputFolder = undefined;
    }
  });

  it("creates a sitemap.xml with correct URLs", async () => {
    await renderSitemap(sitemapTree, sitemapPath, baseUrl);
    const sitemapContent = await fs.readFile(sitemapPath, "utf-8");
    assert(sitemapContent.includes("<loc>https://example.com/example</loc>"));
    assert(
      sitemapContent.includes(
        "<loc>https://example.com/second-level/nested</loc>"
      )
    );
    assert(
      sitemapContent.includes("<loc>https://example.com/second-level/</loc>")
    );
    assert(sitemapContent.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  });
});
