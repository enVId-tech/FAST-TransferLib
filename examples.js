#!/usr/bin/env node

/**
 * Example usage of the FAST-TransferLib Rsync compatibility checker and manager
 * This file demonstrates both library usage and CLI capabilities
 */

import { RsyncCompatibilityChecker } from './src/sys/rsyncChecker.ts';
import RsyncManager from './src/sys/rsync.ts';
import chalk from 'chalk';

async function libraryExamples() {
    console.log(chalk.blue.bold('\n=== Library Usage Examples ===\n'));

    // Example 1: Basic compatibility check
    console.log(chalk.yellow('1. Basic Compatibility Check'));
    try {
        const result = await RsyncCompatibilityChecker.checkCompatibility();
        console.log('Result:', result);
        
        if (result.isAvailable) {
            console.log(chalk.green(`Rsync ${result.version} is available on ${result.platformName}`));
        } else {
            console.log(chalk.red(`Rsync not available: ${result.errorMessage}`));
        }
    } catch (error) {
        console.error('Error:', error);
    }

    // Example 2: Get installation instructions
    console.log(chalk.yellow('\n2. Installation Instructions'));
    const instructions = RsyncCompatibilityChecker.getInstallInstructions();
    console.log('Available installation methods:');
    instructions.forEach((method, index) => {
        console.log(`  ${index + 1}. ${method.method}: ${method.command}`);
    });

    // Example 3: Generate full compatibility report
    console.log(chalk.yellow('\n3. Compatibility Report'));
    try {
        const report = await RsyncCompatibilityChecker.getCompatibilityReport();
        console.log(report);
    } catch (error) {
        console.error('Error generating report:', error);
    }

    // Example 4: Using RsyncManager
    console.log(chalk.yellow('\n4. RsyncManager Usage'));
    const rsyncManager = new RsyncManager();
    
    // Set up event listeners
    rsyncManager.on('ready', (result) => {
        console.log(chalk.green('RsyncManager ready!'), result);
    });
    
    rsyncManager.on('progress', (data) => {
        process.stdout.write('.');
    });
    
    rsyncManager.on('complete', (result) => {
        console.log(chalk.green('\nTransfer completed!'), result);
    });
    
    rsyncManager.on('error', (error) => {
        console.log(chalk.red('Error:'), error.message);
    });

    // Initialize the manager
    const isReady = await rsyncManager.initialize();
    
    if (isReady) {
        console.log(chalk.green('RsyncManager is ready for transfers!'));
        
        // Example dry run (safe to execute)
        console.log(chalk.yellow('\n5. Dry Run Example'));
        try {
            // Create a simple test scenario (dry run won't actually transfer)
            const dryRunResult = await rsyncManager.dryRun(
                './src/', 
                './test-backup/',
                {
                    verbose: true,
                    progress: true,
                    exclude: ['*.log', 'node_modules/']
                }
            );
            
            console.log('Dry run result:', {
                success: dryRunResult.success,
                exitCode: dryRunResult.exitCode,
                outputLines: dryRunResult.output.split('\n').length
            });
            
        } catch (error) {
            console.log(chalk.red('Dry run failed:'), error);
        }
    } else {
        console.log(chalk.red('RsyncManager not ready. Installation may be required.'));
        
        // Show installation instructions
        const installInstructions = rsyncManager.getInstallationInstructions();
        console.log(chalk.blue('\nInstallation options:'));
        installInstructions.forEach((method, index) => {
            console.log(`${index + 1}. ${method.method}: ${method.command}`);
        });
    }
}

async function cliExamples() {
    console.log(chalk.blue.bold('\n=== CLI Usage Examples ===\n'));
    
    console.log(chalk.yellow('Basic Commands:'));
    console.log('npx ts-node src/cli/rsyncCli.ts check                    # Check rsync availability');
    console.log('npx ts-node src/cli/rsyncCli.ts check --json             # JSON output');
    console.log('npx ts-node src/cli/rsyncCli.ts check --verbose          # Detailed output');
    console.log('npx ts-node src/cli/rsyncCli.ts install                  # Show installation instructions');
    console.log('npx ts-node src/cli/rsyncCli.ts install --auto           # Attempt automatic installation');
    console.log('npx ts-node src/cli/rsyncCli.ts install --interactive    # Interactive guide');
    console.log('npx ts-node src/cli/rsyncCli.ts report                   # Full compatibility report');
    
    console.log(chalk.yellow('\nPlatform-specific:'));
    console.log('npx ts-node src/cli/rsyncCli.ts install --platform win32 # Windows instructions');
    console.log('npx ts-node src/cli/rsyncCli.ts install --platform darwin # macOS instructions');
    console.log('npx ts-node src/cli/rsyncCli.ts install --platform linux # Linux instructions');
}

