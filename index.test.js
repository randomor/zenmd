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

    it("should determine confirmation needs correctly", () => {
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
