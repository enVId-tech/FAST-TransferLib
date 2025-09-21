import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';
import { TransferTarget, TransferResult, TransferOptions } from '../transfer/interfaces.js';
import { createUnifiedTransferManager } from '../transfer/manager.js';
import { FileEnumerator, FileMetadata } from '../transfer/advanced-utils.js';

export interface ZipTransferOptions extends TransferOptions {
    compressionLevel?: number; // 0-9
    includeHiddenFiles?: boolean;
    preserveStructure?: boolean;
    zipName?: string;
    password?: string;
    createOnly?: boolean; // Only create zip, don't transfer
}

export interface ZipResult {
    success: boolean;
    zipPath: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    fileCount: number;
    error?: string;
}

/**
 * ZIP Compression and Transfer Utilities
 */
export class ZipTransferManager {
    private static readonly DEFAULT_COMPRESSION_LEVEL = 6;
    private static readonly MAX_COMPRESSION_LEVEL = 9;

    /**
     * Create a zip file from source and optionally transfer it
     */
    static async zipAndTransfer(
        source: TransferTarget,
        destination: TransferTarget,
        options: ZipTransferOptions = {}
    ): Promise<{ zipResult: ZipResult; transferResult?: TransferResult }> {
        
        // Create the zip file
        const zipResult = await this.createZip(source, options);
        
        if (!zipResult.success) {
            return { zipResult };
        }

        // Transfer the zip if not createOnly
        if (!options.createOnly) {
            try {
                const manager = await createUnifiedTransferManager();
                
                const zipSource: TransferTarget = {
                    path: path.dirname(zipResult.zipPath),
                    isRemote: false
                };

                const transferResult = await manager.transfer(zipSource, destination, {
                    include: [path.basename(zipResult.zipPath)]
                });

                // Cleanup if manager has cleanup method
                if ('cleanup' in manager && typeof manager.cleanup === 'function') {
                    await manager.cleanup();
                }

                return { zipResult, transferResult };
                
            } catch (error) {
                return {
                    zipResult,
                    transferResult: {
                        success: false,
                        exitCode: 1,
                        output: '',
                        bytesTransferred: 0,
                        filesTransferred: 0,
                        method: 'unknown' as const,
                        fallbackUsed: false,
                        error: error instanceof Error ? error.message : 'Transfer failed'
                    }
                };
            }
        }

        return { zipResult };
    }

    /**
     * Create a zip file from the source target
     */
    static async createZip(source: TransferTarget, options: ZipTransferOptions = {}): Promise<ZipResult> {
        try {
            // Enumerate files to be zipped
            const files = await FileEnumerator.enumerateFiles(source, options.includeHiddenFiles || false);
            
            if (files.length === 0) {
                return {
                    success: false,
                    zipPath: '',
                    originalSize: 0,
                    compressedSize: 0,
                    compressionRatio: 0,
                    fileCount: 0,
                    error: 'No files found to zip'
                };
            }

            // Calculate total original size
            const originalSize = files.reduce((sum, file) => sum + file.size, 0);

            // Generate zip file path
            const zipName = options.zipName || this.generateZipName(source);
            const zipPath = await this.getZipPath(zipName, source.isRemote);

            // Create the zip file
            const compressionLevel = Math.min(options.compressionLevel || this.DEFAULT_COMPRESSION_LEVEL, this.MAX_COMPRESSION_LEVEL);
            
            if (source.isRemote) {
                await this.createRemoteZip(source, zipPath, files, compressionLevel, options);
            } else {
                await this.createLocalZip(source, zipPath, files, compressionLevel, options);
            }

            // Get compressed file size
            const compressedSize = await this.getFileSize(zipPath);
            const compressionRatio = originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;

            return {
                success: true,
                zipPath,
                originalSize,
                compressedSize,
                compressionRatio: Math.round(compressionRatio * 100) / 100,
                fileCount: files.length
            };

        } catch (error) {
            return {
                success: false,
                zipPath: '',
                originalSize: 0,
                compressedSize: 0,
                compressionRatio: 0,
                fileCount: 0,
                error: error instanceof Error ? error.message : 'Unknown error during zip creation'
            };
        }
    }

    /**
     * Extract a zip file
     */
    static async extractZip(
        zipPath: string,
        destination: TransferTarget,
        password?: string
    ): Promise<{ success: boolean; extractedFiles: number; error?: string }> {
        try {
            if (destination.isRemote) {
                return await this.extractRemoteZip(zipPath, destination, password);
            } else {
                return await this.extractLocalZip(zipPath, destination, password);
            }
        } catch (error) {
            return {
                success: false,
                extractedFiles: 0,
                error: error instanceof Error ? error.message : 'Unknown error during extraction'
            };
        }
    }

