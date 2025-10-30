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

  it("supports cleanLink option to omit .html from wiki links", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(
      sourceFile,
      inputFolder,
      outputFolder,
      "",
      { cleanLink: true }
    );

    const cleanCases = [
      { input: "[[Home]]", expected: /href="home"/ },
      { input: "[[About US]]", expected: /href="about-us"/ },
      { input: "[[About_US]]", expected: /href="about_us"/ },
      { input: "[[About US:About]]", expected: /href="about-us">About/ },
    ];

    for (const testCase of cleanCases) {
      const html = await parser.process(testCase.input);
      assert.match(html.value, testCase.expected);
      assert(!html.value.includes(".html"));
    }
  });

  it("picks up front matter and first H1 fallback", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    // Test front matter
    const fileWithFrontMatter = await parser.process(
      '---\ntitle: "Hello World"\n---\n\n# Hello Sky'
    );
    assert.equal(fileWithFrontMatter.data.frontmatter?.title, "Hello World");

    // Test H1 fallback
    const fileWithoutFrontMatter = await parser.process("# Hello World");
    assert.equal(fileWithoutFrontMatter.data.meta?.title, "Hello World");
  });

  it("renders relative links correctly", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdFile = await parser.process(
      "Link to [nested](nested.md) and ![image](./assets/testImage.webp)."
    );

    assert(mdFile.value.includes('href="nested.html"'));
    assert(mdFile.value.includes('src="./assets/testImage.webp"'));
  });

  it("renders iframe and html tags by default", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const file = await parser.process(
      '#hi\n\n<iframe src="https://example.com"></iframe>'
    );
    assert.match(file.value, /iframe/);
  });

  it("renders wikilink with right relative path from subdirectory", async () => {
    const sourceFile = "./src/__test__/second level/nested.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const file = await parser.process("[[Example]]");
    assert.match(file.value, /href="..\/example.html"/);
  });

  it("generates table of contents from headings", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);
    const md = "# Title\n\n## Table of contents\n\n## Section";
    const file = await parser.process(md);
    assert.match(file.value, /href=\"#section\"/);
  });

  it("parses image attributes with id, class, width, and height", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdWithAttrs = "![Cat](cat.png){#hero-cat .rounded width=320 height=240}";
    const file = await parser.process(mdWithAttrs);

    // Check that all attributes are present
    assert.match(file.value, /id="hero-cat"/);
    assert.match(file.value, /class="rounded"/);
    assert.match(file.value, /width="320"/);
    assert.match(file.value, /height="240"/);
  });

  it("parses image attributes with multiple classes", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdWithMultipleClasses = "![Hero](hero.jpg){.bleed .rounded .shadow}";
    const file = await parser.process(mdWithMultipleClasses);

    // Check that all classes are present
    assert.match(file.value, /class="bleed rounded shadow"/);
  });

  it("parses image attributes with only id", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdWithId = "![Logo](logo.svg){#company-logo}";
    const file = await parser.process(mdWithId);

    assert.match(file.value, /id="company-logo"/);
  });

  it("parses image attributes with only classes", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdWithClasses = "![Banner](banner.jpg){.full-width .center}";
    const file = await parser.process(mdWithClasses);

    assert.match(file.value, /class="full-width center"/);
  });

  it("parses image attributes with only dimensions", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdWithDimensions = "![Thumbnail](thumb.png){width=150 height=150}";
    const file = await parser.process(mdWithDimensions);

    assert.match(file.value, /width="150"/);
    assert.match(file.value, /height="150"/);
  });

  it("parses image attributes with data attributes", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const mdWithDataAttrs = "![Photo](photo.jpg){data-src=\"lazy.jpg\" data-loading=\"lazy\"}";
    const file = await parser.process(mdWithDataAttrs);

    assert.match(file.value, /data-src="lazy.jpg"/);
    assert.match(file.value, /data-loading="lazy"/);
  });

  it("handles images without attributes normally", async () => {
    const sourceFile = "./src/__test__/example.md";
    const parser = configParser(sourceFile, inputFolder, outputFolder);

    const normalMd = "![Normal](normal.jpg)";
    const file = await parser.process(normalMd);

    // Should still render normally without extra attributes
    assert.match(file.value, /src="\.\/normal\.jpg"/);
    assert.match(file.value, /alt="Normal"/);
  });
});

