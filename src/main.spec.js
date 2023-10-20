import { markdownToHtml, fileToHtml } from "./main.js";
import fs from 'fs/promises';
import { describe, it } from 'node:test';
import assert from 'node:assert';

const outputFolder = './dist';

describe("markdownToHtml", () => {
  it("converts markdown to html", async () => { 
    const inputPattern = "./docs/*.md";
    await fs.rm(outputFolder, { recursive: true });
    await markdownToHtml(inputPattern, outputFolder);
    const resultFile = './dist/home.html';
    try {
      await fs.access(resultFile);  
      assert.strictEqual(true, true);
    } catch {
      assert.strictEqual(false, true);
    }
  })
});

describe("fileToHtml", () => {
  const sourceFile = './docs/home.md';
  it("convert file to html", async () => {
    // delete dist folder
    await fs.rm(outputFolder, { recursive: true });
    await fileToHtml(sourceFile, outputFolder, {})
    const resultFile = './dist/home.html';
    try {
      await fs.access(resultFile);  
      assert.strictEqual(true, true);
    } catch {
      assert.strictEqual(false, true);
    }
  })
})
