#!/usr/bin/env node

/**
 * Demo script showcasing advanced transfer utilities
 * 
 * This script demonstrates the new advanced features:
 * - SSH probing and auto-connection
 * - File enumeration with metadata
 * - Transfer session timing and tracking
 * - Copy/cut operations
 * - ZIP compression and transfer
 * - Network speed detection
 */

import {
    SSHProber,
    NetworkConnectionManager,
    FileEnumerator,
    TransferSessionManager,
    FileOperationsManager,
    ZipTransferManager,
    NetworkSpeedDetector,
    TransferTarget
} from './main.js';

class AdvancedFeaturesDemo {
    private sessionManager = new TransferSessionManager();

    async runDemo(): Promise<void> {
        console.log('🚀 FAST-TransferLib Advanced Features Demo\n');

        // Demo targets
        const localSource: TransferTarget = {
            path: process.cwd(),
            isRemote: false
        };

        const remoteTarget: TransferTarget = {
            path: '/tmp/test',
            host: 'example.com',
            user: 'testuser',
            isRemote: true
        };

        try {
            await this.demoSSHProbing();
            await this.demoNetworkConnection();
            await this.demoFileEnumeration(localSource);
            await this.demoTransferTiming(localSource, remoteTarget);
            await this.demoCopyOperations(localSource);
            await this.demoZipTransfer(localSource, remoteTarget);
            await this.demoNetworkSpeed(remoteTarget);
        } catch (error) {
            console.error('❌ Demo error:', error);
        }
    }

    private async demoSSHProbing(): Promise<void> {
        console.log('🔍 1. SSH Probing Demo');
        console.log('=' .repeat(50));

        const hosts = ['github.com', 'gitlab.com', 'nonexistent.example.com'];

        for (const host of hosts) {
            console.log(`Probing ${host}:22...`);
            const result = await SSHProber.probeSSH(host, 22, 3000);
            
            if (result.accessible) {
                console.log(`✅ ${host} is accessible`);
                console.log(`   Response time: ${result.responseTime}ms`);
                if (result.sshVersion) {
                    console.log(`   SSH version: ${result.sshVersion}`);
                }
            } else {
                console.log(`❌ ${host} is not accessible: ${result.error}`);
            }
        }
        console.log();
    }

    private async demoNetworkConnection(): Promise<void> {
        console.log('🌐 2. Network Connection Demo');
        console.log('=' .repeat(50));

        const targets = [
            { host: 'github.com', port: 22, description: 'GitHub SSH' },
            { host: 'google.com', port: 80, description: 'Google HTTP' },
            { host: 'nonexistent.example.com', port: 22, description: 'Non-existent host' }
        ];

        for (const target of targets) {
            console.log(`Testing connection to ${target.description}...`);
            
            const testTarget: TransferTarget = {
                path: '/tmp',
                host: target.host,
                port: target.port,
                isRemote: true
            };

            const result = await NetworkConnectionManager.establishConnection(testTarget);
            
            if (result.success) {
                console.log(`✅ Connected via ${result.protocol}`);
                console.log(`   Connection time: ${result.connectionTime}ms`);
                console.log(`   Fallback used: ${result.fallbackUsed ? 'Yes' : 'No'}`);
            } else {
                console.log(`❌ Connection failed: ${result.error}`);
            }
        }
        console.log();
    }

    private async demoFileEnumeration(source: TransferTarget): Promise<void> {
        console.log('📁 3. File Enumeration Demo');
        console.log('=' .repeat(50));

        console.log(`Enumerating files in: ${source.path}`);
        
        try {
            const files = await FileEnumerator.enumerateFiles(source, false);
            
            console.log(`Found ${files.length} files and directories:`);
            
            // Show first 10 files as example
            const displayFiles = files.slice(0, 10);
            
            for (const file of displayFiles) {
                const sizeStr = file.type === 'file' ? 
                    `${(file.size / 1024).toFixed(1)}KB` : 
                    '<DIR>';
                
                console.log(`   ${file.type === 'directory' ? '📁' : '📄'} ${file.name} (${sizeStr})`);
                console.log(`      Path: ${file.relativePath}`);
                console.log(`      Modified: ${file.modified.toLocaleDateString()}`);
                
                if (file.mimeType) {
                    console.log(`      MIME: ${file.mimeType}`);
                }
            }
            
            if (files.length > 10) {
                console.log(`   ... and ${files.length - 10} more files`);
            }
            
            // Summary statistics
            const totalSize = files.reduce((sum: number, f: any) => sum + f.size, 0);
            const fileCount = files.filter((f: any) => f.type === 'file').length;
            const dirCount = files.filter((f: any) => f.type === 'directory').length;
            
            console.log('\n📊 Summary:');
            console.log(`   Files: ${fileCount}`);
            console.log(`   Directories: ${dirCount}`);
            console.log(`   Total size: ${(totalSize / (1024 * 1024)).toFixed(1)}MB`);
            
        } catch (error) {
            console.log(`❌ Enumeration failed: ${error}`);
        }
        console.log();
    }

