import { processFolder } from '../main.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, it, beforeEach, afterEach } from 'node:test'; // Import testing functions
import assert from 'node:assert'; // Import assert for assertions

describe('Layout Option', () => {
  let tempTestDir;
  let outputDir;
  let sampleMdFilePath;
  let sampleMdFileFolderPath;

  beforeEach(async () => {
    // Create a temporary directory for test fixtures and output
    tempTestDir = await fs.mkdtemp(path.join(os.tmpdir(), 'layout-test-'));
    outputDir = path.join(tempTestDir, 'dist');
    // The input to processFolder for a single file should be the folder containing the file
    sampleMdFileFolderPath = path.join(tempTestDir, 'src'); 
    await fs.mkdir(sampleMdFileFolderPath, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });

    sampleMdFilePath = path.join(sampleMdFileFolderPath, 'test-page.md');
    await fs.writeFile(sampleMdFilePath, `# Test Page Content
This is a test.`);
  });

  afterEach(async () => {
    // Clean up the temporary directory
    await fs.rm(tempTestDir, { recursive: true, force: true });
  });

  it('should use matrix layout when specified', async () => { // Changed test to it
    // Pass the folder of the markdown file as the first argument
    await processFolder(sampleMdFileFolderPath, outputDir, { layout: 'matrix' });
    const expectedOutputFile = path.join(outputDir, 'test-page.html');
    const content = await fs.readFile(expectedOutputFile, 'utf-8');
    assert.match(content, /<main class="matrix-container">/);
    assert.match(content, /Powered by ZenMD - Matrix Layout/);
    assert.doesNotMatch(content, /<main class="article">/);
  });

  it('should use default layout when no layout is specified', async () => { // Changed test to it
    // Pass the folder of the markdown file as the first argument
    await processFolder(sampleMdFileFolderPath, outputDir, {}); // No layout option
    const expectedOutputFile = path.join(outputDir, 'test-page.html');
    const content = await fs.readFile(expectedOutputFile, 'utf-8');
    assert.match(content, /<main class="article">/);
    assert.doesNotMatch(content, /matrix-container/);
  });

  it('should use default layout when an invalid layout is specified', async () => { // Changed test to it
    // Pass the folder of the markdown file as the first argument
    await processFolder(sampleMdFileFolderPath, outputDir, { layout: 'invalid-layout' });
    const expectedOutputFile = path.join(outputDir, 'test-page.html');
    const content = await fs.readFile(expectedOutputFile, 'utf-8');
    assert.match(content, /<main class="article">/);
    assert.doesNotMatch(content, /matrix-container/);
  });
});