    private static async createLocalZip(
        source: TransferTarget,
        zipPath: string,
        files: FileMetadata[],
        compressionLevel: number,
        options: ZipTransferOptions
    ): Promise<void> {
        const platform = os.platform();
        
        if (platform === 'win32') {
            await this.createZipWithPowerShell(source, zipPath, files, compressionLevel, options);
        } else {
            await this.createZipWithCommand(source, zipPath, files, compressionLevel, options);
        }
    }

    private static async createRemoteZip(
        source: TransferTarget,
        zipPath: string,
        files: FileMetadata[],
        compressionLevel: number,
        options: ZipTransferOptions
    ): Promise<void> {
        // Create zip on remote system via SSH
        const fileList = files.map(f => f.relativePath).join(' ');
        const passwordOption = options.password ? `-P ${options.password}` : '';
        const compressionOption = `-${compressionLevel}`;
        
        const command = `ssh ${source.user ? source.user + '@' : ''}${source.host} "cd ${source.path} && zip ${passwordOption} ${compressionOption} -r ${zipPath} ${fileList}"`;
        
        execSync(command, { timeout: 300000 }); // 5 minute timeout
    }

    private static async createZipWithPowerShell(
        source: TransferTarget,
        zipPath: string,
        files: FileMetadata[],
        compressionLevel: number,
        options: ZipTransferOptions
    ): Promise<void> {
        // Use PowerShell Compress-Archive
        const compressionLevelMap: { [key: number]: string } = {
            0: 'NoCompression',
            1: 'Fastest',
            6: 'Optimal',
            9: 'SmallestSize'
        };

        const level = compressionLevelMap[compressionLevel] || 'Optimal';
        
        // Create a list of files to include
        const fileList = files.map(f => `"${path.join(source.path, f.relativePath)}"`).join(',');
        
        const script = `
            $files = @(${fileList})
            Compress-Archive -Path $files -DestinationPath "${zipPath}" -CompressionLevel ${level} -Force
        `;

        execSync(`powershell -Command "${script}"`, { timeout: 300000 });
    }

    private static async createZipWithCommand(
        source: TransferTarget,
        zipPath: string,
        files: FileMetadata[],
        compressionLevel: number,
        options: ZipTransferOptions
    ): Promise<void> {
        // Use system zip command
        const fileList = files.map(f => `"${f.relativePath}"`).join(' ');
        const passwordOption = options.password ? `-P ${options.password}` : '';
        const compressionOption = `-${compressionLevel}`;
        
        const command = `cd "${source.path}" && zip ${passwordOption} ${compressionOption} -r "${zipPath}" ${fileList}`;
        
        execSync(command, { timeout: 300000 });
    }

    private static async extractLocalZip(
        zipPath: string,
        destination: TransferTarget,
        password?: string
    ): Promise<{ success: boolean; extractedFiles: number; error?: string }> {
        const platform = os.platform();
        
        try {
            if (platform === 'win32') {
                await this.extractZipWithPowerShell(zipPath, destination, password);
            } else {
                await this.extractZipWithCommand(zipPath, destination, password);
            }

            // Count extracted files
            const files = await FileEnumerator.enumerateFiles(destination, true);
            return { success: true, extractedFiles: files.length };
            
        } catch (error) {
            return {
                success: false,
                extractedFiles: 0,
                error: error instanceof Error ? error.message : 'Extraction failed'
            };
        }
    }

    private static async extractRemoteZip(
        zipPath: string,
        destination: TransferTarget,
        password?: string
    ): Promise<{ success: boolean; extractedFiles: number; error?: string }> {
        try {
            const passwordOption = password ? `-P ${password}` : '';
            const command = `ssh ${destination.user ? destination.user + '@' : ''}${destination.host} "cd ${destination.path} && unzip ${passwordOption} -o ${zipPath}"`;
            
            const output = execSync(command, { encoding: 'utf8', timeout: 300000 });
            
            // Parse output to count extracted files
            const extractedFiles = (output.match(/inflating:/g) || []).length;
            
            return { success: true, extractedFiles };
            
        } catch (error) {
            return {
                success: false,
                extractedFiles: 0,
                error: error instanceof Error ? error.message : 'Remote extraction failed'
            };
        }
    }

    private static async extractZipWithPowerShell(
        zipPath: string,
        destination: TransferTarget,
        password?: string
    ): Promise<void> {
        if (password) {
            throw new Error('Password-protected zip extraction not supported with PowerShell');
        }
        
        const script = `Expand-Archive -Path "${zipPath}" -DestinationPath "${destination.path}" -Force`;
        execSync(`powershell -Command "${script}"`, { timeout: 300000 });
    }

