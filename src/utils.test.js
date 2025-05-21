import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fileExists, findLayout } from "./utils.js"; // Removed normalizePath

describe("fileExists", () => {
  it("returns true if file exists", async () => {
    const filePath = "./src/__test__/example.md";
    const exists = await fileExists(filePath);
    assert.strictEqual(exists, true);
  });

  it("returns false if file does not exist", async () => {
    const filePath = "./src/__test__/nonexistent.md";
    const exists = await fileExists(filePath);
    assert.strictEqual(exists, false);
  });
});

// Removed describe("normalizePath", ...) block

describe("findLayout", () => {
  it("returns layout layout found in same folder", async () => {
    const inputFile = "./src/__test__/example.md";
    const inputFolder = "./src/__test__";
    const layout = await findLayout(inputFile, inputFolder);
    assert.strictEqual(layout, "src/__test__/layout.html");
  });

  it("returns default if can't find default", async () => {
    const inputFile = "./readme.md";
    const inputFolder = "./";
    const layout = await findLayout(inputFile, inputFolder);
    assert.match(layout, /default_layout\.html/);
  });
});

