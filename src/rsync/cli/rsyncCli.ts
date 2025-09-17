#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { RsyncCompatibilityChecker } from '../lib/rsyncChecker.ts';
import RsyncManager from '../lib/rsync.ts';
import { existsSync } from 'fs';

const program = new Command();

program
    .name('rsync-checker')
    .description('Check Rsync compatibility and get installation instructions')
    .version('1.0.0');

// Check command
program
    .command('check')
    .description('Check if rsync is available on the current system')
    .option('-j, --json', 'Output result in JSON format')
    .option('-v, --verbose', 'Show detailed information')
    .action(async (options) => {
        try {
            const result = await RsyncCompatibilityChecker.checkCompatibility();
            
            if (options.json) {
                console.log(JSON.stringify(result, null, 2));
                return;
            }

            console.log(chalk.blue.bold('\n=== Rsync Compatibility Check ==='));
            console.log(`Platform: ${chalk.cyan(result.platformName)} (${result.platform})`);
            
            if (result.isAvailable) {
                console.log(chalk.green('Rsync is available!'));
                console.log(`Version: ${chalk.yellow(result.version)}`);
                console.log(chalk.green('Status: Ready to use for file transfers!'));
            } else {
                console.log(chalk.red('Rsync is not available'));
                console.log(chalk.red(`Error: ${result.errorMessage}`));
                
                if (options.verbose && result.installInstructions) {
                    console.log(chalk.blue('\nInstallation options:'));
                    console.log(result.installInstructions);
                }
            }
        } catch (error) {
            console.error(chalk.red('Error checking rsync compatibility:'), error);
            process.exit(1);
        }
    });

// Install command
program
    .command('install')
    .description('Show installation instructions for the current platform')
    .option('-p, --platform <platform>', 'Show instructions for specific platform (win32, darwin, linux)')
    .option('-a, --auto', 'Attempt automatic installation')
    .option('-i, --interactive', 'Interactive installation guide')
    .action(async (options) => {
        try {
            if (options.auto) {
                console.log(chalk.blue('Attempting automatic installation...'));
                const result = await RsyncCompatibilityChecker.attemptAutoInstall();
                
                if (result.success) {
                    console.log(chalk.green(result.message));
                } else {
                    console.log(chalk.red(result.message));
                    
                    // Show manual instructions
                    const instructions = RsyncCompatibilityChecker.getInstallInstructions(options.platform);
                    console.log(chalk.blue('\nAll installation options:'));
                    instructions.forEach((method, index) => {
                        const autoText = method.isExecutable ? chalk.green(' (auto)') : chalk.gray(' (manual)');
                        console.log(chalk.yellow(`${index + 1}. ${method.method}${autoText}`));
                        console.log(`   ${method.command}`);
                        console.log(`   ${method.description}`);
                        console.log(`   Admin required: ${method.requiresAdmin ? 'Yes' : 'No'}\n`);
                    });
                }
                return;
            }

            if (options.interactive) {
                await interactiveInstallGuide(options.platform);
                return;
            }

            // Show installation instructions
            const instructions = RsyncCompatibilityChecker.getInstallInstructions(options.platform);
            
            console.log(chalk.blue.bold('\n=== Rsync Installation Instructions ==='));
            
            instructions.forEach((method, index) => {
                const autoText = method.isExecutable ? chalk.green(' (auto)') : chalk.gray(' (manual)');
                console.log(chalk.yellow(`\n${index + 1}. ${method.method}${autoText}`));
                console.log(chalk.white(`   Command: ${chalk.green(method.command)}`));
                console.log(`   Description: ${method.description}`);
                console.log(`   Requires Admin: ${method.requiresAdmin ? chalk.red('Yes') : chalk.green('No')}`);
            });
            
        } catch (error) {
            console.error(chalk.red('Error getting installation instructions:'), error);
            process.exit(1);
        }
    });

// Report command
program
    .command('report')
    .description('Generate a comprehensive compatibility and installation report')
    .action(async () => {
        try {
            const report = await RsyncCompatibilityChecker.getCompatibilityReport();
            console.log(report);
        } catch (error) {
            console.error(chalk.red('Error generating report:'), error);
            process.exit(1);
        }
    });

