import fs from 'fs/promises';
import { findLayout } from "./utils.js";
import mustache from "mustache";
import chalk from "chalk";

export const renderHtmlPage = async (pageAttributes) => {
  const {
    title,
    content,
    inputFile,
    inputFolder,
    outputFileFolder,
    outputFilePath,
  } = pageAttributes;
  const templatePath = await findLayout(inputFile, inputFolder);
  const template = await fs.readFile(templatePath, "utf8");
  const rendered = mustache.render(template, { title, content });

  try {
    await fs.access(outputFileFolder);
  } catch (error) {
    await fs.mkdir(outputFileFolder, { recursive: true });
  }

  await fs.writeFile(outputFilePath, rendered);

  console.log(chalk.greenBright(`Rendered: ${outputFilePath}`));

  return rendered;
};
