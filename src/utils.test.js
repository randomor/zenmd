import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fileExists, normalizePath, findLayout, isUrl } from "./utils.js";

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

describe("isUrl", () => {
  it("returns true if string is a valid URI", () => {
    const uriExamples = [
      "http://example.com",
      "https://example.com",
      "ftp://example.com",
      "mailto:support@example.com",
    ];
    uriExamples.forEach((uri) => {
      assert.strictEqual(isUrl(uri), true, `Failed for ${uri}`);
    });
  });

  it("returns false if string is not a valid URI", () => {
    const notUriExamples = [
      "/path",
      "example",
      "example@com",
      "/path",
      "example.com", //This is not a valid URI as we can't have this as uri without also marking path.md as.
      "path.md",
    ];
    notUriExamples.forEach((uri) => {
      assert.strictEqual(isUrl(uri), false, `Failed for ${uri}`);
    });
  });
});

