import { processFolder } from "./main.js";
import fs from 'fs/promises';
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

describe.only("processFolder", () => {
  const inputFolder = "./src/__test__";
  const outputFolder = './dist';
  beforeEach(async () => await fs.rm(outputFolder, { recursive: true, force: true }));

  it("picks markdown and convert", async () => { 

    const render = mock.fn((_) => true );

    await processFolder(inputFolder, outputFolder, { render });
    const fileList = [
      'src/__test__/example.md',
      'src/__test__/second level/nested.md',
      'src/__test__/second level/nested with space.md',
    ];

    assert.strictEqual(render.mock.calls.length, 3);
    fileList.forEach((file, index) => {
      assert.strictEqual(render.mock.calls[index].arguments[0], file);
    })
  });

  it.only("support individual file", async () => {
    const inputArg = "README.md";
    const render = mock.fn((_) => true );
    await processFolder(inputArg, outputFolder, { render});
    
    assert.strictEqual(render.mock.calls.length, 1);
    assert.strictEqual(render.mock.calls[0].arguments[0], inputArg);
  });
});
