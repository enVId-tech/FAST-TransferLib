#!/usr/bin/env node

/**
 * Test script to verify advanced features compilation and basic functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Test basic imports
async function testImports() {
    console.log('Testing Advanced Features - Import Verification');
    console.log('=' .repeat(60));

    try {
        // Test importing the advanced utilities
        const { 
            SSHProber,
            NetworkConnectionManager,
            FileEnumerator,
            TransferSessionManager,
            FileOperationsManager
        } = await import('../src/transfer/advanced-utils.js');

        console.log('Advanced utilities imported successfully');

        // Test importing zip utilities
        const {
            ZipTransferManager,
            NetworkSpeedDetector
        } = await import('../src/utils/zip-utils.js');

        console.log('ZIP utilities imported successfully');

        // Test basic class instantiation
        const sessionManager = new TransferSessionManager();
        console.log('TransferSessionManager instantiated');

        // Test static method availability
        console.log('SSHProber methods available:', Object.getOwnPropertyNames(SSHProber));
        console.log('NetworkConnectionManager methods available:', Object.getOwnPropertyNames(NetworkConnectionManager));
        console.log('FileEnumerator methods available:', Object.getOwnPropertyNames(FileEnumerator));
        console.log('FileOperationsManager methods available:', Object.getOwnPropertyNames(FileOperationsManager));
        console.log('ZipTransferManager methods available:', Object.getOwnPropertyNames(ZipTransferManager));
        console.log('NetworkSpeedDetector methods available:', Object.getOwnPropertyNames(NetworkSpeedDetector));

        return true;
    } catch (error) {
        console.error('Import test failed:', error);
        return false;
    }
}

// Test basic functionality without external dependencies
async function testBasicFunctionality() {
    console.log('\nTesting Basic Functionality');
    console.log('=' .repeat(60));

    try {
        const { TransferSessionManager, FileOperationsManager } = await import('../src/transfer/advanced-utils.js');

        // Test session management
        console.log('Testing session management...');
        const sessionManager = new TransferSessionManager();
        const sessionId = sessionManager.startSession();
        console.log(`Session started: ${sessionId}`);

        const session = sessionManager.getSession(sessionId);
        console.log(`Session retrieved: ${session?.sessionId}`);

        const endedSession = sessionManager.endSession(sessionId);
        console.log(`Session ended: ${endedSession?.sessionId}`);

        // Test clipboard operations
        console.log('\nTesting clipboard operations...');
        
        // Clear any existing clipboard
        FileOperationsManager.clearClipboard();
        console.log('Clipboard cleared');

        const clipboard = FileOperationsManager.getClipboard();
        console.log(`Clipboard check: ${clipboard ? 'Has content' : 'Empty'}`);

        return true;
    } catch (error) {
        console.error('Basic functionality test failed:', error);
        return false;
    }
}

// Test file enumeration on current directory
async function testFileEnumeration() {
    console.log('\nTesting File Enumeration');
    console.log('=' .repeat(60));

    try {
        const { FileEnumerator } = await import('../src/transfer/advanced-utils.js');

        const target = {
            path: process.cwd(),
            isRemote: false
        };

        console.log(`Enumerating files in: ${target.path}`);
        const files = await FileEnumerator.enumerateFiles(target, false);
        
        console.log(`Found ${files.length} files and directories`);
        
        if (files.length > 0) {
            const firstFile = files[0];
            console.log(`Sample file: ${firstFile.name} (${firstFile.type})`);
            console.log(`   Size: ${firstFile.size} bytes`);
            console.log(`   Modified: ${firstFile.modified}`);
        }

        return true;
    } catch (error) {
        console.error('File enumeration test failed:', error);
        return false;
    }
}

// Test network utilities with safe targets
async function testNetworkUtilities() {
    console.log('\nTesting Network Utilities');
    console.log('=' .repeat(60));

    try {
        const { SSHProber } = await import('../src/transfer/advanced-utils.js');
        const { NetworkSpeedDetector } = await import('../src/utils/zip-utils.js');

        // Test SSH probing with a known SSH server
        console.log('Testing SSH probe to github.com...');
        const probeResult = await SSHProber.probeSSH('github.com', 22, 2000);
        console.log(`SSH probe completed: ${probeResult.accessible ? 'Accessible' : 'Not accessible'}`);
        console.log(`   Response time: ${probeResult.responseTime}ms`);

        // Test ping to a reliable server
        console.log('\nTesting ping to Google DNS...');
        const pingResult = await NetworkSpeedDetector.pingHost('8.8.8.8', 2);
        console.log(`Ping completed: ${pingResult.avgLatencyMs}ms average`);
        console.log(`   Packet loss: ${pingResult.packetLoss}%`);

        return true;
    } catch (error) {
        console.error('Network utilities test failed:', error);
        return false;
    }
}

// Main test runner
async function runTests() {
    console.log('FAST-TransferLib Advanced Features Test Suite\n');

    const tests = [
        { name: 'Import Verification', test: testImports },
        { name: 'Basic Functionality', test: testBasicFunctionality },
        { name: 'File Enumeration', test: testFileEnumeration },
        { name: 'Network Utilities', test: testNetworkUtilities }
    ];

    let passed = 0;
    let failed = 0;

    for (const { name, test } of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
                console.log(`${name}: PASSED`);
            } else {
                failed++;
                console.log(`${name}: FAILED`);
            }
        } catch (error) {
            failed++;
            console.log(`${name}: ERROR - ${error}`);
        }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('All tests passed! Advanced features are ready to use.');
        console.log('\nNext steps:');
        console.log('1. Run: node demo-advanced.ts');
        console.log('2. Integrate advanced features into your applications');
        console.log('3. Check documentation for detailed API usage');
    } else {
        console.log('Some tests failed. Please review the errors above.');
    }

    return failed === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runTests().catch(console.error);
}

export default runTests;