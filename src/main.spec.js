import { processFolder, fileToHtml } from "./main.js";
import fs from 'fs/promises';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

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
});

describe("processFolder", () => {
  const outputFolder = './dist';
  beforeEach(async () => await fs.rm(outputFolder, { recursive: true, force: true }));

  it("picks markdown and convert", async () => { 
    const inputFolder = "./src/__test__";
    await processFolder(inputFolder, outputFolder);
    const fileList = [
      './dist/example.html',
      './dist/second level/nested.html',
      './dist/second level/renamed-slug.html',
    ];
    const fileExists = await Promise.all(fileList.map(async (file) => {
      return await fs.access(file)
        .then(() => true)
        .catch(() => false);
    }));

    assert.strictEqual(fileExists.every((file) => file === true), true);
  });
});
