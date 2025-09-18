import { execSync, spawn } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { TransferProvider, TransferOptions, TransferResult, TransferTarget, FallbackCapabilities, TransferProgress } from '../interfaces.ts';

/**
 * Windows Robocopy transfer provider
 */
export class RobocopyProvider extends TransferProvider {
    name = 'robocopy';
    capabilities: FallbackCapabilities = {
        supportsCompression: false,
        supportsProgress: true,
        supportsResume: true,
        supportsDelete: true,
        supportsSymlinks: true,
        supportsPermissions: true,
        supportsTimestamps: true,
        supportsNetworkTransfer: true,
        supportsAuthentication: true,
        maxRetries: 10,
        preferredFor: ['windows-local', 'windows-network', 'large-files', 'resume-transfers']
    };

    async isAvailable(): Promise<boolean> {
        try {
            execSync('robocopy /? >nul 2>&1', { timeout: 3000 });
            return true;
        } catch {
            return false;
        }
    }

    async getVersion(): Promise<string | null> {
        try {
            const output = execSync('robocopy /?', { encoding: 'utf8', timeout: 3000 });
            const match = output.match(/ROBOCOPY\s+::\s+Robust File Copy for Windows\s+([\d.]+)/i);
            return match ? match[1] : null;
        } catch {
            return null;
        }
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        // For network paths, try to authenticate if credentials provided
        if (destination.isRemote && options.username && options.password) {
            try {
                const uncPath = this.buildUncPath(destination);
                execSync(`net use "${uncPath}" "${options.password}" /user:"${options.username}"`, { 
                    timeout: 10000,
                    stdio: 'ignore'
                });
            } catch (error) {
                this.emitError(new Error(`Failed to authenticate to ${destination.host}: ${error}`));
                return false;
            }
        }
        
        return true;
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions = {}): Promise<TransferResult> {
        const startTime = Date.now();
        
        try {
            const args = this.buildRobocopyArgs(source, destination, options);
            
            if (options.dryRun) {
                const output = `Would execute: robocopy ${args.join(' ')}`;
                return {
                    success: true,
                    exitCode: 0,
                    output,
                    duration: Date.now() - startTime,
                    method: 'robocopy',
                    fallbackUsed: true
                };
            }
            
            // Execute robocopy command using existing method
            const result = await this.executeRobocopy(args, options);
            
            // Robocopy exit codes: 0-7 are success, 8+ are errors
            const success = result.exitCode < 8;
            
            return {
                success,
                exitCode: result.exitCode,
                output: result.output,
                error: success ? undefined : result.error,
                bytesTransferred: this.parseRobocopyStats(result.output).bytesTransferred,
                filesTransferred: this.parseRobocopyStats(result.output).filesTransferred,
                duration: Date.now() - startTime,
                transferRate: this.calculateTransferRate(this.parseRobocopyStats(result.output).bytesTransferred, Date.now() - startTime),
                method: 'robocopy',
                fallbackUsed: true
            };
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.code || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'robocopy',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // Disconnect network drives if they were connected
        if (destination.isRemote) {
            try {
                const uncPath = this.buildUncPath(destination);
                execSync(`net use "${uncPath}" /delete /y`, { 
                    timeout: 5000,
                    stdio: 'ignore'
                });
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        try {
            const stats = this.getDirectoryStats(source.path, options);
            return stats;
        } catch {
            return { totalBytes: 0, totalFiles: 0 };
        }
    }

    async validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        // Check source exists
        if (!source.isRemote && !existsSync(source.path)) {
            errors.push(`Source path does not exist: ${source.path}`);
        }
        
        // Check destination directory can be created
        if (!destination.isRemote) {
            try {
                const destDir = dirname(destination.path);
                if (!existsSync(destDir)) {
                    errors.push(`Destination directory does not exist: ${destDir}`);
                }
            } catch (err: any) {
                errors.push(`Cannot access destination: ${err.message}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    private buildRobocopyArgs(source: TransferTarget, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // Source and destination
        const sourcePath = source.isRemote ? this.buildUncPath(source) : source.path;
        const destPath = destination.isRemote ? this.buildUncPath(destination) : destination.path;
        
        args.push(`"${sourcePath}"`);
        args.push(`"${destPath}"`);
        
        // File selection (default to all files)
        args.push('*.*');
        
        // Robocopy options
        if (options.recursive !== false) {
            args.push('/E'); // Copy subdirectories including empty ones
        }
        
        if (options.archive !== false) {
            args.push('/COPYALL'); // Copy all file info (equivalent to /COPY:DATSOU)
        }
        
        if (options.preserveTimes !== false) {
            args.push('/DCOPY:DAT'); // Copy directory timestamps
        }
        
        if (options.delete) {
            args.push('/PURGE'); // Delete files that no longer exist in source
        }
        
        if (options.retries) {
            args.push('/R:', options.retries.toString());
        }
        
        if (options.timeout) {
            args.push('/W:', options.timeout.toString());
        }
        
        // Progress and logging
        if (options.progress) {
            args.push('/TEE'); // Output to console and log file
        }
        
        if (options.verbose) {
            args.push('/V'); // Verbose output
        } else {
            args.push('/NP'); // No progress - don't display percentage
        }
        
        // Exclude patterns
        if (options.exclude && options.exclude.length > 0) {
            options.exclude.forEach(pattern => {
                args.push('/XF', pattern); // Exclude files
            });
        }
        
        // Bandwidth limiting (KB/s to bytes/s)
        if (options.bandwidth) {
            const bytesPerSec = options.bandwidth * 1024;
            args.push('/IPG:', Math.ceil(bytesPerSec / 1000).toString()); // Inter-packet gap
        }
        
        // Custom arguments
        if (options.customArgs) {
            args.push(...options.customArgs);
        }
        
        return args;
    }

    private async executeRobocopy(args: string[], options: TransferOptions): Promise<{ exitCode: number; output: string; error: string }> {
        return new Promise((resolve) => {
            let output = '';
            let error = '';
            
            const process = spawn('robocopy', args, {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            process.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                output += chunk;
                
                if (options.progress) {
                    this.parseAndEmitProgress(chunk);
                }
            });
            
            process.stderr?.on('data', (data: Buffer) => {
                error += data.toString();
            });
            
            process.on('close', (code) => {
                resolve({
                    exitCode: code || 0,
                    output,
                    error
                });
            });
        });
    }

    private parseAndEmitProgress(chunk: string): void {
        // Parse robocopy output for progress information
        const lines = chunk.split('\n');
        
        for (const line of lines) {
            // Look for progress lines like "  10.5%    New File   1234567   filename.txt"
            const progressMatch = line.match(/\s*([\d.]+)%/);
            if (progressMatch) {
                const percentage = parseFloat(progressMatch[1]);
                
                // Extract file information if available
                const fileMatch = line.match(/\s+\d+\s+(.+)$/);
                const currentFile = fileMatch ? fileMatch[1].trim() : '';
                
                this.emitProgress({
                    bytesTransferred: 0, // Robocopy doesn't provide this in real-time
                    totalBytes: 0,
                    filesTransferred: 0,
                    totalFiles: 0,
                    currentFile,
                    transferRate: '',
                    percentage
                });
            }
        }
    }

    private parseRobocopyStats(output: string): { bytesTransferred: number; filesTransferred: number } {
        let bytesTransferred = 0;
        let filesTransferred = 0;
        
        // Parse robocopy summary statistics
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Look for summary lines like "   Files :     1234    1234         0         0         0         0"
            const filesMatch = line.match(/\s*Files\s*:\s*(\d+)\s+(\d+)/);
            if (filesMatch) {
                filesTransferred = parseInt(filesMatch[2], 10);
            }
            
            // Look for bytes lines like "   Bytes :   1.234 m   1.234 m         0         0         0         0"
            const bytesMatch = line.match(/\s*Bytes\s*:\s*([\d.]+)\s*([kmgt]?)\s*([\d.]+)\s*([kmgt]?)/i);
            if (bytesMatch) {
                const value = parseFloat(bytesMatch[3]);
                const unit = bytesMatch[4].toLowerCase();
                bytesTransferred = this.convertToBytes(value, unit);
            }
        }
        
        return { bytesTransferred, filesTransferred };
    }

    private convertToBytes(value: number, unit: string): number {
        switch (unit) {
            case 'k': return value * 1024;
            case 'm': return value * 1024 * 1024;
            case 'g': return value * 1024 * 1024 * 1024;
            case 't': return value * 1024 * 1024 * 1024 * 1024;
            default: return value;
        }
    }

    private calculateTransferRate(bytes: number, milliseconds: number): string {
        if (bytes === 0 || milliseconds === 0) return '0 B/s';
        
        const bytesPerSecond = (bytes / milliseconds) * 1000;
        
        if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(1)} B/s`;
        if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        if (bytesPerSecond < 1024 * 1024 * 1024) return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
        return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(1)} GB/s`;
    }

    private buildUncPath(target: TransferTarget): string {
        if (!target.host) {
            throw new Error('Host required for network transfer');
        }
        
        // Convert path to UNC format
        let uncPath = target.path;
        if (!uncPath.startsWith('\\\\')) {
            // Convert Unix-style path to UNC
            if (uncPath.startsWith('/')) {
                uncPath = uncPath.replace(/\//g, '\\');
            }
            uncPath = `\\\\${target.host}${uncPath}`;
        }
        
        return uncPath;
    }

    private getDirectoryStats(path: string, options: TransferOptions): { totalBytes: number; totalFiles: number } {
        let totalBytes = 0;
        let totalFiles = 0;
        
        const processPath = (currentPath: string) => {
            try {
                const stats = statSync(currentPath);
                
                if (stats.isFile()) {
                    totalFiles++;
                    totalBytes += stats.size;
                } else if (stats.isDirectory() && options.recursive !== false) {
                    const entries = readdirSync(currentPath);
                    
                    for (const entry of entries) {
                        // Apply exclude patterns
                        if (options.exclude && options.exclude.some(pattern => {
                            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                            return regex.test(entry);
                        })) {
                            continue;
                        }
                        
                        processPath(join(currentPath, entry));
                    }
                }
            } catch {
                // Ignore files/directories we can't access
            }
        };
        
        processPath(path);
        return { totalBytes, totalFiles };
    }
}

/**
 * Windows XCopy fallback provider
 */
export class XCopyProvider extends TransferProvider {
    name = 'xcopy';
    capabilities: FallbackCapabilities = {
        supportsCompression: false,
        supportsProgress: false,
        supportsResume: false,
        supportsDelete: false,
        supportsSymlinks: false,
        supportsPermissions: false,
        supportsTimestamps: true,
        supportsNetworkTransfer: true,
        supportsAuthentication: false,
        maxRetries: 0,
        preferredFor: ['simple-copy', 'basic-backup']
    };

    async isAvailable(): Promise<boolean> {
        try {
            execSync('xcopy /? >nul 2>&1', { timeout: 3000 });
            return true;
        } catch {
            return false;
        }
    }

    async getVersion(): Promise<string | null> {
        // XCopy doesn't have a clear version command
        return 'built-in';
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        return true; // XCopy doesn't need special preparation
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions = {}): Promise<TransferResult> {
        const startTime = Date.now();
        
        try {
            const args = this.buildXCopyArgs(source, destination, options);
            
            if (options.dryRun) {
                return {
                    success: true,
                    exitCode: 0,
                    output: `Would execute: xcopy ${args.join(' ')}`,
                    duration: Date.now() - startTime,
                    method: 'xcopy',
                    fallbackUsed: true
                };
            }
            
            // Execute xcopy command using existing sync approach
            const output = execSync(`xcopy ${args.join(' ')}`, { 
                encoding: 'utf8',
                timeout: (options.timeout || 300) * 1000 // 5 minute default
            });
            
            const filesTransferred = this.parseXCopyOutput(output);
            
            return {
                success: true,
                exitCode: 0,
                output,
                filesTransferred,
                duration: Date.now() - startTime,
                method: 'xcopy',
                fallbackUsed: true
            };
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.status || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'xcopy',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // XCopy doesn't need cleanup
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        // Use same logic as RobocopyProvider for directory stats
        const robocopy = new RobocopyProvider();
        return robocopy.estimateTransfer(source, options);
    }

    async validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{ valid: boolean; errors: string[] }> {
        // Use same logic as RobocopyProvider for validation
        const robocopy = new RobocopyProvider();
        return robocopy.validateTargets(source, destination);
    }

    private buildXCopyArgs(source: TransferTarget, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        args.push(`"${source.path}"`);
        args.push(`"${destination.path}"`);
        
        // XCopy options
        if (options.recursive !== false) {
            args.push('/E'); // Copy directories and subdirectories, including empty ones
        }
        
        if (options.archive !== false || options.preserveTimes !== false) {
            args.push('/K'); // Copy attributes
        }
        
        args.push('/I'); // Assume destination is a directory if copying multiple files
        args.push('/Y'); // Suppress prompting to confirm overwrite
        
        if (options.verbose) {
            args.push('/F'); // Display full source and destination file names
        }
        
        if (options.exclude && options.exclude.length > 0) {
            // XCopy has limited exclude support via /EXCLUDE:file
            // For simplicity, we'll skip exclude patterns for XCopy
        }
        
        return args;
    }

    private parseXCopyOutput(output: string): number {
        // Look for "X File(s) copied" in the output
        const match = output.match(/(\d+)\s+File\(s\)\s+copied/i);
        return match ? parseInt(match[1], 10) : 0;
    }
}
