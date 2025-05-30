import assert from "node:assert";
import { describe, it, mock, beforeEach, afterEach } from "node:test";
import fsPromises from "fs/promises"; // Alias for clarity
import * as fsSync from "fs"; // For sync methods like existsSync, readdirSync
import path from "path"; // Import the 'path' module
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
    const mockInputFile = "./src/__test__/obsidian-configParser-test.md";
    const testInputFolder = path.dirname(mockInputFile);
    const testOutputFolder = "./dist";

    beforeEach(() => {
      mock.method(fsPromises, "copyFile", async () => {});
      mock.method(fsPromises, "mkdir", async () => {});
      mock.method(fsPromises, "writeFile", async () => {});
      mock.method(fsPromises, "access", async () => {});
      // readFile mock is set per test
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it("renders Obsidian-style image link in root directory", async () => {
      const markdownInput = "![[image.png]]";
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === mockInputFile) return markdownInput;
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const result = await parseMarkdown(mockInputFile, testInputFolder, testOutputFolder);
      assert.match(result.content, /<p><img src=".\/image.png" alt=""><\/p>/, "HTML output for root image is incorrect");

      const copyFileCalls = fsPromises.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1, "fs.copyFile was not called once");
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith(path.normalize(path.join("src", "__test__", "image.png"))), `Source path mismatch: ${copyFileArgs[0]}`);
      assert.ok(copyFileArgs[1].endsWith(path.normalize(path.join("dist", "image.png"))), `Destination path mismatch: ${copyFileArgs[1]}`);
      const mkdirCalls = fsPromises.mkdir.mock.calls;
      assert.ok(mkdirCalls.length >= 1, "fs.mkdir was not called at least once for output");
    });

    it("renders Obsidian-style image link in a subdirectory", async () => {
      const markdownInput = "![[folder/image.png]]";
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === mockInputFile) return markdownInput;
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const result = await parseMarkdown(mockInputFile, testInputFolder, testOutputFolder);
      assert.match(result.content, /<p><img src=".\/folder\/image.png" alt=""><\/p>/, "HTML output for subdirectory image is incorrect");

      const copyFileCalls = fsPromises.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1);
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith(path.normalize(path.join("src", "__test__", "folder", "image.png"))), `Source path: ${copyFileArgs[0]}`);
      assert.ok(copyFileArgs[1].endsWith(path.normalize(path.join("dist", "folder", "image.png"))), `Dest path: ${copyFileArgs[1]}`);
      const mkdirCalls = fsPromises.mkdir.mock.calls;
      assert.ok(mkdirCalls.length >= 1);
    });

    it("renders Obsidian-style image link with spaces in name", async () => {
      const markdownInput = "![[image with space.png]]";
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === mockInputFile) return markdownInput;
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const result = await parseMarkdown(mockInputFile, testInputFolder, testOutputFolder);
      assert.match(result.content, /<p><img src=".\/image%20with%20space.png" alt=""><\/p>/, "HTML output for image with space is incorrect");

      const copyFileCalls = fsPromises.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1);
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith(path.normalize(path.join("src", "__test__", "image with space.png"))), `Source path mismatch for space test: ${copyFileArgs[0]}`);
      assert.ok(copyFileArgs[1].endsWith(path.normalize(path.join("dist", "image with space.png"))), `Destination path mismatch for space test: ${copyFileArgs[1]}`);
      const mkdirCalls = fsPromises.mkdir.mock.calls;
      assert.ok(mkdirCalls.length >= 1);
    });

    it("renders Obsidian-style image link (imageDir default, via parseMarkdown)", async () => {
      const markdownInput = "![[my-image.jpg]]";
       mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === mockInputFile) return markdownInput;
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const result = await parseMarkdown(mockInputFile, testInputFolder, testOutputFolder);
      assert.match(result.content, /<p><img src=".\/my-image.jpg" alt=""><\/p>/, "HTML output for image is incorrect");

      const copyFileCalls = fsPromises.copyFile.mock.calls;
      assert.strictEqual(copyFileCalls.length, 1, "fs.copyFile was not called once for imageDir test");
      const copyFileArgs = copyFileCalls[0].arguments;
      assert.ok(copyFileArgs[0].endsWith(path.normalize(path.join("src", "__test__", "my-image.jpg"))), `Source path mismatch for imageDir test: ${copyFileArgs[0]}`);
      assert.ok(copyFileArgs[1].endsWith(path.normalize(path.join("dist", "my-image.jpg"))), `Destination path mismatch for imageDir test: ${copyFileArgs[1]}`);
      const mkdirCalls = fsPromises.mkdir.mock.calls;
      assert.ok(mkdirCalls.length >= 1, "fs.mkdir was not called for imageDir test");
    });
  });
});

