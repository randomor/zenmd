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
    const outputFolder = './dist/second level/';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/second level/nested.html';
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
      const renderedFromDefaultLayout = fileContent.includes('Marxt');
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
  it("configures renderer with right image path", async () => {
    const sourceFile = './src/__test__/example.md';
    const outputFolder = './dist';
    const marked = configRenderer(sourceFile, outputFolder);
    const html = marked('[[Home]]'); // Should render <a href="/Home">Home</a>
    assert.equal(html, '<p><a href="/Home.html">Home</a></p>\n');
  });
});