import fs from "fs/promises";
import assert from "node:assert";
import { describe, it, beforeEach } from "node:test";
import { renderHtmlPage, renderSitemap } from "./renderer.js";

const inputFolder = "./src/__test__";
const outputFolder = "./dist";

describe("renderHtmlPage", () => {
  beforeEach(
    async () => await fs.rm("./dist", { recursive: true, force: true })
  );

  it("renders layout", async () => {
    const sourceFile = "./src/__test__/example.md";
    const pageAttributes = {
      title: "Example",
      content: "Hello World",
      inputFile: sourceFile,
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: "dist/example.html",
    };
    await renderHtmlPage(pageAttributes);

    const fileContent = await fs.readFile(
      pageAttributes.outputFilePath,
      "utf-8"
    );
    const renderedWithLayout = fileContent.includes("layout from root");
    const renderedWithTitle = fileContent.includes("Example");
    assert(renderedWithLayout, "Layout not found");
    assert(renderedWithTitle, "Title not found");
  });

  it("converts second level file to html with right path", async () => {
    const sourceFile = "./src/__test__/second level/nested.md";
    const resultFile = "./dist/second-level/nested.html";
    const outputFileFolder = "./dist/second-level";
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
});

describe("renderSitemap", () => {
  const sitemapPath = "./dist/sitemap.xml";
  const baseUrl = "https://example.com";
  const pageAttributesList = [
    {
      outputFileFolder: "./dist",
      outputFilePath: "dist/example.html",
    },
    {
      outputFileFolder: "./dist/second-level",
      outputFilePath: "dist/second-level/nested.html",
    },
    {
      outputFileFolder: "./dist/second-level",
      outputFilePath: "dist/second-level/index.html",
    },
  ];

  beforeEach(async () => {
    await fs.rm("./dist", { recursive: true, force: true });
    await fs.mkdir("./dist/second-level", { recursive: true });
  });

  it("creates a sitemap.xml with correct URLs", async () => {
    await renderSitemap(pageAttributesList, sitemapPath, baseUrl);
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
