#!/usr/bin/env node

/**
 * Test script to demonstrate enhanced automatic installation with fallback methods
 */

import { RsyncCompatibilityChecker } from '../src/sys/rsyncChecker.js';
import chalk from 'chalk';

async function testEnhancedAutoInstall() {
    console.log(chalk.blue.bold('=== Enhanced Auto-Installation Test ===\n'));

    // First, check current status
    console.log(chalk.yellow('1. Checking current rsync status...'));
    const initialCheck = await RsyncCompatibilityChecker.checkCompatibility();
    
    if (initialCheck.isAvailable) {
        console.log(chalk.green(`Rsync is already available (${initialCheck.version})`));
        console.log(chalk.blue('This test is designed for systems without rsync.'));
        return;
    }

    console.log(chalk.red('Rsync not available. Testing enhanced auto-installation...'));

    // Show what installation methods are available
    console.log(chalk.yellow('\n2. Available installation methods:'));
    const methods = RsyncCompatibilityChecker.getInstallInstructions();
    methods.forEach((method, index) => {
        const adminText = method.requiresAdmin ? chalk.red(' (requires admin)') : chalk.green(' (no admin)');
        console.log(`   ${index + 1}. ${method.method}${adminText}`);
        console.log(`      Command: ${method.command}`);
    });

    // Attempt enhanced auto-installation
    console.log(chalk.yellow('\n3. Attempting enhanced auto-installation...'));
    console.log(chalk.gray('(This will try multiple methods automatically if the first fails)'));
    
    try {
        const installResult = await RsyncCompatibilityChecker.attemptAutoInstall();
        
        if (installResult.success) {
            console.log(chalk.green('\nSuccess! ' + installResult.message));
            
            // Verify installation
            const verifyCheck = await RsyncCompatibilityChecker.checkCompatibility();
            if (verifyCheck.isAvailable) {
                console.log(chalk.green(`Verified: Rsync ${verifyCheck.version} is now available!`));
            }
        } else {
            console.log(chalk.red('\nInstallation failed: ' + installResult.message));
            console.log(chalk.blue('\nDetailed installation instructions:'));
            
            methods.forEach((method, index) => {
                console.log(chalk.yellow(`\n${index + 1}. ${method.method}`));
                console.log(`   Command: ${chalk.white(method.command)}`);
                console.log(`   Description: ${method.description}`);
                console.log(`   Requires Admin: ${method.requiresAdmin ? chalk.red('Yes') : chalk.green('No')}`);
            });
        }
    } catch (error) {
        console.error(chalk.red('Error during installation test:'), error);
    }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testEnhancedAutoInstall().catch(console.error);
}

export { testEnhancedAutoInstall };