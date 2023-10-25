import { processFolder } from "./main.js";
import fs from 'fs/promises';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';

describe("processFolder", () => {
  const outputFolder = './dist';
  beforeEach(async () => await fs.rm(outputFolder, { recursive: true, force: true }));

  it("picks markdown and convert", async () => { 
    const inputFolder = "./src/__test__";
    await processFolder(inputFolder, outputFolder);
    const fileList = [
      './dist/example.html',
      './dist/second-level/nested.html',
      './dist/second-level/nested-with-space.html',
    ];

    for (const file of fileList) {
      try {
        await fs.access(file);
        assert.ok(true);
      } catch (error) {
        throw new Error(`File ${file} does not exist`);
      }
    }
  });
});
