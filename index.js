#!/usr/bin/env node
import { processFolder } from "./src/main.js";
import readline from "readline";
import yargs from "yargs";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { hideBin } from "yargs/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileExists = async (path) => {
  return await fs
    .access(path)
    .then(() => true)
    .catch(() => false);
};

const folderEmpty = async (p) => {
  try {
    const outputFiles = await fs.readdir(p);
    return outputFiles.length === 0;
  } catch {
    return false;
  }
};

const ejectLayout = async (layoutType) => {
  const layoutFileName = `${layoutType}_layout.html`;
  const sourcePath = path.join(__dirname, "src", "static", layoutFileName);
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

const runBuildCommand = async (argv) => {
  console.log(chalk.blue("Input: "), chalk.green(argv.input));
  if (argv.tags) {
    console.log(
      chalk.blue("Filtering match files by tags: "),
      chalk.green(argv.tags)
    );
  }
  console.log(chalk.blue("Output folder: "), chalk.green(argv.output));

  const startProcessing = async () => {
    // create output folder if doesn't exist, other wise erase output folder
    const isFileExists = await fileExists(argv.output);
    if (!isFileExists) {
      await fs.mkdir(argv.output, { recursive: true });
    } else {
      await fs.rm(argv.output, { recursive: true });
    }

    const tagsKeyValue = argv.tags && argv.tags.map((tag) => tag.split(":"));
    await processFolder(argv.input, argv.output, {
      tags: tagsKeyValue,
      // Default to option but take env variable if not provided, for sitemap generation
      baseUrl: argv.baseUrl || process.env.BASE_URL,
      layout: argv.layout,
    });
  };

  const outputFolderExists = await fileExists(argv.output);

  const needsToConfirm = !(
    argv.force ||
    !outputFolderExists ||
    (await folderEmpty(argv.output))
  );

  if (needsToConfirm) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      chalk.red(
        `Output folder ${argv.output} is not empty, do you want to continue? (y/n) `
      ),
      async (answer) => {
        if (answer !== "y") {
          console.log(chalk.red("Exiting..."));
          process.exit(1);
        }
        rl.close();
        await startProcessing();
      }
    );
  } else {
    await startProcessing();
  }
};

// Only run CLI logic if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = yargs(hideBin(process.argv))
    .command(
      "$0 [input]",
      "Build static site from markdown files",
      (yargs) => {
        yargs.positional("input", {
          describe: "Input folder path or file path",
          default: "./docs",
        });
      },
      (argv) => {
        // This handler will run for the default command
        runBuildCommand(argv);
      }
    )
    .command(
      "eject",
      "Eject a built-in layout to customize",
      (yargs) => {
        yargs.option("layout", {
          type: "string",
          describe: "Layout to eject (default, matrix or cyberpunk)",
          choices: ["default", "matrix", "cyberpunk"],
          default: "default",
          demandOption: true,
        });
      },
      async (argv) => {
        await ejectLayout(argv.layout);
      }
    )
    .option("output", {
      alias: "o",
      type: "string",
      describe: "Output folder path",
      default: "./dist",
    })
    .option("tags", {
      alias: "t",
      type: "array",
      describe:
        "Filter docs with matching tags `--tags=publish:true` which will only build files with `publish` flag or `--tags=draft:false` which will not build files with `draft` flag",
    })
    .option("force", {
      alias: "f",
      type: "boolean",
      describe: "Force reset of output folder",
    })
    .option("baseUrl", {
      alias: "base",
      type: "string",
      describe: "Base URL for sitemap",
    })
    .option("layout", {
      alias: "l",
      type: "string",
      describe:
        "Layout style when no custom layout is provided (default, matrix or cyberpunk)",
      choices: ["default", "matrix", "cyberpunk"],
      default: "default",
    })
    .help()
    .alias("help", "h").argv;
}

// Export functions for testing
export { ejectLayout, fileExists, folderEmpty, runBuildCommand };
