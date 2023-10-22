#!/usr/bin/env node
import { processFolder } from './src/main.js';
import readline from 'readline';
import yargs from 'yargs';
import chalk from 'chalk';
import fs from 'fs/promises';

import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .command('$0 [inputFolder]', 'default command', (yargs) => {
    yargs.positional('inputFolder', {
      describe: 'Input folder path',
      default: './docs',
    })
  })
  .option('outputFolder', {
    alias: 'o',
    type: 'string',
    describe: 'Output folder path',
    default: './dist',
  })
  .option('tags', {
    alias: 't',
    type: 'array',
    describe: 'Tags for the operation',
  })
  .option('force', {
    alias: 'f',
    type: 'boolean',
    describe: 'Force reset of output folder',
  })
  .argv;

console.log(chalk.blue('Matching .md files from directory: '), chalk.green(argv.inputFolder));
console.log(chalk.blue('Filtering matches files by tags: '), chalk.green(argv.tags));
console.log(chalk.blue('Output folder: '), chalk.green(argv.outputFolder));

const startProcessing = async () => {
  // erase output folder
  await fs.rm(argv.outputFolder, { recursive: true });
  
  const tagsKeyValue = argv.tags && argv.tags.map((tag) => tag.split(':'));
  await processFolder(argv.inputFolder, argv.outputFolder, { tags: tagsKeyValue });
}

if (argv.force) {
  await startProcessing();
} else {
  // Check if output folder is empty, if not, ask for confirmation before erasing it
  const outputFolderFiles = await fs.readdir(argv.outputFolder);
  if (outputFolderFiles.length > 0) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      chalk.red(
        `Output folder ${argv.outputFolder} is not empty, do you want to continue? (y/n) `
      ),
      async (answer) => {
        if (answer !== 'y') {
          console.log(chalk.red('Exiting...'));
          process.exit(1);
        }
        rl.close();
        await startProcessing();
      }
    );
  }
};