describe("Obsidian Image Processing", () => {
  const testBaseDir = path.join("src", "__test__", "image_test_mds");
  const testMdFile = path.join(testBaseDir, "test.md");
  const tempOutputDir = path.join("dist", "__test_output_consolidated");

  beforeEach(() => {
    // Mock file operations
    mock.method(fsPromises, "copyFile", async () => {});
    mock.method(fsPromises, "mkdir", async () => {});
    mock.method(fsPromises, "writeFile", async () => {});
    mock.method(fsPromises, "access", async () => {});

    // Mock fs.stat for findImageRecursive
    mock.method(fsPromises, "stat", async (filePath) => {
      // Normalize the file path for comparison
      const normalizedPath = path.normalize(filePath);

      // Define which files exist in our mock file system
      const existingFiles = [
        path.normalize(path.join(testBaseDir, "image1.png")),
        path.normalize(path.join(testBaseDir, "image with spaces.png")),
        path.normalize(path.join(testBaseDir, "subfolder", "image2.png")),
      ];

      if (
        existingFiles.some((existingFile) =>
          normalizedPath.endsWith(
            existingFile.replace(testBaseDir, "").slice(1)
          )
        )
      ) {
        return { isFile: () => true };
      }

      const error = new Error(
        `ENOENT: no such file or directory, stat '${filePath}'`
      );
      error.code = "ENOENT";
      throw error;
    });

    // Mock fs.readdir for findImageRecursive directory scanning
    mock.method(fsPromises, "readdir", async (dirPath, options) => {
      const normalizedDirPath = path.normalize(dirPath);

      if (normalizedDirPath.endsWith(path.normalize(testBaseDir))) {
        return [
          { name: "image1.png", isDirectory: () => false, isFile: () => true },
          {
            name: "image with spaces.png",
            isDirectory: () => false,
            isFile: () => true,
          },
          { name: "subfolder", isDirectory: () => true, isFile: () => false },
          { name: "test.md", isDirectory: () => false, isFile: () => true },
        ];
      } else if (
        normalizedDirPath.endsWith(
          path.normalize(path.join(testBaseDir, "subfolder"))
        )
      ) {
        return [
          { name: "image2.png", isDirectory: () => false, isFile: () => true },
        ];
      }

      return [];
    });
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("processes various Obsidian image scenarios", async () => {
    // Mock readFile for parseMarkdown
    mock.method(fsPromises, "readFile", async (filePath) => {
      if (filePath === testMdFile) {
        return `![[image1.png]]
![[image_not_found.png]]
![[image with spaces.png]]
![[subfolder/image2.png]]`;
      }
      if (filePath.endsWith("layout.html")) return "<html>{{{content}}}</html>";
      return "";
    });

    let warnOutput = "";
    const originalWarn = console.warn;
    console.warn = (message) => {
      warnOutput += message;
    };

    try {
      const result = await parseMarkdown(
        testMdFile,
        testBaseDir,
        tempOutputDir
      );

      // Test image resolution scenarios
      assert.ok(
        result.content.includes('src="./image1.png"'),
        "Same folder image failed"
      );
      assert.ok(
        result.content.includes('src="./subfolder/image2.png"'),
        "Subfolder image failed"
      );
      assert.ok(
        result.content.includes('src="./image%20with%20spaces.png"'),
        "Spaces in filename failed"
      );
      assert.ok(
        result.content.includes('src="./image_not_found.png"'),
        "Not found image should use original path"
      );

      // Test warning behavior
      assert.ok(
        warnOutput.includes('Image "image_not_found.png" not found'),
        "Missing image warning not logged"
      );
      assert.ok(
        !warnOutput.includes('Image "image1.png" not found'),
        "Found image incorrectly warned"
      );
      assert.ok(
        !warnOutput.includes('Image "subfolder/image2.png" not found'),
        "Explicit path incorrectly warned"
      );

      // Test file copying
      const copyFileCalls = fsPromises.copyFile.mock.calls;
      assert.ok(
        copyFileCalls.length >= 3,
        "Expected at least 3 file copy operations"
      );
    } finally {
      console.warn = originalWarn;
    }
  });

  it("handles configParser integration", async () => {
    const mockInputFile = "./src/__test__/obsidian-test.md";

    mock.method(fsPromises, "readFile", async (filePath) => {
      if (filePath === mockInputFile) return "![[test-image.jpg]]";
      if (filePath.endsWith("layout.html")) return "<html>{{{content}}}</html>";
      return "";
    });

    // Mock fs.stat for this test too
    mock.method(fsPromises, "stat", async (filePath) => {
      if (filePath.includes("test-image.jpg")) {
        return { isFile: () => true };
      }
      const error = new Error(
        `ENOENT: no such file or directory, stat '${filePath}'`
      );
      error.code = "ENOENT";
      throw error;
    });

    const result = await parseMarkdown(
      mockInputFile,
      path.dirname(mockInputFile),
      "./dist"
    );
    assert.match(
      result.content,
      /<img src=".\/test-image.jpg" alt="">/,
      "ConfigParser integration failed"
    );

    const copyFileCalls = fsPromises.copyFile.mock.calls;
    assert.ok(copyFileCalls.length >= 1, "File copy not triggered");
  });
});

describe("parseMarkdown", () => {
  beforeEach(() => {
    mock.method(fsPromises, "copyFile", async () => {});
    mock.method(fsPromises, "mkdir", async () => {});
    mock.method(fsPromises, "writeFile", async () => {});
    mock.method(fsPromises, "access", async () => {});
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("converts markdown to pageAttributes", async () => {
    const inputFile = "./src/__test__/example.md";
    mock.method(fsPromises, "readFile", async (filePath) => {
      if (filePath === inputFile) return "# Title\nDescription";
      if (filePath.endsWith("layout.html")) return "<html>{{{content}}}</html>";
      return "";
    });

    const pageAttributes = await parseMarkdown(
      inputFile,
      inputFolder,
      outputFolder
    );

    assert.strictEqual(pageAttributes.title, "Title");
    assert.ok(pageAttributes.content);
    assert.deepStrictEqual(pageAttributes.frontMatter, {});
    assert.strictEqual(pageAttributes.inputFile, inputFile);
    assert.strictEqual(
      pageAttributes.outputFileFolder,
      path.normalize(outputFolder)
    );
    assert.strictEqual(pageAttributes.outputFileName, "example.html");
    assert.strictEqual(
      pageAttributes.outputFilePath,
      path.join(outputFolder, "example.html")
    );
  });

  describe("tags filtering", () => {
    it("handles tag-based file filtering", async () => {
      const sourceFile = "./src/__test__/example.md";

      // Test skipping with non-matching tags
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === sourceFile) return "---\npublish: false\n---";
        if (filePath.endsWith("layout.html"))
          return "<html>{{{content}}}</html>";
        return "";
      });

      let result = await parseMarkdown(sourceFile, inputFolder, outputFolder, {
        tags: [["publish", "true"]],
      });
      assert.equal(
        result,
        undefined,
        "Should skip file with non-matching tags"
      );

      // Test processing with matching tags
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === sourceFile)
          return "---\ntitle: Test\npublish: true\n---";
        if (filePath.endsWith("layout.html"))
          return "<html>{{{content}}}</html>";
        return "";
      });

      result = await parseMarkdown(sourceFile, inputFolder, outputFolder, {
        tags: [["publish", "true"]],
      });
      assert.ok(result, "Should process file with matching tags");

      // Test processing when tag is absent (default behavior)
      const nestedFile = "./src/__test__/second level/nested with space.md";
      mock.method(fsPromises, "readFile", async (filePath) => {
        if (filePath === nestedFile)
          return "---\ntitle: Nested With Space\n---";
        if (filePath.endsWith("layout.html"))
          return "<html>{{{content}}}</html>";
        return "";
      });

      result = await parseMarkdown(nestedFile, inputFolder, outputFolder, {
        tags: [["publish", "false"]],
      });

      const expectedOutputFileName = "nested-with-space.html";
      const expectedFileDir = path.join(outputFolder, "second-level");
      const expectedFilePath = path.join(
        expectedFileDir,
        expectedOutputFileName
      );
      assert.equal(
        result.outputFilePath,
        expectedFilePath,
        "Should process file when tag is absent"
      );
    });
  });
});
