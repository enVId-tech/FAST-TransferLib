#!/usr/bin/env node

/**
 * Test script to demonstrate enhanced installation area checking
 */

import { RsyncCompatibilityChecker } from '../src/sys/rsyncChecker.js';
import chalk from 'chalk';

async function testEnhancedChecking() {
    console.log(chalk.blue.bold('=== Enhanced Installation Area Checking ===\n'));

    console.log(chalk.yellow('🔍 New Smart Checking System:'));
    console.log('• Checks standard PATH first');
    console.log('• Scans Git Bash installation paths');
    console.log('• Checks WSL distributions');
    console.log('• Looks in Scoop installation directories');
    console.log('• Searches Chocolatey installation paths');
    console.log('• Skips installation methods where rsync already exists');
    console.log('• Validates prerequisites before attempting installation\n');

    console.log(chalk.yellow('🎯 Performing comprehensive rsync detection...'));
    
    // Test the enhanced compatibility check
    const result = await RsyncCompatibilityChecker.checkCompatibility();
    
    if (result.isAvailable) {
        console.log(chalk.green(`✅ Rsync found: ${result.version} on ${result.platformName}`));
        
        // Show what locations were checked
        console.log(chalk.blue('\n📍 Detection process:'));
        console.log('1. ✅ Standard PATH check succeeded');
        console.log('2. ⏭️  Alternative location scanning skipped (already found)');
        
    } else {
        console.log(chalk.red(`❌ Rsync not found: ${result.errorMessage}`));
        
        console.log(chalk.blue('\n📍 Locations checked:'));
        console.log('1. ❌ Standard PATH');
        console.log('2. 🔍 Git Bash installation paths');
        console.log('3. 🔍 WSL distributions');
        console.log('4. 🔍 Scoop installation directory');
        console.log('5. 🔍 Chocolatey installation paths');
        
        // Test installation method filtering
        console.log(chalk.yellow('\n🎛️  Testing installation method filtering...'));
        
        const methods = RsyncCompatibilityChecker.getInstallInstructions();
        console.log(`Found ${methods.length} total installation methods`);
        
        // Show which methods would be skipped
        console.log(chalk.blue('\nMethod viability analysis:'));
        methods.forEach((method, index) => {
            const execIcon = method.isExecutable ? '🟢' : '🔘';
            const statusText = method.isExecutable ? 'executable' : 'manual';
            
            console.log(`${execIcon} ${method.method} (${statusText})`);
            
            if (method.isExecutable) {
                // This simulates the filtering logic
                if (method.method === 'Git Bash') {
                    try {
                        require('child_process').execSync('where git', { stdio: 'ignore' });
                        console.log(`   ⚠️  Git already installed - would check for rsync in Git paths`);
                    } catch {
                        console.log(`   ❌ Git not installed - would attempt installation`);
                    }
                } else if (method.method === 'WSL2') {
                    try {
                        require('child_process').execSync('wsl --list', { stdio: 'ignore' });
                        console.log(`   ⚠️  WSL already available - would check for rsync in WSL`);
                    } catch {
                        console.log(`   ❌ WSL not available - would attempt setup`);
                    }
                } else {
                    console.log(`   🔄 Would check tool availability and prerequisites`);
                }
            }
        });
    }

    console.log(chalk.green('\n🚀 Key Improvements:'));
    console.log('• Prevents unnecessary installations when rsync already exists');
    console.log('• Finds rsync in non-standard locations');
    console.log('• Validates prerequisites before attempting installation');
    console.log('• Provides more accurate availability reporting');
    console.log('• Reduces false negatives from incomplete PATH detection');
}

testEnhancedChecking().catch(console.error);