    private async demoTransferTiming(source: TransferTarget, destination: TransferTarget): Promise<void> {
        console.log('⏱️ 4. Transfer Timing Demo');
        console.log('=' .repeat(50));

        console.log('Creating a mock transfer session...');
        
        const sessionId = this.sessionManager.startSession();
        console.log(`Session started: ${sessionId}`);

        // Simulate file transfers with mock data
        const mockFiles = [
            { name: 'document.pdf', size: 1024 * 1024 * 2, path: '/docs/document.pdf' },
            { name: 'image.jpg', size: 1024 * 512, path: '/images/image.jpg' },
            { name: 'video.mp4', size: 1024 * 1024 * 50, path: '/videos/video.mp4' }
        ];

        for (const mockFile of mockFiles) {
            const startTime = new Date();
            
            // Simulate transfer time (faster for smaller files)
            const transferDuration = Math.max(100, mockFile.size / (1024 * 1024 * 2)); // 2MB/s simulation
            await new Promise(resolve => setTimeout(resolve, transferDuration));
            
            const endTime = new Date();
            
            const metadata = {
                path: mockFile.path,
                name: mockFile.name,
                size: mockFile.size,
                type: 'file' as const,
                created: new Date(),
                modified: new Date(),
                accessed: new Date(),
                isHidden: false,
                relativePath: mockFile.name
            };

            this.sessionManager.trackFileTransfer(
                sessionId,
                metadata,
                startTime,
                endTime,
                'success'
            );

            const bytesPerSecond = mockFile.size / (transferDuration / 1000);
            console.log(`✅ Transferred ${mockFile.name}: ${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`);
        }

        const session = this.sessionManager.endSession(sessionId);
        
        if (session) {
            console.log('\n📈 Session Statistics:');
            console.log(`   Duration: ${session.totalDuration}ms`);
            console.log(`   Files transferred: ${session.successfulFiles}/${session.totalFiles}`);
            console.log(`   Total data: ${(session.totalBytes / (1024 * 1024)).toFixed(1)}MB`);
            console.log(`   Average speed: ${(session.averageSpeed / (1024 * 1024)).toFixed(1)} MB/s`);
            console.log(`   Peak speed: ${(session.peakSpeed / (1024 * 1024)).toFixed(1)} MB/s`);
            console.log(`   Estimated network speed: ${session.networkSpeed} Mbps`);
        }
        console.log();
    }

    private async demoCopyOperations(source: TransferTarget): Promise<void> {
        console.log('📋 5. Copy/Cut Operations Demo');
        console.log('=' .repeat(50));

        try {
            // Get some files to work with
            const files = await FileEnumerator.enumerateFiles(source, false);
            const testFiles = files.filter((f: any) => f.type === 'file').slice(0, 2);
            
            if (testFiles.length === 0) {
                console.log('❌ No files found to copy');
                return;
            }

            console.log('Copying files to clipboard...');
            const copyOp = await FileOperationsManager.copyFiles(
                source,
                testFiles.map((f: any) => f.relativePath)
            );

            console.log(`✅ Copied ${copyOp.files.length} files to clipboard`);
            console.log(`   Operation ID: ${copyOp.id}`);
            console.log(`   Type: ${copyOp.type}`);
            console.log(`   Files: ${copyOp.files.join(', ')}`);

            // Check clipboard
            const clipboard = FileOperationsManager.getClipboard();
            if (clipboard) {
                console.log(`📋 Clipboard contains: ${clipboard.files.length} files`);
            }

            // Clear clipboard
            FileOperationsManager.clearClipboard();
            console.log('🗑️  Clipboard cleared');

            // Demo cut operation
            console.log('\nTesting cut operation...');
            const cutOp = await FileOperationsManager.cutFiles(
                source,
                testFiles.slice(0, 1).map((f: any) => f.relativePath)
            );

            console.log(`✂️  Cut ${cutOp.files.length} files to clipboard`);
            console.log(`   Operation ID: ${cutOp.id}`);

        } catch (error) {
            console.log(`❌ Copy operations failed: ${error}`);
        }
        console.log();
    }

