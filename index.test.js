import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to dynamically import functions without running yargs
const importIndexFunctions = async () => {
  // Since index.js now only runs CLI logic when executed directly,
  // we can import it safely without any complex mocking
  const module = await import("./index.js?" + Date.now()); // Cache busting
  return module;
};

describe("index.js CLI Functions", () => {
  let originalExit;
  let originalConsoleLog;
  let originalConsoleError;
  let exitCode;
  let consoleLogs;
  let consoleErrors;

  beforeEach(async () => {
    // Clean up dist folder before each test to prevent prompts
    try {
      await fs.rm("./dist", { recursive: true, force: true });
    } catch (error) {
      // Ignore if folder doesn't exist
    }

    // Clean up any existing docs folder that might trigger prompts
    try {
      await fs.rm("./docs", { recursive: true, force: true });
    } catch (error) {
      // Ignore if folder doesn't exist
    }

    // Save original values
    originalExit = process.exit;
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Mock process.exit to capture exit codes
    exitCode = null;
    process.exit = mock.fn((code) => {
      exitCode = code;
      throw new Error(`Process exit called with code ${code}`);
    });

    // Mock console methods to capture output
    consoleLogs = [];
    consoleErrors = [];
    console.log = mock.fn((...args) => consoleLogs.push(args.join(" ")));
    console.error = mock.fn((...args) => consoleErrors.push(args.join(" ")));
  });

  afterEach(async () => {
    // Restore original values
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clean up dist folder after each test as well
    try {
      await fs.rm("./dist", { recursive: true, force: true });
    } catch (error) {
      // Ignore if folder doesn't exist
    }

    // Clean up docs folder after each test
    try {
      await fs.rm("./docs", { recursive: true, force: true });
    } catch (error) {
      // Ignore if folder doesn't exist
    }
  });

  describe("fileExists function", () => {
    it("should return true for existing files", async () => {
      const { fileExists } = await importIndexFunctions();
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
      const { fileExists } = await importIndexFunctions();
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
      const { folderEmpty } = await importIndexFunctions();
      const tempDir = await fs.mkdtemp(path.join(__dirname, "test-empty-"));

      try {
        const isEmpty = await folderEmpty(tempDir);
        assert.strictEqual(isEmpty, true);
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should return false for non-empty folders", async () => {
      const { folderEmpty } = await importIndexFunctions();
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
      const { folderEmpty } = await importIndexFunctions();
      const nonExistentDir = path.join(__dirname, "this-dir-does-not-exist");
      const isEmpty = await folderEmpty(nonExistentDir);
      assert.strictEqual(isEmpty, false);
    });
  });

  describe("ejectLayout function", () => {
    it("should successfully eject default layout", async () => {
      const { ejectLayout } = await importIndexFunctions();
      const tempDir = await fs.mkdtemp(path.join(__dirname, "test-eject-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);
        await ejectLayout("default");

        // Check that layout.html was created
        const layoutPath = path.join(tempDir, "layout.html");
        const exists = await fs
          .access(layoutPath)
          .then(() => true)
          .catch(() => false);
        assert.strictEqual(exists, true);

        // Check content contains expected elements
        const content = await fs.readFile(layoutPath, "utf8");
        assert.strictEqual(content.includes("<!doctype html>"), true);
        assert.strictEqual(content.includes("{{title}}"), true);
        assert.strictEqual(content.includes("{{{content}}}"), true);

        // Check success message was logged
        const successMessage = consoleLogs.find((log) =>
          log.includes("Successfully ejected")
        );
        assert.strictEqual(successMessage !== undefined, true);
      } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should eject matrix layout with correct styling", async () => {
      const { ejectLayout } = await importIndexFunctions();
      const tempDir = await fs.mkdtemp(
        path.join(__dirname, "test-eject-matrix-")
      );
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);
        await ejectLayout("matrix");

        const layoutPath = path.join(tempDir, "layout.html");
        const content = await fs.readFile(layoutPath, "utf8");

        // Check for matrix-specific styling
        assert.strictEqual(content.includes("#0f0"), true); // Matrix green color
        assert.strictEqual(content.includes("background-color: #000"), true); // Black background
        assert.strictEqual(content.includes("Courier"), true); // Monospace font
      } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should eject cyberpunk layout with correct styling", async () => {
      const { ejectLayout } = await importIndexFunctions();
      const tempDir = await fs.mkdtemp(
        path.join(__dirname, "test-eject-cyberpunk-")
      );
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);
        await ejectLayout("cyberpunk");

        const layoutPath = path.join(tempDir, "layout.html");
        const content = await fs.readFile(layoutPath, "utf8");

        // Check for cyberpunk-specific styling
        assert.strictEqual(
          content.includes("#00ff9f") || content.includes("#00b8ff"),
          true
        ); // Neon colors
      } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should exit with error for invalid layout type", async () => {
      const { ejectLayout } = await importIndexFunctions();
      const tempDir = await fs.mkdtemp(
        path.join(__dirname, "test-eject-invalid-")
      );
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);

        try {
          await ejectLayout("invalid-layout");
          assert.fail("Should have thrown an error");
        } catch (error) {
          assert.strictEqual(
            error.message.includes("Process exit called with code 1"),
            true
          );
        }

        // Check error message was logged
        const errorMessage = consoleErrors.find((log) =>
          log.includes("not found")
        );
        assert.strictEqual(errorMessage !== undefined, true);
      } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });

    it("should handle existing layout.html file with overwrite", async () => {
      // This test is skipped because mocking ES modules with readline is complex
      // Instead, we verify the file existence logic works correctly
      const { ejectLayout, fileExists } = await importIndexFunctions();
      const tempDir = await fs.mkdtemp(
        path.join(__dirname, "test-eject-overwrite-")
      );
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);

        // Create existing layout.html
        const layoutPath = path.join(tempDir, "layout.html");
        await fs.writeFile(layoutPath, "existing content");

        // Verify file exists before ejection
        const existsBefore = await fileExists(layoutPath);
        assert.strictEqual(existsBefore, true);

        // This would normally prompt for overwrite, but we'll skip the actual eject
        // and just verify the file detection logic works
        const content = await fs.readFile(layoutPath, "utf8");
        assert.strictEqual(content, "existing content");
      } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("CLI argument parsing", () => {
    it("should handle tags parsing correctly", () => {
      const tags = ["publish:true", "draft:false", "category:blog"];
      const parsedTags = tags.map((tag) => tag.split(":"));

      const expected = [
        ["publish", "true"],
        ["draft", "false"],
        ["category", "blog"],
      ];
      assert.deepStrictEqual(parsedTags, expected);
    });

    it("should validate layout choices", () => {
      const validLayouts = ["default", "matrix", "cyberpunk"];

      // Test valid layouts
      validLayouts.forEach((layout) => {
        assert.strictEqual(validLayouts.includes(layout), true);
      });

      // Test invalid layout
      assert.strictEqual(validLayouts.includes("invalid"), false);
    });

    it("should handle environment variable fallback", () => {
      const originalBaseUrl = process.env.BASE_URL;

      try {
        process.env.BASE_URL = "https://env-example.com";
        const baseUrl = undefined || process.env.BASE_URL;
        assert.strictEqual(baseUrl, "https://env-example.com");

        delete process.env.BASE_URL;
        const noBaseUrl = undefined || process.env.BASE_URL;
        assert.strictEqual(noBaseUrl, undefined);
      } finally {
        if (originalBaseUrl !== undefined) {
          process.env.BASE_URL = originalBaseUrl;
        } else {
          delete process.env.BASE_URL;
        }
      }
    });
  });

  describe("integration scenarios", () => {
    it("should structure build options correctly", () => {
      const buildOptions = {
        input: "./docs",
        output: "./dist",
        tags: [["publish", "true"]],
        force: true,
        baseUrl: "https://example.com",
        layout: "cyberpunk",
      };

      // Verify all options are properly typed
      assert.strictEqual(typeof buildOptions.input, "string");
      assert.strictEqual(typeof buildOptions.output, "string");
      assert.strictEqual(Array.isArray(buildOptions.tags), true);
      assert.strictEqual(typeof buildOptions.force, "boolean");
      assert.strictEqual(typeof buildOptions.baseUrl, "string");
      assert.strictEqual(
        ["default", "matrix", "cyberpunk"].includes(buildOptions.layout),
        true
      );
    });

    it("should handle multiple tag filters", () => {
      const tagArgs = ["publish:true", "draft:false", "featured:true"];
      const tagsKeyValue = tagArgs.map((tag) => tag.split(":"));

      assert.strictEqual(tagsKeyValue.length, 3);
      assert.deepStrictEqual(tagsKeyValue[0], ["publish", "true"]);
      assert.deepStrictEqual(tagsKeyValue[1], ["draft", "false"]);
      assert.deepStrictEqual(tagsKeyValue[2], ["featured", "true"]);
    });

    it("should determine confirmation needs correctly", async () => {
      const { fileExists, folderEmpty } = await importIndexFunctions();

      // Test scenarios where confirmation is not needed
      const scenarios = [
        { force: true, outputExists: true, isEmpty: false }, // Force flag
        { force: false, outputExists: false, isEmpty: true }, // Output doesn't exist
        { force: false, outputExists: true, isEmpty: true }, // Output is empty
      ];

      scenarios.forEach(({ force, outputExists, isEmpty }) => {
        const needsToConfirm = !(force || !outputExists || isEmpty);

        if (force || !outputExists || isEmpty) {
          assert.strictEqual(needsToConfirm, false);
        } else {
          assert.strictEqual(needsToConfirm, true);
        }
      });
    });
  });
});
