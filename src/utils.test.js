import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import {
  fileExists,
  folderEmpty,
  normalizePath,
  findLayout,
  isUrl,
  findImageRecursive,
} from "./utils.js";
import { fileURLToPath } from "url";

// Helper function to create directories recursively if they don't exist
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
  }
}

// __dirname is not available in ES modules directly, so we derive it
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

describe("findImageRecursive", () => {
  const testDir = path.join(__dirname, "temp-test-dir-findImageRecursive");

  // Files for the new structure:
  const image1 = "image1.png"; // in testDir root
  const image2 = "image2.png"; // in testDir/subfolder
  const image4 = "image4.png"; // in testDir/subfolder/deepfolder
  const imageSibling = "image_sibling.png"; // in testDir/subfolder, for ../ traversal test

  beforeEach(async () => {
    // Base directories
    await ensureDir(testDir);
    const subfolderPath = path.join(testDir, "subfolder");
    const deepfolderPath = path.join(subfolderPath, "deepfolder");
    const anotherfolderPath = path.join(testDir, "anotherfolder");

    await ensureDir(subfolderPath);
    await ensureDir(deepfolderPath);
    await ensureDir(anotherfolderPath);

    // Create files
    await fs.writeFile(path.join(testDir, image1), "image1 content");
    await fs.writeFile(path.join(subfolderPath, image2), "image2 content");
    await fs.writeFile(path.join(deepfolderPath, image4), "image4 content");
    await fs.writeFile(
      path.join(subfolderPath, imageSibling),
      "imageSibling content"
    );
    await fs.writeFile(
      path.join(anotherfolderPath, "another-file.txt"),
      "dummy text content"
    ); // For existing structure compatibility if any test depends on anotherfolder
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(
        `Warning: Could not fully clean up ${testDir}. Error: ${error.message}`
      );
    }
  });

  // Existing tests adapted or confirmed
  it("should find an image (simple name) nested deeply when search starts from root", async () => {
    // This test replaces the old "should find an image nested in subdirectories"
    // image4.png is in subfolder/deepfolder/image4.png
    const foundPath = await findImageRecursive(image4, testDir);
    const expectedPath = path
      .join("subfolder", "deepfolder", image4)
      .replace(/\\/g, "/");
    assert.strictEqual(
      foundPath,
      expectedPath,
      `Expected to find ${image4} at ${expectedPath}, but got ${foundPath}`
    );
  });

  it("should return null if the image (simple name) is not found anywhere", async () => {
    const foundPath = await findImageRecursive(
      "non-existent-simple.png",
      testDir
    );
    assert.strictEqual(
      foundPath,
      null,
      `Expected to get null for non-existent-simple.png, but got ${foundPath}`
    );
  });

  it("should return null if the starting directory does not exist", async () => {
    const foundPath = await findImageRecursive(
      image1,
      path.join(testDir, "non-existent-start-dir")
    );
    assert.strictEqual(
      foundPath,
      null,
      `Expected to get null for non-existent starting directory, but got ${foundPath}`
    );
  });

  it("should find an image (simple name) in the root of the search directory", async () => {
    // This test is similar to an old one, confirms image1.png in testDir root
    const foundPath = await findImageRecursive(image1, testDir);
    assert.strictEqual(
      foundPath,
      image1,
      `Expected to find ${image1} at ${image1}, but got ${foundPath}`
    );
  });

  // New test cases for explicit paths
  it("should find an image via explicit path 'subfolder/image2.png' when search starts from root", async () => {
    const explicitPath = path.join("subfolder", image2).replace(/\\/g, "/");
    const foundPath = await findImageRecursive(explicitPath, testDir);
    assert.strictEqual(
      foundPath,
      explicitPath,
      `Expected to find at ${explicitPath}, but got ${foundPath}`
    );
  });

  it("should find an image via explicit path 'subfolder/deepfolder/image4.png' when search starts from root", async () => {
    const explicitPath = path
      .join("subfolder", "deepfolder", image4)
      .replace(/\\/g, "/");
    const foundPath = await findImageRecursive(explicitPath, testDir);
    assert.strictEqual(
      foundPath,
      explicitPath,
      `Expected to find at ${explicitPath}, but got ${foundPath}`
    );
  });

  it("should return null for an explicit path 'subfolder/nonexistent.png' if file is missing", async () => {
    const explicitPath = path
      .join("subfolder", "nonexistent.png")
      .replace(/\\/g, "/");
    const foundPath = await findImageRecursive(explicitPath, testDir);
    assert.strictEqual(
      foundPath,
      null,
      `Expected null for missing explicit path, but got ${foundPath}`
    );
  });

  it("should return null for an explicit path 'nonexistentfolder/image1.png' if intermediate folder is missing", async () => {
    const explicitPath = path
      .join("nonexistentfolder", image1)
      .replace(/\\/g, "/");
    const foundPath = await findImageRecursive(explicitPath, testDir);
    assert.strictEqual(
      foundPath,
      null,
      `Expected null for path with missing intermediate folder, but got ${foundPath}`
    );
  });

  it("should find an image via explicit path which is a simple filename already in currentSearchDir (root)", async () => {
    // This is effectively the same as "should find an image (simple name) in the root of the search directory"
    // but confirms behavior when explicit path === simple name
    const foundPath = await findImageRecursive(image1, testDir); // image1 is 'image1.png'
    assert.strictEqual(
      foundPath,
      image1,
      `Expected to find ${image1} directly, but got ${foundPath}`
    );
  });

  it("should find an image using explicit relative path with '../' traversal", async () => {
    const searchStartDir = path.join(testDir, "anotherfolder");
    // imageSibling is in testDir/subfolder/image_sibling.png
    // from testDir/anotherfolder, path is ../subfolder/image_sibling.png
    const relativePath = path
      .join("..", "subfolder", imageSibling)
      .replace(/\\/g, "/");
    const foundPath = await findImageRecursive(relativePath, searchStartDir);
    assert.strictEqual(
      foundPath,
      relativePath,
      `Expected to find at ${relativePath} from ${searchStartDir}, but got ${foundPath}`
    );
  });
});

