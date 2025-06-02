import readline from "readline";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { fileExists } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ejectLayout = async (layoutType) => {
  const layoutFileName = `${layoutType}_layout.html`;
  const sourcePath = path.join(__dirname, "static", layoutFileName);
  const targetPath = path.join(process.cwd(), "layout.html");

  try {
    // Check if source layout exists
    if (!(await fileExists(sourcePath))) {
      console.error(chalk.red(`Error: Layout "${layoutType}" not found.`));
      process.exit(1);
    }

    // Check if target layout.html already exists
    if (await fileExists(targetPath)) {
      console.log(
        chalk.yellow(
          `Warning: layout.html already exists in current directory.`
        )
      );
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        rl.question(chalk.red("Do you want to overwrite it? (y/n) "), resolve);
      });
      rl.close();

      if (answer !== "y") {
        console.log(chalk.red("Ejection cancelled."));
        process.exit(0);
      }
    }

    // Copy the layout file
    await fs.copyFile(sourcePath, targetPath);
    console.log(
      chalk.green(`Successfully ejected "${layoutType}" layout to layout.html`)
    );
    console.log(
      chalk.blue(`You can now customize the layout at: ${targetPath}`)
    );
  } catch (error) {
    console.error(chalk.red(`Error ejecting layout: ${error.message}`));
    process.exit(1);
  }
};
