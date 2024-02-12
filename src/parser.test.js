import assert from "node:assert";
import { describe, it } from "node:test";
import { parseMarkdown, configParser } from "./renderer.js";

const inputFolder = "./src/__test__";
const outputFolder = "./dist";

describe("configParser", () => {
  const testCases = [
    { input: "[[Home]]", expected: /href="home.html"/ },
    { input: "[[About US]]", expected: /href="about-us.html"/ },
    { input: "[[About_US]]", expected: /href="about_us.html"/ },
    { input: "[[About US:About]]", expected: /href="about-us.html">About</ },
  ];

  it("configures parser with right path", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    for (const testCase of testCases) {
      const html = await parser.process(testCase.input);
      assert.match(html.value, testCase.expected);
    }
  });

  it("picks up front matter", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const file = await parser.process(
      '---\ntitle: "Hello World"\n---\n\n# Hello Sky'
    );
    const { title } = file.data.frontmatter || {};
    assert.equal(title, "Hello World");
  });

  it("picks up first H1 if no front matter", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const file = await parser.process("# Hello World");
    const { title } = file.data.meta || {};
    assert.equal(title, "Hello World");
  });

  it("renders iframe and html tags by default", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const file = await parser.process(
      '#hi\n\n<iframe src="https://example.com"></iframe>'
    );
    const { value } = file;
    assert.match(value, /iframe/);
  });

  describe("wiki link", () => {
    it("renders wikilink with right relative path", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      const parser = configParser(sourceFile, inputFolder, outputFolder);
      const file = await parser.process("[[Example]]");
      const { value } = file;
      assert.match(value, /href="..\/example.html"/);
    });
  });
});

describe("parseMarkdown", () => {
  it("converts markdown to pageAttributes", async () => {
    const inputFile = "./src/__test__/example.md";
    const pageAttributes = await parseMarkdown(
      inputFile,
      inputFolder,
      outputFolder
    );
    assert(pageAttributes.title, "Title");
    assert(pageAttributes.content);
    assert(pageAttributes.frontMatter, {});
    assert(pageAttributes.inputFile, inputFile);
    assert(pageAttributes.outputFileFolder, "./dist");
    assert(pageAttributes.outputFileName, "example.html");
    assert(pageAttributes.outputFilePath, "dist/example.html");
  });
});
