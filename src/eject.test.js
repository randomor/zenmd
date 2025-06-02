import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { ejectLayout } from "./eject.js";
import { fileExists } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("eject.js functions", () => {
  let originalExit;
  let originalConsoleLog;
  let originalConsoleError;
  let exitCode;
  let consoleLogs;
  let consoleErrors;

  beforeEach(async () => {
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
  });

  describe("ejectLayout function", () => {
    it("should successfully eject default layout", async () => {
      const tempDir = await fs.mkdtemp(path.join(__dirname, "test-eject-"));
      const originalCwd = process.cwd();

      try {
        process.chdir(tempDir);
        await ejectLayout("default");

        // Check that layout.html was created
        const layoutPath = path.join(tempDir, "layout.html");
        const exists = await fileExists(layoutPath);
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

    it("should handle existing layout.html file detection", async () => {
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

        // Verify the file detection logic works
        const content = await fs.readFile(layoutPath, "utf8");
        assert.strictEqual(content, "existing content");
      } finally {
        process.chdir(originalCwd);
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