    private async demoZipTransfer(source: TransferTarget, destination: TransferTarget): Promise<void> {
        console.log('🗜️ 6. ZIP Compression Demo');
        console.log('=' .repeat(50));

        try {
            console.log(`Creating ZIP from: ${source.path}`);
            
            const zipResult = await ZipTransferManager.createZip(source, {
                compressionLevel: 6,
                includeHiddenFiles: false,
                zipName: 'demo-archive.zip'
            });

            if (zipResult.success) {
                console.log('✅ ZIP created successfully!');
                console.log(`   Path: ${zipResult.zipPath}`);
                console.log(`   Original size: ${(zipResult.originalSize / (1024 * 1024)).toFixed(1)}MB`);
                console.log(`   Compressed size: ${(zipResult.compressedSize / (1024 * 1024)).toFixed(1)}MB`);
                console.log(`   Compression ratio: ${zipResult.compressionRatio}%`);
                console.log(`   Files included: ${zipResult.fileCount}`);
                
                // Note: Actual transfer would require valid remote target
                console.log('\n📝 Note: Transfer to remote destination would require valid SSH access');
                
            } else {
                console.log(`❌ ZIP creation failed: ${zipResult.error}`);
            }

        } catch (error) {
            console.log(`❌ ZIP demo failed: ${error}`);
        }
        console.log();
    }

    private async demoNetworkSpeed(target: TransferTarget): Promise<void> {
        console.log('🚄 7. Network Speed Detection Demo');
        console.log('=' .repeat(50));

        // Test with localhost since we can't guarantee remote access
        const localTarget: TransferTarget = {
            path: '/tmp',
            isRemote: false
        };

        try {
            console.log('Testing network speed with local transfer...');
            
            const speedResult = await NetworkSpeedDetector.detectNetworkSpeed(localTarget, 0.1); // 0.1MB test
            
            if (speedResult.speedMbps > 0) {
                console.log(`✅ Speed test completed!`);
                console.log(`   Speed: ${speedResult.speedMbps} Mbps`);
                console.log(`   Latency: ${speedResult.latencyMs}ms`);
            } else {
                console.log(`❌ Speed test failed: ${speedResult.error}`);
            }

            // Test ping to a public server
            console.log('\nTesting ping to Google DNS...');
            const pingResult = await NetworkSpeedDetector.pingHost('8.8.8.8', 3);
            
            if (pingResult.avgLatencyMs > 0) {
                console.log(`🏓 Ping results:`);
                console.log(`   Average latency: ${pingResult.avgLatencyMs}ms`);
                console.log(`   Packet loss: ${pingResult.packetLoss}%`);
            } else {
                console.log(`❌ Ping failed: ${pingResult.error}`);
            }

        } catch (error) {
            console.log(`❌ Network speed test failed: ${error}`);
        }
        console.log();
    }
}

// Run the demo
async function main() {
    const demo = new AdvancedFeaturesDemo();
    await demo.runDemo();
    
    console.log('🎉 Advanced features demo completed!');
    console.log('\nTo use these features in your application:');
    console.log('1. Import the utilities from FAST-TransferLib');
    console.log('2. Use SSH probing to test connectivity before transfers');
    console.log('3. Enumerate files to get detailed metadata');
    console.log('4. Track transfer sessions for performance monitoring');
    console.log('5. Use copy/cut operations for file management');
    console.log('6. Compress large transfers with ZIP utilities');
    console.log('7. Monitor network performance with speed detection');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export default AdvancedFeaturesDemo;