#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { createProject } from './generator.js';

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a new commander program
const program = new Command();

// Define the program metadata
program
    .name('create-advanced-mcp-server')
    .description('Create a new MCP server project with the advanced architecture')
    .version('1.0.0')
    .argument('[project-directory]', 'Directory to create the project in')
    .option('-y, --yes', 'Skip all prompts and use default options')
    .option('--skip-install', 'Skip dependency installation (use this if npm install fails)')
    .option('-v, --verbose', 'Display verbose output');

// Parse command line arguments
program.parse(process.argv);

// Get the project directory from the command line arguments
const projectDirArg = program.args[0];
const options = program.opts();

// Main function to run the program
async function run() {
    try {
        console.log(chalk.blue.bold('\n📦 Model Context Protocol Server Generator 📦\n'));

        // Get the project directory
        let projectDir = projectDirArg;
        if (!projectDir && !options.yes) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectDir',
                    message: 'What is the name of your project?',
                    default: 'my-advanced-mcp-server',
                    validate: (input) => {
                        if (input.trim().length === 0) {
                            return 'Project name cannot be empty';
                        }
                        return true;
                    }
                }
            ]);
            projectDir = answers.projectDir;
        } else if (!projectDir && options.yes) {
            projectDir = 'my-advanced-mcp-server';
        }

        // Resolve the full path
        const fullProjectDir = path.resolve(process.cwd(), projectDir);

        // Check if the directory exists
        if (fs.existsSync(fullProjectDir) && fs.readdirSync(fullProjectDir).length > 0) {
            const answers = options.yes ? { overwrite: true } : await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'overwrite',
                    message: `Directory ${projectDir} already exists and is not empty. Do you want to overwrite it?`,
                    default: false
                }
            ]);

            if (!answers.overwrite) {
                console.log(chalk.yellow('Operation cancelled.'));
                return;
            }

            // Clear the directory
            await fs.emptyDir(fullProjectDir);
        }

        // Get project configuration
        const config = options.yes ?
            {
                projectName: path.basename(projectDir),
                description: 'An MCP server with the advanced architecture',
                includeWeb: true,
                includeWebSocket: true,
                includePrisma: true,
                databaseType: 'sqlite'
            } :
            await inquirer.prompt([
                {
                    type: 'input',
                    name: 'projectName',
                    message: 'Project name:',
                    default: path.basename(projectDir)
                },
                {
                    type: 'input',
                    name: 'description',
                    message: 'Project description:',
                    default: 'An MCP server with the advanced architecture'
                },
                {
                    type: 'confirm',
                    name: 'includeWeb',
                    message: 'Include Web API (Express)?',
                    default: true
                },
                {
                    type: 'confirm',
                    name: 'includeWebSocket',
                    message: 'Include WebSocket server?',
                    default: true
                },
                {
                    type: 'confirm',
                    name: 'includePrisma',
                    message: 'Include Prisma ORM?',
                    default: true
                },
                {
                    type: 'list',
                    name: 'databaseType',
                    message: 'Select database type:',
                    choices: [
                        { name: 'SQLite', value: 'sqlite' },
                        { name: 'PostgreSQL', value: 'postgresql' },
                        { name: 'MySQL', value: 'mysql' }
                    ],
                    default: 'sqlite',
                    when: answers => answers.includePrisma
                }
            ]);

        // Create the project
        await createProject(fullProjectDir, config, {
            yes: options.yes,
            skipInstall: options.skipInstall,
            verbose: options.verbose
        });

        console.log(chalk.green.bold('\n✅ Project created successfully! ✅\n'));
        console.log(`  ${chalk.cyan('Next steps:')}`);
        console.log(`  ${chalk.white('1.')} ${chalk.yellow(`cd ${projectDir}`)}`);

        if (options.skipInstall) {
            console.log(`  ${chalk.white('2.')} ${chalk.yellow('npm install')}`);
            console.log(`  ${chalk.white('3.')} ${chalk.yellow('npm run dev')}`);
            console.log(`\n  ${chalk.cyan('Note:')} Dependencies were not installed automatically. You need to run npm install manually.`);
        } else {
            console.log(`  ${chalk.white('2.')} ${chalk.yellow('npm run dev')}`);
        }

        console.log(`\n  ${chalk.cyan('To learn more about the generated project structure, check the README.md file.')}`);

        if (!options.skipInstall) {
            console.log(`\n  ${chalk.cyan('If you encounter installation issues, try running with --skip-install next time:')}`);
            console.log(`  ${chalk.yellow('create-advanced-mcp-server')} ${projectDir} ${chalk.yellow('--skip-install')}`);
        }

        console.log();

    } catch (error) {
        console.error(chalk.red.bold('Error creating project:'));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
    }
}

// Run the program
run();
