import { execSync, spawn } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { TransferProvider, TransferOptions, TransferResult, TransferTarget, FallbackCapabilities, TransferProgress } from '../interfaces.js';

/**
 * macOS Ditto transfer provider (preferred for macOS)
 */
export class DittoProvider extends TransferProvider {
    name = 'ditto';
    capabilities: FallbackCapabilities = {
        supportsCompression: true,
        supportsProgress: false,
        supportsResume: false,
        supportsDelete: false,
        supportsSymlinks: true,
        supportsPermissions: true,
        supportsTimestamps: true,
        supportsNetworkTransfer: false,
        supportsAuthentication: false,
        maxRetries: 0,
        preferredFor: ['macos-archive', 'preserve-metadata', 'app-bundles', 'resource-forks']
    };

    async isAvailable(): Promise<boolean> {
        try {
            execSync('which ditto', { timeout: 3000, stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    async getVersion(): Promise<string | null> {
        try {
            const output = execSync('ditto --help', { encoding: 'utf8', timeout: 3000 });
            // Ditto doesn't provide version info in help, but we can check if it exists
            return output.includes('ditto') ? 'built-in' : null;
        } catch {
            return null;
        }
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        // Handle network mounts if needed
        if (source.isRemote || destination.isRemote) {
            return this.prepareMountPoints(source, destination, options);
        }
        return true;
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions = {}): Promise<TransferResult> {
        const startTime = Date.now();
        
        try {
            const args = this.buildDittoArgs(source, destination, options);
            
            if (options.dryRun) {
                return {
                    success: true,
                    exitCode: 0,
                    output: `Would execute: ditto ${args.join(' ')}`,
                    duration: Date.now() - startTime,
                    method: 'ditto',
                    fallbackUsed: true
                };
            }

            const result = await this.executeDitto(args, options);
            
            return {
                success: result.exitCode === 0,
                exitCode: result.exitCode,
                output: result.output,
                error: result.exitCode === 0 ? undefined : result.error,
                filesTransferred: await this.countTransferredFiles(destination.path),
                duration: Date.now() - startTime,
                method: 'ditto',
                fallbackUsed: true
            };
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.code || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'ditto',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // Unmount network shares if they were mounted
        await this.cleanupMountPoints(source, destination);
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        return this.getDirectoryStats(source.path, options);
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

    private buildDittoArgs(source: TransferTarget, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // Ditto options
        if (options.verbose) {
            args.push('-V'); // Verbose output
        }
        
        if (options.preservePerms !== false) {
            args.push('--keepParent'); // Keep parent directory structure
        }
        
        // Compression (for archives)
        if (options.compress) {
            args.push('--compressionlevel', '6'); // Medium compression
        }
        
        // Exclude patterns using rsrc (resource fork) exclusion
        if (options.exclude && options.exclude.length > 0) {
            // Ditto has limited exclude support, mainly for resource forks
            if (options.exclude.includes('.DS_Store')) {
                args.push('--noextattr'); // Skip extended attributes
            }
        }
        
        // Source and destination
        args.push(source.path);
        args.push(destination.path);
        
        return args;
    }

    private async executeDitto(args: string[], options: TransferOptions): Promise<{ exitCode: number; output: string; error: string }> {
        return new Promise((resolve) => {
            let output = '';
            let error = '';
            
            const process = spawn('ditto', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            process.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                output += chunk;
                
                if (options.verbose) {
                    // Ditto doesn't provide progress, but we can emit file names
                    const lines = chunk.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        if (line.includes('/')) {
                            this.emitProgress({
                                bytesTransferred: 0,
                                totalBytes: 0,
                                filesTransferred: 0,
                                totalFiles: 0,
                                currentFile: line.trim(),
                                transferRate: '',
                                percentage: 0
                            });
                        }
                    }
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

    private async prepareMountPoints(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        // Handle SMB/AFP mounting for network transfers
        const targets = [source, destination].filter(t => t.isRemote);
        
        for (const target of targets) {
            if (target.protocol === 'smb' && target.host) {
                try {
                    const mountPoint = `/Volumes/${target.host}_${target.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    target.mountPoint = mountPoint;
                    
                    // Mount SMB share
                    const smbUrl = `smb://${target.host}${target.path}`;
                    execSync(`mkdir -p "${mountPoint}"`, { timeout: 5000 });
                    
                    let mountCmd = `mount -t smbfs "${smbUrl}" "${mountPoint}"`;
                    if (options.username && options.password) {
                        mountCmd = `mount -t smbfs "smb://${options.username}:${options.password}@${target.host}${target.path}" "${mountPoint}"`;
                    }
                    
                    execSync(mountCmd, { timeout: 15000 });
                    
                    // Update target path to use mount point
                    target.path = mountPoint;
                } catch (err) {
                    this.emitError(new Error(`Failed to mount ${target.host}: ${err}`));
                    return false;
                }
            }
        }
        
        return true;
    }

    private async cleanupMountPoints(source: TransferTarget, destination: TransferTarget): Promise<void> {
        const targets = [source, destination].filter(t => t.mountPoint);
        
        for (const target of targets) {
            try {
                execSync(`umount "${target.mountPoint}"`, { timeout: 10000, stdio: 'ignore' });
                execSync(`rmdir "${target.mountPoint}"`, { timeout: 5000, stdio: 'ignore' });
            } catch {
                // Ignore cleanup errors
            }
        }
    }

    private async countTransferredFiles(path: string): Promise<number> {
        try {
            const stats = statSync(path);
            if (stats.isFile()) {
                return 1;
            } else if (stats.isDirectory()) {
                return this.countFilesRecursive(path);
            }
        } catch {
            // Ignore errors
        }
        return 0;
    }

    private countFilesRecursive(dir: string): number {
        let count = 0;
        try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const stats = statSync(fullPath);
                if (stats.isFile()) {
                    count++;
                } else if (stats.isDirectory()) {
                    count += this.countFilesRecursive(fullPath);
                }
            }
        } catch {
            // Ignore errors
        }
        return count;
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
 * macOS/Unix CP (copy) provider - basic fallback
 */
export class CpProvider extends TransferProvider {
    name = 'cp';
    capabilities: FallbackCapabilities = {
        supportsCompression: false,
        supportsProgress: false,
        supportsResume: false,
        supportsDelete: false,
        supportsSymlinks: true,
        supportsPermissions: true,
        supportsTimestamps: true,
        supportsNetworkTransfer: false,
        supportsAuthentication: false,
        maxRetries: 0,
        preferredFor: ['simple-copy', 'basic-backup', 'unix-systems']
    };

    async isAvailable(): Promise<boolean> {
        try {
            execSync('which cp', { timeout: 3000, stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    async getVersion(): Promise<string | null> {
        try {
            const output = execSync('cp --version', { encoding: 'utf8', timeout: 3000 });
            const match = output.match(/cp \(GNU coreutils\) ([\d.]+)/);
            return match ? match[1] : 'built-in';
        } catch {
            return 'built-in';
        }
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        return true; // CP doesn't need special preparation for local transfers
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions = {}): Promise<TransferResult> {
        const startTime = Date.now();
        
        try {
            const args = this.buildCpArgs(source, destination, options);
            
            if (options.dryRun) {
                return {
                    success: true,
                    exitCode: 0,
                    output: `Would execute: cp ${args.join(' ')}`,
                    duration: Date.now() - startTime,
                    method: 'cp',
                    fallbackUsed: true
                };
            }

            const output = execSync(`cp ${args.join(' ')}`, { 
                encoding: 'utf8',
                timeout: options.timeout ? options.timeout * 1000 : 300000 // 5 minute default
            });
            
            return {
                success: true,
                exitCode: 0,
                output,
                filesTransferred: await this.countTransferredFiles(destination.path),
                duration: Date.now() - startTime,
                method: 'cp',
                fallbackUsed: true
            };
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.status || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'cp',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // CP doesn't need cleanup
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        const ditto = new DittoProvider();
        return ditto.estimateTransfer(source, options);
    }

    async validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{ valid: boolean; errors: string[] }> {
        const ditto = new DittoProvider();
        return ditto.validateTargets(source, destination);
    }

    private buildCpArgs(source: TransferTarget, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // CP options
        if (options.recursive !== false) {
            args.push('-R'); // Recursive copy
        }
        
        if (options.preservePerms !== false && options.preserveTimes !== false) {
            args.push('-p'); // Preserve mode, ownership, timestamps
        }
        
        if (options.preserveLinks !== false) {
            args.push('-P'); // Don't follow symbolic links
        }
        
        if (options.verbose) {
            args.push('-v'); // Verbose output
        }
        
        // Force overwrite
        args.push('-f');
        
        // Source and destination
        args.push(`"${source.path}"`);
        args.push(`"${destination.path}"`);
        
        return args;
    }

    private async countTransferredFiles(path: string): Promise<number> {
        try {
            const stats = statSync(path);
            if (stats.isFile()) {
                return 1;
            } else if (stats.isDirectory()) {
                return this.countFilesRecursive(path);
            }
        } catch {
            // Ignore errors
        }
        return 0;
    }

    private countFilesRecursive(dir: string): number {
        let count = 0;
        try {
            const entries = readdirSync(dir);
            for (const entry of entries) {
                const fullPath = join(dir, entry);
                const stats = statSync(fullPath);
                if (stats.isFile()) {
                    count++;
                } else if (stats.isDirectory()) {
                    count += this.countFilesRecursive(fullPath);
                }
            }
        } catch {
            // Ignore errors
        }
        return count;
    }
}
