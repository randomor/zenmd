import fs from 'fs/promises';
import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { fileToHtml, configRenderer } from "./renderer.js";

const inputFolder = "./src/__test__";
const outputFolder = './dist';

describe("fileToHtml", () => {
  beforeEach(async () => await fs.rm('./dist', { recursive: true, force: true }));

  it("converts file to html", async () => {
    const sourceFile = './src/__test__/example.md';

    await fileToHtml(sourceFile, inputFolder, outputFolder, {})
    const resultFile = './dist/example.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert(fileExists);
  });

  it("converts second level file to html with right path", async () => {
    const sourceFile = './src/__test__/second\ level/nested.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder, {})
    const resultFile = './dist/second-level/nested.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert(fileExists);
  });

  describe("renders correct layout", () => {
    it("renders layout if layout is found", async () => {
      const sourceFile = './src/__test__/example.md';
      await fileToHtml(sourceFile, inputFolder, outputFolder, { templatePath: './src/__test__/layout.html' })
      const resultFile = './dist/example.html';
      const fileContent = await fs.readFile(resultFile, 'utf-8');
      const renderedWithLayout = fileContent.includes('layout from root');
      assert(renderedWithLayout, "Layout not found");
    });

    it("falls to default layout if no layout is found", async () => {
      const sourceFile = './src/__test__/example.md';
      await fileToHtml(sourceFile, inputFolder, outputFolder, {})
      const resultFile = './dist/example.html';
      const fileContent = await fs.readFile(resultFile, 'utf-8');
      const renderedFromDefaultLayout = fileContent.includes('ZenMD');
      assert(renderedFromDefaultLayout);
    });
  });

  it("renders relative link to .md with right path", async () => {
    const sourceFile = './src/__test__/example.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder, {})
    const resultFile = './dist/example.html';
    const fileContent = await fs.readFile(resultFile, 'utf-8');
    const renderedWithRightLink = fileContent.includes('nested.html');
    assert(renderedWithRightLink);
  });

  it("renders relative link to image with right path", async () => {
    const sourceFile = './src/__test__/second level/nested.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder, {})
    const resultFile = './dist/second-level/nested.html';
    const fileContent = await fs.readFile(resultFile, 'utf-8');
    const renderedWithRightImageLink = fileContent.includes('testImage.webp');
    assert(renderedWithRightImageLink);
  });
});

describe("configRenderer", () => {
  const testCases = [
    { input: '[[Home]]', expected: /href="home.html"/ },
    { input: '[[About US]]', expected: /href="about-us.html"/ },
    { input: '[[About_US]]', expected: /href="about_us.html"/ },
    { input: '[[About US:About]]', expected: /href="about-us.html">About</ },
  ];

  it("configures renderer with right path", async () => {
    const sourceFile = './src/__test__/example.md';
    const renderer = configRenderer(sourceFile, inputFolder, outputFolder);

    for (const testCase of testCases) {
      const html = await renderer.process(testCase.input);
      assert.match(html.value, testCase.expected);
    }
  });

  it("picks up front matter", async () => {
    const sourceFile = './src/__test__/example.md';
    const renderer = configRenderer(sourceFile, inputFolder, outputFolder);
    const file = await renderer.process('---\ntitle: "Hello World"\n---\n\n# Hello World');
    const { title } = file.data.frontmatter || {};
    assert.equal(title, "Hello World");
  });

  describe("wiki link", () => {  
    it("renders wikilink with right relative path", async () => {
      const sourceFile = './src/__test__/second level/nested.md';
      const renderer = configRenderer(sourceFile, inputFolder, outputFolder);
      const file = await renderer.process('[[Hello]]');
      const { value } = file;
      assert.match(value, /href="..\/hello.html"/);
    });

    // it.only("renders relative wikilink", async () => {
    //   const sourceFile = './src/__test__/example.md';
    //   const renderer = configRenderer(sourceFile, inputFolder, outputFolder);
    //   const file = await renderer.process('[[./Hello]]');
    //   const { value } = file;
    //   assert.match(value, /href="\.\/hello.html"/);
    // })
});
});