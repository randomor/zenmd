import { processFolder } from "./main.js";
import fs from 'fs/promises';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

describe("processFolder", () => {
  const inputFolder = "./src/__test__";
  const outputFolder = './dist';
  beforeEach(async () => await fs.rm(outputFolder, { recursive: true, force: true }));

  it("picks markdown and convert", async () => {
    const parser = mock.fn((_) => ({
      title: "Example",
      content: "Hello World",
      frontMatter: {},
      inputFile: "src/__test__/example.md",
      inputFolder,
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: "dist/example.html",
    }));

    await processFolder(inputFolder, outputFolder, { parser });
    const fileList = [
      "src/__test__/example.md",
      "src/__test__/second level/nested.md",
      "src/__test__/second level/nested with space.md",
    ];

    assert.strictEqual(parser.mock.calls.length, 3);
    fileList.forEach((file, index) => {
      assert.strictEqual(parser.mock.calls[index].arguments[0], file);
    });
  });

  it("supports individual file", async () => {
    const inputArg = "src/__test__/second level/nested.md";
    const parser = mock.fn((_) => ({
      title: "Example",
      content: "Hello World",
      frontMatter: {},
      inputFile: inputArg,
      inputFolder: "src/__test__/second level",
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: "dist/example.html",
    }));
    await processFolder(inputArg, outputFolder, { parser });

    assert.strictEqual(parser.mock.calls.length, 1);
    assert.strictEqual(parser.mock.calls[0].arguments[0], inputArg);
  });

  it("supports tags", async () => {
    const inputArg = "src/__test__";
    const parser = mock.fn((_) => ({
      title: "Example",
      content: "Hello World",
      frontMatter: {},
      inputFile: inputArg + "/example.md",
      inputFolder: "src/__test__",
      outputFileFolder: outputFolder,
      outputFileName: "example.html",
      outputFilePath: "dist/example.html",
    }));
    const tags = [
      ["tag1", "value1"],
      ["tag2", "value2"],
    ];
    await processFolder(inputArg, outputFolder, { parser, tags });

    assert.strictEqual(parser.mock.calls.length, 3);
    assert.strictEqual(parser.mock.calls[0].arguments[3].tags, tags);
  });
});
