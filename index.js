#!/usr/bin/env node
import { processFolder } from './src/main.js';
import readline from 'readline';
import yargs from 'yargs';
import chalk from 'chalk';
import fs from 'fs/promises';

import { hideBin } from 'yargs/helpers';

const fileExists = async (path) => {
  return await fs.access(path).then(() => true).catch(() => false);
};

const folderEmpty = async (p) => {
  try {
    const outputFiles = await fs.readdir(p);  
    return outputFiles.length === 0;
  } catch {
    return false
  }
};

const argv = yargs(hideBin(process.argv))
  .command('$0 [inputFolder]', 'default command', (yargs) => {
    yargs.positional('inputFolder', {
      describe: 'Input folder path',
      default: './docs',
    })
  })
  .option('output', {
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

console.log(chalk.blue('Input folder: '), chalk.green(argv.inputFolder));
if (argv.tags) {
  console.log(chalk.blue('Filtering matches files by tags: '), chalk.green(argv.tags));
}
console.log(chalk.blue('Output folder: '), chalk.green(argv.output));

const startProcessing = async () => {
  // create output folder if doesn't exist, other wise erase output folder
  const isFileExists = await fileExists(argv.output);
  if (!isFileExists) {
    await fs.mkdir(argv.output, { recursive: true });
  } else {
    await fs.rm(argv.output, { recursive: true });
  }

  const tagsKeyValue = argv.tags && argv.tags.map((tag) => tag.split(':'));
  await processFolder(argv.inputFolder, argv.output, { tags: tagsKeyValue });
}

const outputFolderExists = await fileExists(argv.output);

const needsToConfirm = !(argv.force || !outputFolderExists || await folderEmpty(argv.output));

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
      if (answer !== 'y') {
        console.log(chalk.red('Exiting...'));
        process.exit(1);
      }
      rl.close();
      await startProcessing();
    }
  );
} else {
  await startProcessing();
};