async function realWorldExamples() {
    console.log(chalk.blue.bold('\n=== Real-World Usage Scenarios ===\n'));
    
    console.log(chalk.yellow('Scenario 1: Application Startup Check'));
    console.log(`
// In your main application file
import { RsyncCompatibilityChecker } from 'fast-transferlib';

async function startApp() {
    const rsyncCheck = await RsyncCompatibilityChecker.checkCompatibility();
    
    if (!rsyncCheck.isAvailable) {
        console.warn('Rsync not available. File transfer features disabled.');
        console.log('To enable transfers, install rsync:');
        console.log(rsyncCheck.installInstructions);
        
        // Continue app without transfer features
        return startAppWithoutTransfers();
    }
    
    // Full app with transfer capabilities
    return startFullApp();
}
    `);
    
    console.log(chalk.yellow('Scenario 2: Automatic Installation in Setup Script'));
    console.log(`
// In setup.js or installation script
import { RsyncCompatibilityChecker } from 'fast-transferlib';

async function setupEnvironment() {
    console.log('Checking rsync availability...');
    
    const check = await RsyncCompatibilityChecker.checkCompatibility();
    
    if (!check.isAvailable) {
        console.log('Installing rsync...');
        const installResult = await RsyncCompatibilityChecker.attemptAutoInstall();
        
        if (!installResult.success) {
            console.error('Failed to install rsync automatically.');
            console.log('Please install manually:', installResult.message);
            process.exit(1);
        }
    }
    
    console.log('Environment ready!');
}
    `);
    
    console.log(chalk.yellow('Scenario 3: File Backup System'));
    console.log(`
// In backup service
import RsyncManager from 'fast-transferlib/rsync';

class BackupService {
    private rsync: RsyncManager;
    
    async initialize() {
        this.rsync = new RsyncManager();
        const ready = await this.rsync.initialize();
        
        if (!ready) {
            throw new Error('Backup service requires rsync');
        }
    }
    
    async backup(source: string, destination: string) {
        return this.rsync.sync(source, destination, {
            archive: true,
            verbose: true,
            compress: true,
            delete: true,
            exclude: ['*.tmp', '.DS_Store', 'node_modules/']
        });
    }
}
    `);
    
    console.log(chalk.yellow('Scenario 4: Cross-platform Development Tool'));
    console.log(`
// In development tooling
import { RsyncCompatibilityChecker } from 'fast-transferlib';

async function deployProject() {
    const compatibility = await RsyncCompatibilityChecker.checkCompatibility();
    
    if (!compatibility.isAvailable) {
        if (compatibility.platform === 'win32') {
            console.log('Windows detected. Consider using WSL for better rsync support.');
            console.log('Run: wsl --install -d Ubuntu');
        }
        
        // Show platform-specific installation
        const instructions = RsyncCompatibilityChecker.getInstallInstructions();
        console.log('Install rsync using one of these methods:');
        instructions.forEach(method => {
            console.log(\`- \${method.method}: \${method.command}\`);
        });
        
        return false;
    }
    
    // Proceed with deployment using rsync
    return true;
}
    `);
}

// Main execution
async function main() {
    console.log(chalk.magenta.bold('FAST-TransferLib Rsync Examples\n'));
    
    try {
        await libraryExamples();
        await cliExamples();
        await realWorldExamples();
        
        console.log(chalk.green.bold('\nExamples completed successfully!'));
        console.log(chalk.blue('\nTo try the CLI:'));
        console.log(chalk.white('npx ts-node src/cli/rsyncCli.ts check'));
        
    } catch (error) {
        console.error(chalk.red('Error running examples:'), error);
        process.exit(1);
    }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    libraryExamples,
    cliExamples,
    realWorldExamples
};