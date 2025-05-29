import assert from "node:assert";
import { describe, it, mock, beforeEach, afterEach } from "node:test";
import fs from "fs/promises";
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

  describe("Obsidian-style image references", () => {
    // Using a consistent mock inputFile for all tests in this suite
    const mockInputFile = "./src/__test__/obsidian-test.md";
    // Define a common layout file path that might be read by parseMarkdown/renderHtmlPage
    const mockLayoutPath = "./src/__test__/layout.html";


    beforeEach(() => {
      mock.method(fs, "copyFile", async () => {});
      mock.method(fs, "mkdir", async () => {});
      mock.method(fs, "writeFile", async () => {}); // For page rendering
      mock.method(fs, "access", async () => {});   // For directory checks
      // readFile will be mocked per test
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it("renders Obsidian-style image link in root directory", async (t) => {
      const markdownInput = "![[image.png]]";
      // Mock readFile to return our test markdown and a default layout
      mock.method(fs, "readFile", async (path) => {
        if (path === mockInputFile) return markdownInput;
        if (path.endsWith('layout.html')) return "<html>{{{content}}}</html>"; // Generic layout
        return ""; // Default for other unexpected reads
      });

      const result = await parseMarkdown(mockInputFile, inputFolder, outputFolder);
      assert.match(result.content, /<img src=".\/image.png">/, "HTML output for root image is incorrect");
      
      const copyFileCalls = fs.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1, "fs.copyFile was not called once");
      const copyFileArgs = copyFileCalls[0].arguments;
      // Source path is resolved relative to mockInputFile's directory
      assert.ok(copyFileArgs[0].endsWith("src/__test__/image.png"), `Source path mismatch: ${copyFileArgs[0]}`);
      // Destination path is outputFolder + (imageDir from config, default "") + image.png
      assert.ok(copyFileArgs[1].endsWith("dist/obsidian-test/image.png"), `Destination path mismatch: ${copyFileArgs[1]}`);
      assert.ok(fs.mkdir.mock.calls.length >= 1, "fs.mkdir was not called at least once for output");
    });

    it("renders Obsidian-style image link in a subdirectory", async (t) => {
      const markdownInput = "![[folder/image.png]]";
      mock.method(fs, "readFile", async (path) => {
        if (path === mockInputFile) return markdownInput;
        if (path.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const result = await parseMarkdown(mockInputFile, inputFolder, outputFolder);
      assert.match(result.content, /<img src=".\/folder\/image.png">/, "HTML output for subdirectory image is incorrect");

      const copyFileCalls = fs.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1);
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith("src/__test__/folder/image.png"), `Source path: ${copyFileArgs[0]}`);
      assert.ok(copyFileArgs[1].endsWith("dist/obsidian-test/folder/image.png"), `Dest path: ${copyFileArgs[1]}`);
      assert.ok(fs.mkdir.mock.calls.length >= 1);
    });

    it("renders Obsidian-style image link with spaces in name", async (t) => {
      const markdownInput = "![[image with space.png]]";
      mock.method(fs, "readFile", async (path) => {
        if (path === mockInputFile) return markdownInput;
        if (path.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });
      
      const result = await parseMarkdown(mockInputFile, inputFolder, outputFolder);
      // The regex in parseMarkdown converts this to ![](./image with space.png)
      // The final src in HTML should be URL encoded if spaces are an issue, 
      // but usually browsers handle it. Let's assume current behavior is direct.
      assert.match(result.content, /<img src=".\/image with space.png">/, "HTML output for image with space is incorrect");

      const copyFileCalls = fs.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1);
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith("src/__test__/image with space.png"));
      assert.ok(copyFileArgs[1].endsWith("dist/obsidian-test/image with space.png"));
      assert.ok(fs.mkdir.mock.calls.length >= 1);
    });

    // This test needs adjustment. `parseMarkdown` doesn't directly take `imageDir`.
    // The `imageDir` is configured in `configParser`.
    // When testing via `parseMarkdown`, `imageDir` will be its default (likely "").
    // So, the expected output path won't include "custom-assets".
    it("renders Obsidian-style image link (imageDir not applicable via parseMarkdown directly)", async (t) => {
      const markdownInput = "![[my-image.jpg]]";
      mock.method(fs, "readFile", async (path) => {
        if (path === mockInputFile) return markdownInput;
        if (path.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      // `imageDir` is not passed to parseMarkdown, so it will use default ""
      const result = await parseMarkdown(mockInputFile, inputFolder, outputFolder);
      // Expected src will not have "custom-assets" because imageDir is not passed here.
      assert.match(result.content, /<img src=".\/my-image.jpg">/, "HTML output for image is incorrect");

      const copyFileCalls = fs.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1);
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith("src/__test__/my-image.jpg"));
      // Destination will be in dist/obsidian-test/my-image.jpg
      assert.ok(copyFileArgs[1].endsWith("dist/obsidian-test/my-image.jpg"));
      assert.ok(fs.mkdir.mock.calls.length >= 1);
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
      assert.equal(pageAttributes, undefined);
    });

    it("renders file if matching tags", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      // fs.copyFile and fs.mkdir need to be mocked if this test triggers image processing.
      // For now, assuming "nested.md" does not contain images that would be processed by parseMarkdown directly.
      // If it does, this test might fail or have unintended side effects without mocks.
      const tempInputFolder = "./src/__test__"; // Adjusted to be the root of test files for consistency
      const tempOutputFolder = "./dist"; // Adjusted for consistency

      // Mock fs methods for this specific test if it could involve image processing
      const originalCopyFile = fs.copyFile;
      const originalMkdir = fs.mkdir;
      fs.copyFile = mock.fn(originalCopyFile);
      fs.mkdir = mock.fn(originalMkdir);

      const pageAttributes = await parseMarkdown(
        sourceFile,
        tempInputFolder, // Use the adjusted inputFolder
        tempOutputFolder, // Use the adjusted outputFolder
        {
          tags: [["publish", "true"]],
        }
      );
      assert(pageAttributes.title, "hi");

      // Restore original methods and reset mocks
      fs.copyFile = originalCopyFile;
      fs.mkdir = originalMkdir;
      mock.reset();
    });

    it("skips file if not matching tags with 'false' value", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "false"]], // This tag means "publish" must be explicitly false or not present
        }
      );
      // nested.md has publish: true, so it should be skipped.
      assert.equal(pageAttributes, undefined);
    });

    it("does not skip files if tags condition is met for non-boolean value or tag absence", async () => {
      const sourceFile = "./src/__test__/second level/nested with space.md";
       // nested with space.md does not have 'publish' tag, so it should render if condition is e.g. publish: false
      // Mock fs methods for this specific test if it could involve image processing
      const originalCopyFile = fs.copyFile;
      const originalMkdir = fs.mkdir;
      fs.copyFile = mock.fn(originalCopyFile);
      fs.mkdir = mock.fn(originalMkdir);
      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "false"]], // This means it should render if publish is not 'true'
        }
      );
      const resultFile = "dist/second-level/nested-with-space.html";
      const { outputFilePath } = pageAttributes;
      assert.equal(outputFilePath, resultFile);

      // Restore original methods and reset mocks
      fs.copyFile = originalCopyFile;
      fs.mkdir = originalMkdir;
      mock.reset();
    });
  });
});