    private static async extractZipWithCommand(
        zipPath: string,
        destination: TransferTarget,
        password?: string
    ): Promise<void> {
        const passwordOption = password ? `-P ${password}` : '';
        const command = `unzip ${passwordOption} -o "${zipPath}" -d "${destination.path}"`;
        
        execSync(command, { timeout: 300000 });
    }

    private static generateZipName(source: TransferTarget): string {
        const baseName = path.basename(source.path) || 'archive';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${baseName}-${timestamp}.zip`;
    }

    private static async getZipPath(zipName: string, isRemote: boolean): Promise<string> {
        if (isRemote) {
            // For remote, we'll create in the temp directory and handle transfer separately
            const tempDir = os.tmpdir();
            return path.join(tempDir, zipName);
        } else {
            // For local, create in the same directory or temp
            const tempDir = os.tmpdir();
            return path.join(tempDir, zipName);
        }
    }

    private static async getFileSize(filePath: string): Promise<number> {
        try {
            const stat = await fs.stat(filePath);
            return stat.size;
        } catch {
            return 0;
        }
    }
}

/**
 * Network Speed Detection Utilities
 */
export class NetworkSpeedDetector {
    /**
     * Detect network speed by transferring a test file
     */
    static async detectNetworkSpeed(
        testTarget: TransferTarget,
        testFileSizeMB: number = 1
    ): Promise<{ speedMbps: number; latencyMs: number; error?: string }> {
        try {
            // Create a test file
            const testFile = await this.createTestFile(testFileSizeMB);
            
            const startTime = Date.now();
            
            // Transfer test file
            const manager = await createUnifiedTransferManager();
            
            const source: TransferTarget = {
                path: path.dirname(testFile),
                isRemote: false
            };

            const result = await manager.transfer(source, testTarget, {
                include: [path.basename(testFile)]
            });

            const endTime = Date.now();
            const transferTime = (endTime - startTime) / 1000; // seconds
            
            // Cleanup if manager has cleanup method
            if ('cleanup' in manager && typeof manager.cleanup === 'function') {
                await manager.cleanup();
            }

            // Clean up test file
            await fs.unlink(testFile);

            if (!result.success) {
                return {
                    speedMbps: 0,
                    latencyMs: endTime - startTime,
                    error: result.error || 'Transfer failed'
                };
            }

            // Calculate speed in Mbps
            const bytes = testFileSizeMB * 1024 * 1024;
            const bitsPerSecond = (bytes * 8) / transferTime;
            const mbps = bitsPerSecond / (1024 * 1024);

            return {
                speedMbps: Math.round(mbps * 100) / 100,
                latencyMs: endTime - startTime
            };

        } catch (error) {
            return {
                speedMbps: 0,
                latencyMs: 0,
                error: error instanceof Error ? error.message : 'Speed test failed'
            };
        }
    }

    /**
     * Ping a host to measure latency
     */
    static async pingHost(host: string, count: number = 4): Promise<{ avgLatencyMs: number; packetLoss: number; error?: string }> {
        try {
            const platform = os.platform();
            let command: string;
            
            if (platform === 'win32') {
                command = `ping -n ${count} ${host}`;
            } else {
                command = `ping -c ${count} ${host}`;
            }

            const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
            
            // Parse ping output
            const latencies: number[] = [];
            const timeRegex = /time[<=](\d+\.?\d*)ms/gi;
            let match;
            
            while ((match = timeRegex.exec(output)) !== null) {
                latencies.push(parseFloat(match[1]));
            }

            if (latencies.length === 0) {
                return {
                    avgLatencyMs: 0,
                    packetLoss: 100,
                    error: 'No ping responses received'
                };
            }

            const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
            const packetLoss = ((count - latencies.length) / count) * 100;

            return {
                avgLatencyMs: Math.round(avgLatency * 100) / 100,
                packetLoss: Math.round(packetLoss * 100) / 100
            };

        } catch (error) {
            return {
                avgLatencyMs: 0,
                packetLoss: 100,
                error: error instanceof Error ? error.message : 'Ping failed'
            };
        }
    }

    private static async createTestFile(sizeMB: number): Promise<string> {
        const tempDir = os.tmpdir();
        const testFileName = `speed-test-${Date.now()}.tmp`;
        const testFilePath = path.join(tempDir, testFileName);
        
        // Create a file with random data
        const sizeBytes = sizeMB * 1024 * 1024;
        const buffer = Buffer.alloc(Math.min(sizeBytes, 1024 * 1024)); // 1MB buffer
        
        // Fill with random data
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
        }

        const fileHandle = await fs.open(testFilePath, 'w');
        
        try {
            let written = 0;
            while (written < sizeBytes) {
                const toWrite = Math.min(buffer.length, sizeBytes - written);
                await fileHandle.write(buffer, 0, toWrite);
                written += toWrite;
            }
        } finally {
            await fileHandle.close();
        }

        return testFilePath;
    }
}