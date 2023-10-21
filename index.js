#!/usr/bin/env node
import { processFolder } from './src/main.js';
import yargs from 'yargs';
import chalk from 'chalk';

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
  .argv;

console.log(chalk.blue('Matching .md files from directory: '), chalk.green(argv.inputFolder));
console.log(chalk.blue('Filtering matches files by tags: '), chalk.green(argv.tags));
console.log(chalk.blue('Output folder: '), chalk.green(argv.outputFolder));

const tagsKeyValue = argv.tags && argv.tags.map((tag) => tag.split(':'));

processFolder(argv.inputFolder, argv.outputFolder, { tags: tagsKeyValue });