describe("utils.js functions", () => {
  beforeEach(async () => {
    // Clean up any test files before each test
  });

  afterEach(async () => {
    // Clean up any test files after each test
  });

  describe("fileExists function", () => {
    it("should return true for existing files", async () => {
      const tempFile = path.join(__dirname, "test-temp-file.txt");

      try {
        await fs.writeFile(tempFile, "test content");
        const exists = await fileExists(tempFile);
        assert.strictEqual(exists, true);
      } finally {
        await fs.rm(tempFile, { force: true });
      }
    });

    it("should return false for non-existent files", async () => {
      const nonExistentFile = path.join(
        __dirname,
        "this-file-does-not-exist.txt"
      );
      const exists = await fileExists(nonExistentFile);
      assert.strictEqual(exists, false);
    });
  });

  describe("folderEmpty function", () => {
    it("should return true for empty folders", async () => {
      const tempDir = await fs.mkdtemp(path.join(__dirname, "test-empty-"));

      try {
        const isEmpty = await folderEmpty(tempDir);
        assert.strictEqual(isEmpty, true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should return false for non-empty folders", async () => {
      const tempDir = await fs.mkdtemp(path.join(__dirname, "test-nonempty-"));

      try {
        await fs.writeFile(path.join(tempDir, "test.txt"), "content");
        const isEmpty = await folderEmpty(tempDir);
        assert.strictEqual(isEmpty, false);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should return false for non-existent folders", async () => {
      const nonExistentDir = path.join(__dirname, "this-dir-does-not-exist");
      const isEmpty = await folderEmpty(nonExistentDir);
      assert.strictEqual(isEmpty, false);
    });
  });
});
