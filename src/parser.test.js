import assert from "node:assert";
import { describe, it, mock, beforeEach, afterEach, test } from "node:test";
import fsPromises from "fs/promises"; // Alias for clarity, reverted to use this everywhere for consistency
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

// New Test Suite for Obsidian Image Path Resolution via parseMarkdown
describe("Obsidian Image Path Resolution via parseMarkdown", () => {
  const testBaseDir = path.join("src", "__test__", "image_test_mds");
  const testMdFile = path.join(testBaseDir, "test.md");
  const tempOutputBaseForSuite = path.join("dist", "__test_output_parser_image_resolution"); // Unique output for this suite

  // after hook for cleanup for the entire test file.
  // Note: `test.after()` is the correct way to register a cleanup for the whole file in node:test
  // This will run after all tests in this file are done.
  // If we need suite-specific cleanup, it's more complex or needs manual triggering.
  // For now, this cleans up after all parser.test.js tests.
  // Consider if this is too broad or if a more targeted cleanup is needed.
  // For this specific suite, we are creating unique directories.
  test.after(async () => {
    try {
      await fsPromises.rm(testBaseDir, { recursive: true, force: true }); // Use fsPromises
      console.log(`Cleaned up test asset directory: ${testBaseDir}`);
    } catch (error) {
      // Don't fail test run if cleanup of assets has an issue, but log it.
      console.error(`Error during cleanup of ${testBaseDir}:`, error);
    }
    try {
      await fsPromises.rm(tempOutputBaseForSuite, { recursive: true, force: true }); // Use fsPromises
      console.log(`Cleaned up test output directory: ${tempOutputBaseForSuite}`);
    } catch (error) {
      console.error(`Error during cleanup of ${tempOutputBaseForSuite}:`, error);
    }
  });

  // Helper to run parseMarkdown and ensure output directory exists
  async function runParseMarkdownForTest(inputFile, inputDir, baseOutputDir) {
    // output directory for this specific test run, mirroring part of the input structure
    const relativeInputPath = path.relative(inputDir, path.dirname(inputFile));
    const testSpecificOutputDir = path.join(baseOutputDir, relativeInputPath);

    // Ensure the specific output directory for the test results exists
    await fsPromises.mkdir(testSpecificOutputDir, { recursive: true }); // Use fsPromises

    // parseMarkdown needs inputFolder to be the root of the project or where links are relative from.
    // For these tests, inputDir is 'src/__test__/image_test_mds'
    return parseMarkdown(inputFile, inputDir, baseOutputDir);
  }

  it("should resolve image in the same folder as the markdown file", async () => {
    const result = await runParseMarkdownForTest(testMdFile, testBaseDir, tempOutputBaseForSuite);
    assert.ok(result.content.includes('src="./image1.png"'), `Test Case 1 Failed: Image in same folder. Expected './image1.png', Got: ${result.content}`);
  });

  it("should resolve image located in a subfolder relative to the markdown file", async () => {
    const result = await runParseMarkdownForTest(testMdFile, testBaseDir, tempOutputBaseForSuite);
    // Markdown: ![[image2.png]], Actual file: subfolder/image2.png
    // Expected output relative to test.md: ./subfolder/image2.png
    assert.ok(result.content.includes('src="./subfolder/image2.png"'), `Test Case 2 Failed: Image in subfolder. Expected './subfolder/image2.png', Got: ${result.content}`);
  });

  it("should resolve explicit path 'subfolder/image2.png' and not log a warning", async () => {
    let warnOutput = "";
    const originalWarn = console.warn;
    console.warn = (message) => { warnOutput += message; };

    try {
      const result = await runParseMarkdownForTest(testMdFile, testBaseDir, tempOutputBaseForSuite);
      // Check if the specific image is correctly path-resolved in the HTML
      // The test.md includes ![[subfolder/image2.png]], which should map to src="./subfolder/image2.png"
      const expectedImgTag = 'src="./subfolder/image2.png"';
      assert.ok(result.content.includes(expectedImgTag), `Expected HTML to contain ${expectedImgTag} for explicit path. Got: ${result.content}`);

      // Assert that no warning was logged for "subfolder/image2.png"
      const warningForThisImage = 'Image "subfolder/image2.png" not found';
      assert.ok(!warnOutput.includes(warningForThisImage), `Expected no warning for "subfolder/image2.png", but got: "${warnOutput}"`);

      // It's okay if other warnings (like for image_not_found.png) are present in warnOutput here.
      // This test only cares that "subfolder/image2.png" itself wasn't warned about.

    } finally {
      console.warn = originalWarn; // Restore console.warn
    }
  });

  it("should use original path for image not found and log a specific warning", async () => {
    let warnOutput = "";
    const originalWarn = console.warn;
    console.warn = (message) => { warnOutput += message; };

    try {
      const result = await runParseMarkdownForTest(testMdFile, testBaseDir, tempOutputBaseForSuite);
      // Expected: ![[image_not_found.png]] -> ![](./image_not_found.png) (original path used)
      assert.ok(result.content.includes('src="./image_not_found.png"'), `Test Case for not found path failed. Expected './image_not_found.png', Got: ${result.content}`);
      // Check that the specific warning for image_not_found.png IS present
      assert.ok(warnOutput.includes('Image "image_not_found.png" not found'), `Warning for "image_not_found.png" was not logged or incorrect. Logged: "${warnOutput}"`);
      // Check that a warning for a found image (like image1.png) is NOT present
      assert.ok(!warnOutput.includes('Image "image1.png" not found'), `Warning for "image1.png" was unexpectedly logged: "${warnOutput}"`);
    } finally {
      console.warn = originalWarn; // Restore console.warn
    }
  });

  it("should correctly URL encode image path with spaces and not log a warning", async () => {
    let warnOutput = "";
    const originalWarn = console.warn;
    console.warn = (message) => { warnOutput += message; };

    try {
      const result = await runParseMarkdownForTest(testMdFile, testBaseDir, tempOutputBaseForSuite);
      // Markdown: ![[image with spaces.png]]
      // Expected output: ./image%20with%20spaces.png
      assert.ok(result.content.includes('src="./image%20with%20spaces.png"'), `Test Case for spaces failed. Expected './image%20with%20spaces.png', Got: ${result.content}`);
      // Assert that no warning was logged for "image with spaces.png"
      const warningForThisImage = 'Image "image with spaces.png" not found';
      assert.ok(!warnOutput.includes(warningForThisImage), `Expected no warning for "image with spaces.png", but got: "${warnOutput}"`);
    } finally {
      console.warn = originalWarn; // Restore console.warn
    }
  });
});

describe("parseMarkdown", () => {
  it("converts markdown to pageAttributes", async () => {
    const inputFile = "./src/__test__/example.md";
    mock.method(fsPromises, "readFile", async (filePath) => { // This should now work as fsPromises is correctly imported
      if (filePath === inputFile) return "# Title\nDescription"; // Example content
      if (filePath.endsWith('layout.html')) return "<html>{{{content}}}</html>"; // Ensure layout mock for this test if needed by parseMarkdown
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
