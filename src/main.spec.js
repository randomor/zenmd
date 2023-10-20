import { markdownToHtml, fileToHtml } from "./main.js";
import fs from 'fs/promises';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

const outputFolder = './dist';

describe("markdownToHtml", () => {
  beforeEach(async () => {
    await fs.rm(outputFolder, { recursive: true, force: true });
  });

  it("converts markdown to html", async () => { 
    const inputPattern = "./docs/*.md";
    await markdownToHtml(inputPattern, outputFolder);
    const resultFile = './dist/home.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert.strictEqual(fileExists, true);
  });
});

describe("fileToHtml", () => {
  beforeEach(async () => {
    await fs.rm(outputFolder, { recursive: true, force: true });
  });

  it("convert file to html", async () => {
    const sourceFile = './docs/home.md';
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/home.html';
    const fileExists = await fs.access(resultFile)
      .then(() => true)
      .catch(() => false);
    
    assert.strictEqual(fileExists, true);
  });
});
