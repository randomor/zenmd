#!/usr/bin/env node
import { markdownToHtml } from './src/main.js';
import yargs from 'yargs';
import chalk from 'chalk';

import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .command('$0 [directoryPath]', 'default command', (yargs) => {
    yargs.positional('directoryPath', {
      describe: 'Path to the directory',
      default: './docs',
    })
  })
  .option('outputFile', {
    alias: 'o',
    type: 'string',
    describe: 'Output file name',
    default: './dist',
  })
  .option('tags', {
    alias: 't',
    type: 'string',
    describe: 'Tags for the operation',
  })
  .argv;

console.log(chalk.blue('Matching .md files from directory: '), chalk.green(argv.directoryPath));
console.log(chalk.blue('Filtering matches files by tags: '), chalk.green(argv.tags));

markdownToHtml(argv.directoryPath, argv.output, argv.tags);