describe("parseMarkdown", () => {
  it("converts markdown to pageAttributes", async () => {
    const inputFile = "./src/__test__/example.md";
    mock.method(fsPromises, "readFile", async (filePath) => {
      if (filePath === inputFile) return "# Title\nDescription"; // Example content
      if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
      return "";
    });

    const pageAttributes = await parseMarkdown(
      inputFile,
      inputFolder,  // "./src/__test__"
      outputFolder  // "./dist"
    );
    assert.strictEqual(pageAttributes.title, "Title", "Title should be inferred from H1");
    assert.ok(pageAttributes.content, "Content should exist");
    assert.deepStrictEqual(pageAttributes.frontMatter, {}, "Frontmatter should be empty for this input");
    assert.strictEqual(pageAttributes.inputFile, inputFile);
    // If inputFile is in the root of inputFolder, outputFileFolder should be the same as outputFolder.
    assert.strictEqual(pageAttributes.outputFileFolder, path.normalize(outputFolder), `outputFileFolder mismatch: expected ${path.normalize(outputFolder)}, got ${pageAttributes.outputFileFolder}`);
    assert.strictEqual(pageAttributes.outputFileName, "example.html");
    assert.strictEqual(pageAttributes.outputFilePath, path.join(outputFolder, "example.html"));
  });

  describe("tags", () => {
    beforeEach(() => {
      mock.method(fsPromises, "copyFile", async () => {});
      mock.method(fsPromises, "mkdir", async () => {});
      mock.method(fsPromises, "writeFile", async () => {});
      mock.method(fsPromises, "access", async () => {});
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it("skips file if not matching tags", async () => {
      const sourceFile = "./src/__test__/example.md";
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === sourceFile) return "---\ntags:\n  - category: news\npublish: false\n---";
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "true"]],
        }
      );
      assert.equal(pageAttributes, undefined);
    });

    it("renders file if matching tags", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      const tempInputFolder = "./src/__test__";
      const tempOutputFolder = "./dist";

      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === sourceFile) return "---\ntitle: hi\npublish: true\n---";
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const pageAttributes = await parseMarkdown(
        sourceFile,
        tempInputFolder,
        tempOutputFolder,
        {
          tags: [["publish", "true"]],
        }
      );
      assert(pageAttributes.title, "hi");
    });

    it("skips file if not matching tags with 'false' value", async () => {
      const sourceFile = "./src/__test__/second level/nested.md";
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === sourceFile) return "---\ntitle: hi\npublish: true\n---";
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const pageAttributes = await parseMarkdown(
        sourceFile,
        inputFolder,
        outputFolder,
        {
          tags: [["publish", "false"]],
        }
      );
      assert.equal(pageAttributes, undefined);
    });

    it("does not skip files if tags condition is met for non-boolean value or tag absence", async () => {
      const sourceFile = "./src/__test__/second level/nested with space.md";
      const tempInputFolder = "./src/__test__";
      const tempOutputFolder = "./dist";

      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === sourceFile) return "---\ntitle: Nested With Space\n---";
        if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>";
        return "";
      });

      const pageAttributes = await parseMarkdown(
        sourceFile,
        tempInputFolder,
        tempOutputFolder,
        {
          tags: [["publish", "false"]],
        }
      );
      const expectedOutputFileName = "nested-with-space.html";
      const expectedFileDir = path.join(tempOutputFolder, "second-level");
      const expectedFilePath = path.join(expectedFileDir, expectedOutputFileName);

      assert.equal(pageAttributes.outputFilePath, expectedFilePath);
    });
  });
});