// Transfer command
program
    .command('transfer')
    .description('Transfer files or folders to a destination')
    .argument('<source>', 'Source file or folder path')
    .argument('<destination>', 'Destination path (can be remote with user@host:path format)')
    .option('-s, --ssh-key <path>', 'SSH private key file path')
    .option('-p, --port <number>', 'SSH port number')
    .option('--ssh-options <options>', 'Additional SSH options')
    .option('-r, --recursive', 'Transfer directories recursively')
    .option('-v, --verbose', 'Verbose output')
    .option('--delete', 'Delete files in destination that don\'t exist in source')
    .action(async (source, destination, options) => {
        try {
            // Check if source exists
            if (!existsSync(source)) {
                console.error(chalk.red('Error: Source path does not exist:'), source);
                process.exit(1);
            }

            // Check compatibility first
            const isCompatible = await RsyncCompatibilityChecker.checkCompatibility();
            if (!isCompatible.isAvailable) {
                console.error(chalk.red('Error: rsync is not available on this system.'));
                console.log(chalk.yellow('Run "npx fast-transfer install" to install rsync.'));
                process.exit(1);
            }

            const rsyncManager = new RsyncManager();
            
            // Initialize the RsyncManager
            console.log(chalk.blue('Initializing rsync manager...'));
            const initialized = await rsyncManager.initialize();
            if (!initialized) {
                console.error(chalk.red('Error: Failed to initialize rsync manager.'));
                process.exit(1);
            }
            
            const rsyncOptions = {
                verbose: options.verbose || false,
                recursive: options.recursive || false,
                delete: options.delete || false,
                sshOptions: options.sshOptions,
                sshKey: options.sshKey,
                port: options.port ? parseInt(options.port) : undefined
            };

            console.log(chalk.blue(`Transferring ${source} to ${destination}...`));
            
            const result = await rsyncManager.transfer(source, destination, rsyncOptions);
            
            if (result.success) {
                console.log(chalk.green('Transfer completed successfully!'));
                if (options.verbose) {
                    console.log('Output:', result.output);
                }
            } else {
                console.error(chalk.red('Transfer failed:'), result.error);
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('Error during transfer:'), error);
            process.exit(1);
        }
    });

// Copy command (recursive copy with progress)
program
    .command('copy')
    .description('Copy files or folders with progress display')
    .argument('<source>', 'Source file or folder path')
    .argument('<destination>', 'Destination path')
    .option('-v, --verbose', 'Verbose output')
    .option('--exclude <pattern>', 'Exclude files matching pattern')
    .action(async (source, destination, options) => {
        try {
            if (!existsSync(source)) {
                console.error(chalk.red('Error: Source path does not exist:'), source);
                process.exit(1);
            }

            const isCompatible = await RsyncCompatibilityChecker.checkCompatibility();
            if (!isCompatible.isAvailable) {
                console.error(chalk.red('Error: rsync is not available on this system.'));
                console.log(chalk.yellow('Run "npx fast-transfer install" to install rsync.'));
                process.exit(1);
            }

            const rsyncManager = new RsyncManager();
            
            // Initialize the RsyncManager
            console.log(chalk.blue('Initializing rsync manager...'));
            const initialized = await rsyncManager.initialize();
            if (!initialized) {
                console.error(chalk.red('Error: Failed to initialize rsync manager.'));
                process.exit(1);
            }
            
            const rsyncOptions = {
                verbose: options.verbose || false,
                recursive: true,
                exclude: options.exclude ? [options.exclude] : undefined
            };

            console.log(chalk.blue(`Copying ${source} to ${destination}...`));
            
            const result = await rsyncManager.copyFolder(source, destination, rsyncOptions);
            
            if (result.success) {
                console.log(chalk.green('Copy completed successfully!'));
                if (options.verbose) {
                    console.log('Output:', result.output);
                }
            } else {
                console.error(chalk.red('Copy failed:'), result.error);
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('Error during copy:'), error);
            process.exit(1);
        }
    });

// Mirror command (exact copy with deletion)
program
    .command('mirror')
    .description('Mirror source to destination (deletes extra files in destination)')
    .argument('<source>', 'Source folder path')
    .argument('<destination>', 'Destination folder path')
    .option('-v, --verbose', 'Verbose output')
    .option('--dry-run', 'Show what would be done without actually doing it')
    .action(async (source, destination, options) => {
        try {
            if (!existsSync(source)) {
                console.error(chalk.red('Error: Source path does not exist:'), source);
                process.exit(1);
            }

            const isCompatible = await RsyncCompatibilityChecker.checkCompatibility();
            if (!isCompatible.isAvailable) {
                console.error(chalk.red('Error: rsync is not available on this system.'));
                console.log(chalk.yellow('Run "npx fast-transfer install" to install rsync.'));
                process.exit(1);
            }

            const rsyncManager = new RsyncManager();
            
            // Initialize the RsyncManager
            console.log(chalk.blue('Initializing rsync manager...'));
            const initialized = await rsyncManager.initialize();
            if (!initialized) {
                console.error(chalk.red('Error: Failed to initialize rsync manager.'));
                process.exit(1);
            }
            
            const rsyncOptions = {
                verbose: options.verbose || false,
                dryRun: options.dryRun || false
            };

            console.log(chalk.blue(`Mirroring ${source} to ${destination}...`));
            if (options.dryRun) {
                console.log(chalk.yellow('DRY RUN - No files will be modified'));
            }
            
            const result = await rsyncManager.mirrorDirectory(source, destination, rsyncOptions);
            
            if (result.success) {
                console.log(chalk.green('Mirror completed successfully!'));
                if (options.verbose) {
                    console.log('Output:', result.output);
                }
            } else {
                console.error(chalk.red('Mirror failed:'), result.error);
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('Error during mirror:'), error);
            process.exit(1);
        }
    });

