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

  it("renders layout if layout is found", async () => {
    const sourceFile = './src/__test__/example.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder)
    const resultFile = './dist/example.html';
    const fileContent = await fs.readFile(resultFile, 'utf-8');
    const renderedWithLayout = fileContent.includes('layout from root');
    assert(renderedWithLayout, "Layout not found");
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

  it("skips file if not matching tags", async () => {
    const sourceFile = './src/__test__/example.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder, { tags: [["publish", "true"]] })
    const resultFile = './dist/example.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    assert(!fileExists);
  });

  it("renders file if matching tags", async () => {
    const sourceFile = './src/__test__/second level/nested.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder, { tags: [["publish", "true"]] })
    const resultFile = './dist/second-level/nested.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    assert(fileExists);
  })

  it("skips files with tag if tags is falseyyyy", async () => {
    const sourceFile = './src/__test__/second level/nested.md';
    await fs.mkdir('./dist/second-level', { recursive: true });
    await fileToHtml(sourceFile, inputFolder, outputFolder, { tags: [["publish", "false"]] })
    const resultFile = './dist/second-level/nested.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    assert(!fileExists);
  })
  
  it("does not skip files if tags doesn't exist", async () => {
    const sourceFile = './src/__test__/second level/nested with space.md';
    await fileToHtml(sourceFile, inputFolder, outputFolder, { tags: [["publish", "false"]] })
    const resultFile = './dist/second-level/nested-with-space.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    assert(fileExists);
  })
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
    const file = await renderer.process('---\ntitle: "Hello World"\n---\n\n# Hello Sky');
    const { title } = file.data.frontmatter || {};
    assert.equal(title, "Hello World");
  });

  it("picks up first H1 if no front matter", async () => {
    const sourceFile = './src/__test__/example.md';
    const renderer = configRenderer(sourceFile, inputFolder, outputFolder);
    const file = await renderer.process('# Hello World');
    const { title } = file.data.meta || {};
    assert.equal(title, "Hello World");
  });

  it("renders iframe and html tags by default", async () => {
    const sourceFile = './src/__test__/example.md';
    const renderer = configRenderer(sourceFile, inputFolder, outputFolder);
    const file = await renderer.process('#hi\n\n<iframe src="https://example.com"></iframe>');
    const { value } = file;
    assert.match(value, /iframe/);
  });

  describe("wiki link", () => {  
    it("renders wikilink with right relative path", async () => {
      const sourceFile = './src/__test__/second level/nested.md';
      const renderer = configRenderer(sourceFile, inputFolder, outputFolder);
      const file = await renderer.process('[[Example]]');
      const { value } = file;
      assert.match(value, /href="..\/example.html"/);
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