import fs from 'fs/promises';
import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { fileToHtml, configRenderer } from "./renderer.js";

describe("fileToHtml", () => {
  beforeEach(async () => await fs.rm('./dist', { recursive: true, force: true }));

  it("converts file to html", async () => {
    const sourceFile = './src/__test__/example.md';
    const outputFolder = './dist';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/example.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert(fileExists);
  });

  it("converts second level file to html with right path", async () => {
    const sourceFile = './src/__test__/second\ level/nested.md';
    const outputFolder = './dist/second-level/';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/second-level/nested.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert(fileExists);
  });

  describe("renders correct layout", () => {
    
    it("renders layout if layout is found", async () => {
      const sourceFile = './src/__test__/example.md';
      const outputFolder = './dist';
      await fileToHtml(sourceFile, outputFolder, { templatePath: './src/__test__/layout.html' })
      const resultFile = './dist/example.html';
      const fileContent = await fs.readFile(resultFile, 'utf-8');
      const renderedWithLayout = fileContent.includes('layout from root');
      assert(renderedWithLayout, "Layout not found");
    });

    it("falls to default layout if no layout is found", async () => {
      const sourceFile = './src/__test__/example.md';
      const outputFolder = './dist';
      await fileToHtml(sourceFile, outputFolder, {})
      const resultFile = './dist/example.html';
      const fileContent = await fs.readFile(resultFile, 'utf-8');
      const renderedFromDefaultLayout = fileContent.includes('ZenMD');
      assert(renderedFromDefaultLayout);
    });
  });

  it("renders relative link to .md with right path", async () => {
    const sourceFile = './src/__test__/example.md';
    const outputFolder = './dist';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/example.html';
    const fileContent = await fs.readFile(resultFile, 'utf-8');
    const renderedWithRightLink = fileContent.includes('nested.html');
    assert(renderedWithRightLink);
  });

  it("renders relative link to image with right path", async () => {
    const sourceFile = './src/__test__/second level/nested.md';
    const outputFolder = './dist/second level/';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/second level/nested.html';
    const fileContent = await fs.readFile(resultFile, 'utf-8');
    const renderedWithRightImageLink = fileContent.includes('testImage.webp');
    assert(renderedWithRightImageLink);
  });
});

describe("configRenderer", () => {
  const testCases = [
    { input: '[[Home]]', expectedOutput: '<p><a href="home.html">Home</a></p>\n' },
    { input: '[[About US]]', expectedOutput: '<p><a href="about-us.html">About US</a></p>\n' },
    { input: '[[About_US]]', expectedOutput: '<p><a href="about_us.html">About_US</a></p>\n' },
    { input: '[[About US:About]]', expectedOutput: '<p><a href="about-us.html">About</a></p>\n' },
  ];

  it("configures renderer with right path", async () => {
    const sourceFile = './src/__test__/example.md';
    const outputFolder = './dist';
    const renderer = configRenderer(sourceFile, outputFolder);

    for (const testCase of testCases) {
      const html = await renderer.process(testCase.input);
      assert.equal(html.value, testCase.expectedOutput);
    }
  });

  it("picks up front matter", async () => {
    const sourceFile = './src/__test__/example.md';
    const outputFolder = './dist';
    const renderer = configRenderer(sourceFile, outputFolder);
    const file = await renderer.process('---\ntitle: "Hello World"\n---\n\n# Hello World');
    const { title } = file.data.frontmatter || {};
    assert.equal(title, "Hello World");
  });
});