// Backup command
program
    .command('backup')
    .description('Create incremental backup with hard links')
    .argument('<source>', 'Source folder path')
    .argument('<backup-dir>', 'Backup directory path')
    .option('-v, --verbose', 'Verbose output')
    .option('--exclude <pattern>', 'Exclude files matching pattern')
    .action(async (source, backupDir, options) => {
        try {
            if (!existsSync(source)) {
                console.error(chalk.red('Error: Source path does not exist:'), source);
                process.exit(1);
            }

            const isCompatible = await RsyncCompatibilityChecker.checkCompatibility();
            if (!isCompatible.isAvailable) {
                console.error(chalk.red('Error: rsync is not available on this system.'));
                console.log(chalk.yellow('Run "npx fast-transfer install" to install rsync.'));
                process.exit(1);
            }

            const rsyncManager = new RsyncManager();
            
            // Initialize the RsyncManager
            console.log(chalk.blue('Initializing rsync manager...'));
            const initialized = await rsyncManager.initialize();
            if (!initialized) {
                console.error(chalk.red('Error: Failed to initialize rsync manager.'));
                process.exit(1);
            }
            
            const rsyncOptions = {
                verbose: options.verbose || false,
                exclude: options.exclude ? [options.exclude] : undefined
            };

            console.log(chalk.blue(`Creating backup of ${source} in ${backupDir}...`));
            
            const result = await rsyncManager.backup(source, backupDir, rsyncOptions);
            
            if (result.success) {
                console.log(chalk.green('Backup completed successfully!'));
                if (options.verbose) {
                    console.log('Output:', result.output);
                }
            } else {
                console.error(chalk.red('Backup failed:'), result.error);
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red('Error during backup:'), error);
            process.exit(1);
        }
    });

// Interactive installation guide
async function interactiveInstallGuide(platform?: string) {
    const instructions = RsyncCompatibilityChecker.getInstallInstructions(platform);
    
    console.log(chalk.blue.bold('\n=== Interactive Installation Guide ==='));
    
    const { selectedMethod } = await inquirer.prompt([
        {
            type: 'list',
            name: 'selectedMethod',
            message: 'Choose an installation method:',
            choices: instructions.map((method, index) => ({
                name: `${method.method} ${method.isExecutable ? '(auto)' : '(manual)'} - ${method.description}`,
                value: index
            }))
        }
    ]);
    
    const method = instructions[selectedMethod];
    
    console.log(chalk.yellow(`\nSelected: ${method.method}`));
    console.log(chalk.white(`Command: ${chalk.green(method.command)}`));
    console.log(`Admin required: ${method.requiresAdmin ? chalk.red('Yes') : chalk.green('No')}`);
    
    const { shouldProceed } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'shouldProceed',
            message: 'Do you want to copy this command to clipboard or run it?',
            default: true
        }
    ]);
    
    if (shouldProceed) {
        const choices = [
            { name: 'Copy command to clipboard', value: 'copy' },
            { name: 'Show command again', value: 'show' }
        ];
        
        // Only offer automatic installation if method is executable
        if (method.isExecutable) {
            choices.push({ name: 'Attempt automatic installation', value: 'auto' });
        }
        
        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to do?',
                choices: choices
            }
        ]);
        
        switch (action) {
            case 'copy':
                // Note: clipboard functionality would require additional package
                console.log(chalk.green('\nCommand to copy:'));
                console.log(chalk.white(method.command));
                break;
            case 'show':
                console.log(chalk.green('\nCommand:'));
                console.log(chalk.white(method.command));
                break;
            case 'auto':
                console.log(chalk.blue('Attempting automatic installation...'));
                const result = await RsyncCompatibilityChecker.attemptAutoInstall();
                console.log(result.success ? chalk.green(result.message) : chalk.red(result.message));
                break;
        }
    }
}

// Default action - show help
program
    .action(() => {
        program.help();
    });

// Parse command line arguments
program.parse();

export default program;