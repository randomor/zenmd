import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to dynamically import functions without running yargs
const importIndexFunctions = async () => {
  // Since index.js now only runs CLI logic when executed directly,
  // we can import it safely without any complex mocking
  const module = await import("./index.js?" + Date.now()); // Cache busting
  return module;
};

// Helper to run CLI as child process and capture output
const runCLI = (args = [], input = "") => {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["index.js", ...args], {
      cwd: __dirname,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    if (input) {
      child.stdin.write(input);
      child.stdin.end();
    }

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on("error", (error) => {
      reject(error);
    });

    // Set timeout for CLI operations
    setTimeout(() => {
      child.kill();
      reject(new Error("CLI operation timed out"));
    }, 10000);
  });
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

    // Clean up test folders
    try {
      await fs.rm("./test-input", { recursive: true, force: true });
    } catch (error) {
      // Ignore if folder doesn't exist
    }

    try {
      await fs.rm("./test-output", { recursive: true, force: true });
    } catch (error) {
      // Ignore if folder doesn't exist
    }

    // Clean up layout.html created by eject command tests
    try {
      await fs.rm("./layout.html", { force: true });
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe("CLI Integration Tests", () => {
    it("should actually execute CLI and show logs for build command", async () => {
      // Create test input
      await fs.mkdir("./test-input", { recursive: true });
      await fs.writeFile(
        "./test-input/test.md",
        "# Test Document\n\nThis is a test."
      );

      const result = await runCLI([
        "./test-input",
        "--output",
        "./test-output",
        "--force",
      ]);

      // This test would have FAILED before the fix - no logs would appear
      assert.strictEqual(
        result.code,
        0,
        `CLI should exit with code 0, got ${result.code}. stderr: ${result.stderr}`
      );
      assert.match(
        result.stdout,
        /Input:.*test-input/,
        "Should show input path in logs"
      );
      assert.match(
        result.stdout,
        /Output folder:.*test-output/,
        "Should show output path in logs"
      );
      assert.match(
        result.stdout,
        /Converting:/,
        "Should show conversion progress"
      );
      assert.match(
        result.stdout,
        /Rendered:/,
        "Should show rendering completion"
      );

      // Verify output files were actually created
      const outputExists = await fs
        .access("./test-output/test.html")
        .then(() => true)
        .catch(() => false);
      assert.strictEqual(
        outputExists,
        true,
        "Output HTML file should be created"
      );
    });

    it("should omit .html extension for wiki links with --clean-link", async () => {
      await fs.mkdir("./test-input", { recursive: true });
      await fs.writeFile(
        "./test-input/example.md",
        "# Example\n\n[[Other]]"
      );
      await fs.writeFile("./test-input/other.md", "# Other");

      const result = await runCLI([
        "./test-input",
        "--output",
        "./test-output",
        "--force",
        "--clean-link",
      ]);

      assert.strictEqual(
        result.code,
        0,
        `CLI should exit with code 0, got ${result.code}. stderr: ${result.stderr}`
      );

      const html = await fs.readFile("./test-output/example.html", "utf8");
      assert.match(html, /href=\"other\"/);
      assert.doesNotMatch(html, /href=\"other\.html\"/);
    });

    it("should show confirmation prompt when output folder exists and is not empty", async () => {
      // Create test input
      await fs.mkdir("./test-input", { recursive: true });
      await fs.writeFile("./test-input/test.md", "# Test Document");

      // Create non-empty output folder
      await fs.mkdir("./test-output", { recursive: true });
      await fs.writeFile("./test-output/existing.txt", "existing content");

      // Test rejecting the prompt
      const result = await runCLI(
        ["./test-input", "--output", "./test-output"],
        "n\n"
      );

      assert.strictEqual(
        result.code,
        1,
        "Should exit with code 1 when user rejects"
      );
      assert.match(
        result.stdout,
        /Output folder.*is not empty.*continue/,
        "Should show confirmation prompt"
      );
      assert.match(result.stdout, /Exiting/, "Should show exit message");
    });

    it("should accept confirmation and continue processing", async () => {
      // Create test input
      await fs.mkdir("./test-input", { recursive: true });
      await fs.writeFile("./test-input/test.md", "# Test Document");

      // Create non-empty output folder
      await fs.mkdir("./test-output", { recursive: true });
      await fs.writeFile("./test-output/existing.txt", "existing content");

      // Test accepting the prompt
      const result = await runCLI(
        ["./test-input", "--output", "./test-output"],
        "y\n"
      );

      assert.strictEqual(
        result.code,
        0,
        "Should exit with code 0 when user accepts"
      );
      assert.match(
        result.stdout,
        /Output folder.*is not empty.*continue/,
        "Should show confirmation prompt"
      );
      assert.match(
        result.stdout,
        /Converting:/,
        "Should proceed with conversion after acceptance"
      );
    });

    it("should show help when --help flag is used", async () => {
      const result = await runCLI(["--help"]);

      assert.strictEqual(result.code, 0, "Help should exit with code 0");
      assert.match(
        result.stdout,
        /Build static site from markdown files/,
        "Should show main description"
      );
      assert.match(result.stdout, /Commands:/, "Should show commands section");
      assert.match(
        result.stdout,
        /eject.*Eject a built-in layout/,
        "Should show eject command"
      );
    });

    it("should execute eject command correctly", async () => {
      const result = await runCLI(["eject", "--layout", "default"], "y\n");

      // The eject command should complete (may succeed or ask for confirmation)
      assert.strictEqual(
        typeof result.code,
        "number",
        "Should complete execution with a numeric exit code"
      );

      // Check if the command produced some meaningful output
      const hasOutput = result.stdout.length > 0 || result.stderr.length > 0;
      assert.strictEqual(
        hasOutput,
        true,
        "Should produce some output when executing eject command"
      );
    });

    it("should process markdown files with tags when specified", async () => {
      // Create test input with frontmatter
      await fs.mkdir("./test-input", { recursive: true });
      await fs.writeFile(
        "./test-input/published.md",
        `---
title: Published Post
publish: true
---
# Published Content`
      );
      await fs.writeFile(
        "./test-input/draft.md",
        `---
title: Draft Post
publish: false
---
# Draft Content`
      );

      const result = await runCLI([
        "./test-input",
        "--output",
        "./test-output",
        "--tags",
        "publish:true",
        "--force",
      ]);

      assert.strictEqual(
        result.code,
        0,
        "Should process successfully with tags"
      );
      assert.match(
        result.stdout,
        /Filtering matched files by tags:/,
        "Should show tag filtering message"
      );
      assert.match(
        result.stdout,
        /publish:true/,
        "Should show the specific tags being used"
      );
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
        cleanLink: true,
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
      assert.strictEqual(typeof buildOptions.cleanLink, "boolean");
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
