import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fileExists, normalizePath } from "./utils.js";


describe("fileExists", () => {
  it("returns true if file exists", async () => {
    const filePath = './src/__test__/example.md';
    const exists = await fileExists(filePath);
    assert.strictEqual(exists, true);
  });
  
  it("returns false if file does not exist", async () => {
    const filePath = './src/__test__/nonexistent.md';
    const exists = await fileExists(filePath);
    assert.strictEqual(exists, false);
  });
});

describe("normalizePath", () => {
  it("replaces spaces with hyphens", () => {
    const pathName = "this is a test";
    const normalizedPath = normalizePath(pathName);
    assert.strictEqual(normalizedPath, "this-is-a-test");
  });
  
  it("converts all characters to lowercase", () => {
    const pathName = "ThIs Is A TeSt";
    const normalizedPath = normalizePath(pathName);
    assert.strictEqual(normalizedPath, "this-is-a-test");
  });
  
  it("trims leading and trailing spaces", () => {
    const pathName = "   this is a test   ";
    const normalizedPath = normalizePath(pathName);
    assert.strictEqual(normalizedPath, "this-is-a-test");
  });

  it("converts string with %20 also to hyphen", () => {
    const pathName = "this%20is%20a%20test";
    const normalizedPath = normalizePath(pathName);
    assert.strictEqual(normalizedPath, "this-is-a-test");
  });
});