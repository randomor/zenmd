
import fs from 'fs/promises';
import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { fileToHtml } from "./renderer.js";


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
    
    assert.strictEqual(fileExists, true);
  });

  it("converts second level file to html with right path", async () => {
    const sourceFile = './src/__test__/second\ level/nested.md';
    const outputFolder = './dist/second level/';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/second level/nested.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert.strictEqual(fileExists, true);
  });

  it("falls to default layout if no layout is found", async () => {
    const sourceFile = './src/__test__/example.md';
    const outputFolder = './dist';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/example.html';
    const fileContent = await fs.readFile(resultFile, 'utf-8');
    const renderedFromDefaultLayout = fileContent.includes('Marxt');
    assert.strictEqual(renderedFromDefaultLayout, true);
  });
});