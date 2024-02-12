import assert from "node:assert";
import { describe, it } from "node:test";
import { parseMarkdown, configParser } from "./parser.js";

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

  it("renders relative link to .md with right path", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const file = await parser.process(
      "Some markdown content with a relative link to [nested](nested.md)."
    );
    const { value } = file;
    const renderedWithRightLink = value.includes('href="nested.html"');
    assert(renderedWithRightLink);
  });

  it("renders relative link to image with right path", async () => {
    const sourceFile = "./src/__test__/second level/nested.md";
    const outputFileFolder = "./dist/second-level";
    const parser = configParser(sourceFile, inputFolder, outputFileFolder);
    const file = await parser.process("![Test Image](./assets/testImage.webp)");
    const { value } = file;
    const renderedWithRightImageLink = value.includes(
      'src="./assets/testImage.webp"'
    );
    assert(renderedWithRightImageLink);
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

  describe("tags", () => {
    it("skips file if not matching tags", async () => {
      const sourceFile = "./src/__test__/example.md";
      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "true"]],
        }
      );
      // Assuming the parser is expected to return null or similar when skipping
      assert.equal(pageAttributes, null);
    });

    it("renders file if matching tags", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      const inputFolder = "./src/__test__/second level";
      const outputFolder = "./dist/second-level";
      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "true"]],
        }
      );
      assert(pageAttributes.title, "hi");
    });

    it("skips file if not matching tags", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "false"]],
        }
      );
      // Assuming the parser is expected to return null or similar when skipping
      assert.equal(pageAttributes, null);
    });

    it("does not skip files if tags doesn't exist", async () => {
      const sourceFile = "./src/__test__/second level/nested with space.md";
      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "false"]],
        }
      );
      const resultFile = "dist/second-level/nested-with-space.html";
      const { outputFilePath } = pageAttributes;
      assert.equal(outputFilePath, resultFile);
    });
  });
});
