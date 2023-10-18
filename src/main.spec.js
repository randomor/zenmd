import { markdownToHtml, fileToHtml } from "./main";
import fs from 'fs';
import path from 'path';

describe("markdownToHtml", () => {
  it("converts markdown to html", async () => { 
    const inputPattern = "./docs/**/*.md";
    const outputPath = "./dist/";
    const result = await markdownToHtml(inputPattern, outputPath);
    expect(result).toBe(true);
  })
});

describe.only("fileToHtml", () => {
  const sourceFile = './docs/home.md';
  it("convert file to html", async () => {
    await fileToHtml(sourceFile, './dist', {})
    const resultFilePath = path.join(process.cwd(), './dist', 'home.html');
    const resultFile = fs.existsSync(resultFilePath);
    expect(resultFile).toBe(true);
  })
})
