import { execSync, spawn } from 'child_process';
import { existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { TransferProvider, TransferOptions, TransferResult, TransferTarget, FallbackCapabilities, TransferProgress } from '../interfaces.ts';

/**
 * Linux CP (copy) provider - versatile Unix copy command
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
        preferredFor: ['simple-copy', 'basic-backup', 'unix-systems', 'local-transfer']
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

            const result = await this.executeCp(args, options);
            
            return {
                success: result.exitCode === 0,
                exitCode: result.exitCode,
                output: result.output,
                error: result.exitCode === 0 ? undefined : result.error,
                filesTransferred: await this.countTransferredFiles(destination.path),
                duration: Date.now() - startTime,
                method: 'cp',
                fallbackUsed: true
            };
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.code || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'cp',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // CP doesn't need cleanup for local transfers
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

    private buildCpArgs(source: TransferTarget, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // CP options
        if (options.recursive !== false) {
            args.push('-R'); // Recursive copy
        }
        
        if (options.archive !== false) {
            args.push('-a'); // Archive mode (preserve everything)
        } else {
            if (options.preservePerms !== false) {
                args.push('--preserve=mode');
            }
            if (options.preserveTimes !== false) {
                args.push('--preserve=timestamps');
            }
            if (options.preserveLinks !== false) {
                args.push('--preserve=links');
            }
        }
        
        if (options.verbose) {
            args.push('-v'); // Verbose output
        }
        
        // Update mode - only copy newer files
        args.push('-u');
        
        // Force overwrite
        args.push('-f');
        
        // Source and destination
        args.push(`"${source.path}"`);
        args.push(`"${destination.path}"`);
        
        return args;
    }

    private async executeCp(args: string[], options: TransferOptions): Promise<{ exitCode: number; output: string; error: string }> {
        return new Promise((resolve) => {
            let output = '';
            let error = '';
            
            const process = spawn('cp', args, {
                shell: true,
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            process.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                output += chunk;
                
                if (options.verbose) {
                    // Emit progress for each file copied
                    const lines = chunk.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        if (line.includes('->') || line.includes('/')) {
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
 * Linux TAR provider - for compressed transfers and archives
 */
export class TarProvider extends TransferProvider {
    name = 'tar';
    capabilities: FallbackCapabilities = {
        supportsCompression: true,
        supportsProgress: true,
        supportsResume: false,
        supportsDelete: false,
        supportsSymlinks: true,
        supportsPermissions: true,
        supportsTimestamps: true,
        supportsNetworkTransfer: false,
        supportsAuthentication: false,
        maxRetries: 0,
        preferredFor: ['compressed-transfer', 'archive-creation', 'preserve-permissions', 'sparse-files']
    };

    async isAvailable(): Promise<boolean> {
        try {
            execSync('which tar', { timeout: 3000, stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    async getVersion(): Promise<string | null> {
        try {
            const output = execSync('tar --version', { encoding: 'utf8', timeout: 3000 });
            const match = output.match(/tar \(GNU tar\) ([\d.]+)/);
            return match ? match[1] : 'built-in';
        } catch {
            return 'built-in';
        }
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        return true;
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions = {}): Promise<TransferResult> {
        const startTime = Date.now();
        
        try {
            // TAR works differently - we create an archive and then extract it
            const archivePath = `${destination.path}.tar${options.compress ? '.gz' : ''}`;
            
            if (options.dryRun) {
                return {
                    success: true,
                    exitCode: 0,
                    output: `Would create archive: ${archivePath} from ${source.path}`,
                    duration: Date.now() - startTime,
                    method: 'tar',
                    fallbackUsed: true
                };
            }

            // Create archive
            const createArgs = this.buildTarCreateArgs(source, archivePath, options);
            const createResult = await this.executeTar(createArgs, options);
            
            if (createResult.exitCode !== 0) {
                return {
                    success: false,
                    exitCode: createResult.exitCode,
                    output: createResult.output,
                    error: createResult.error,
                    duration: Date.now() - startTime,
                    method: 'tar',
                    fallbackUsed: true
                };
            }

            // Extract archive if destination is a directory
            const stats = statSync(destination.path);
            if (stats.isDirectory()) {
                const extractArgs = this.buildTarExtractArgs(archivePath, destination, options);
                const extractResult = await this.executeTar(extractArgs, options);
                
                // Clean up temporary archive
                try {
                    execSync(`rm "${archivePath}"`, { timeout: 5000, stdio: 'ignore' });
                } catch {
                    // Ignore cleanup errors
                }
                
                return {
                    success: extractResult.exitCode === 0,
                    exitCode: extractResult.exitCode,
                    output: createResult.output + '\n' + extractResult.output,
                    error: extractResult.exitCode === 0 ? undefined : extractResult.error,
                    filesTransferred: await this.countTransferredFiles(destination.path),
                    duration: Date.now() - startTime,
                    method: 'tar',
                    fallbackUsed: true
                };
            } else {
                // Just created archive
                return {
                    success: true,
                    exitCode: 0,
                    output: createResult.output,
                    filesTransferred: 1,
                    duration: Date.now() - startTime,
                    method: 'tar',
                    fallbackUsed: true
                };
            }
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.code || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'tar',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // TAR doesn't need special cleanup
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        const cp = new CpProvider();
        return cp.estimateTransfer(source, options);
    }

    async validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{ valid: boolean; errors: string[] }> {
        const cp = new CpProvider();
        return cp.validateTargets(source, destination);
    }

    private buildTarCreateArgs(source: TransferTarget, archivePath: string, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // Create mode
        if (options.compress) {
            args.push('-czf'); // Create, gzip, file
        } else {
            args.push('-cf'); // Create, file
        }
        
        // Archive path
        args.push(archivePath);
        
        // Preserve permissions and timestamps
        if (options.preservePerms !== false) {
            args.push('--preserve-permissions');
        }
        
        if (options.verbose) {
            args.push('-v'); // Verbose
        }
        
        // Progress (GNU tar)
        if (options.progress) {
            args.push('--checkpoint=100');
            args.push('--checkpoint-action=dot');
        }
        
        // Exclude patterns
        if (options.exclude && options.exclude.length > 0) {
            options.exclude.forEach(pattern => {
                args.push('--exclude', pattern);
            });
        }
        
        // Source directory/file
        args.push('-C', dirname(source.path)); // Change to source directory
        args.push(source.path.split('/').pop() || '.'); // Add relative path
        
        return args;
    }

    private buildTarExtractArgs(archivePath: string, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // Extract mode
        if (archivePath.endsWith('.gz')) {
            args.push('-xzf'); // Extract, gunzip, file
        } else {
            args.push('-xf'); // Extract, file
        }
        
        // Archive path
        args.push(archivePath);
        
        // Extract to destination
        args.push('-C', destination.path);
        
        if (options.verbose) {
            args.push('-v'); // Verbose
        }
        
        return args;
    }

    private async executeTar(args: string[], options: TransferOptions): Promise<{ exitCode: number; output: string; error: string }> {
        return new Promise((resolve) => {
            let output = '';
            let error = '';
            
            const process = spawn('tar', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            process.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                output += chunk;
                
                if (options.progress || options.verbose) {
                    // Emit progress for each file
                    const lines = chunk.split('\n').filter(line => line.trim());
                    for (const line of lines) {
                        if (line && !line.startsWith('.')) {
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

/**
 * Linux SCP provider - for secure network transfers
 */
export class ScpProvider extends TransferProvider {
    name = 'scp';
    capabilities: FallbackCapabilities = {
        supportsCompression: true,
        supportsProgress: true,
        supportsResume: false,
        supportsDelete: false,
        supportsSymlinks: false,
        supportsPermissions: true,
        supportsTimestamps: true,
        supportsNetworkTransfer: true,
        supportsAuthentication: true,
        maxRetries: 3,
        preferredFor: ['secure-network-transfer', 'ssh-based', 'remote-copy']
    };

    async isAvailable(): Promise<boolean> {
        try {
            execSync('which scp', { timeout: 3000, stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    async getVersion(): Promise<string | null> {
        try {
            const output = execSync('scp -V', { encoding: 'utf8', timeout: 3000 });
            const match = output.match(/OpenSSH_([\d.]+)/);
            return match ? match[1] : 'built-in';
        } catch {
            return 'built-in';
        }
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        // Test SSH connectivity for remote targets
        const remoteTargets = [source, destination].filter(t => t.isRemote);
        
        for (const target of remoteTargets) {
            if (target.host) {
                try {
                    let sshCmd = `ssh -o ConnectTimeout=10 -o BatchMode=yes`;
                    
                    if (options.keyFile) {
                        sshCmd += ` -i "${options.keyFile}"`;
                    }
                    
                    if (target.port) {
                        sshCmd += ` -p ${target.port}`;
                    }
                    
                    const userHost = target.user ? `${target.user}@${target.host}` : target.host;
                    sshCmd += ` ${userHost} "echo 'connection test'"`;
                    
                    execSync(sshCmd, { timeout: 15000, stdio: 'ignore' });
                } catch (err) {
                    this.emitError(new Error(`Failed to connect to ${target.host}: ${err}`));
                    return false;
                }
            }
        }
        
        return true;
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions = {}): Promise<TransferResult> {
        const startTime = Date.now();
        
        try {
            const args = this.buildScpArgs(source, destination, options);
            
            if (options.dryRun) {
                return {
                    success: true,
                    exitCode: 0,
                    output: `Would execute: scp ${args.join(' ')}`,
                    duration: Date.now() - startTime,
                    method: 'scp',
                    fallbackUsed: true
                };
            }

            const result = await this.executeScp(args, options);
            
            return {
                success: result.exitCode === 0,
                exitCode: result.exitCode,
                output: result.output,
                error: result.exitCode === 0 ? undefined : result.error,
                filesTransferred: this.parseScpOutput(result.output),
                duration: Date.now() - startTime,
                method: 'scp',
                fallbackUsed: true
            };
        } catch (err: any) {
            return {
                success: false,
                exitCode: err.code || -1,
                output: '',
                error: err.message,
                duration: Date.now() - startTime,
                method: 'scp',
                fallbackUsed: true
            };
        }
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // SCP doesn't need cleanup
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        // For remote sources, estimation is limited
        if (source.isRemote) {
            return { totalBytes: 0, totalFiles: 0 };
        }
        
        const cp = new CpProvider();
        return cp.estimateTransfer(source, options);
    }

    async validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{ valid: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        // Check that at least one target is remote for SCP
        if (!source.isRemote && !destination.isRemote) {
            errors.push('SCP requires at least one remote target');
        }
        
        // Check remote targets have hosts
        [source, destination].filter(t => t.isRemote).forEach(target => {
            if (!target.host) {
                errors.push(`Remote target missing host: ${target.path}`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    private buildScpArgs(source: TransferTarget, destination: TransferTarget, options: TransferOptions): string[] {
        const args: string[] = [];
        
        // SCP options
        if (options.recursive !== false) {
            args.push('-r'); // Recursive
        }
        
        if (options.preserveTimes !== false) {
            args.push('-p'); // Preserve times
        }
        
        if (options.compress) {
            args.push('-C'); // Compression
        }
        
        if (options.verbose) {
            args.push('-v'); // Verbose
        }
        
        // Progress (if available)
        args.push('-q'); // Quiet mode (we'll handle progress ourselves)
        
        // SSH options
        if (options.keyFile) {
            args.push('-i', options.keyFile);
        }
        
        if (source.port || destination.port) {
            const port = source.port || destination.port || 22;
            args.push('-P', port.toString());
        }
        
        if (options.timeout) {
            args.push('-o', `ConnectTimeout=${options.timeout}`);
        }
        
        // Build source path
        const sourcePath = source.isRemote 
            ? `${source.user ? `${source.user}@` : ''}${source.host}:${source.path}`
            : source.path;
        
        // Build destination path
        const destPath = destination.isRemote
            ? `${destination.user ? `${destination.user}@` : ''}${destination.host}:${destination.path}`
            : destination.path;
        
        args.push(sourcePath);
        args.push(destPath);
        
        return args;
    }

    private async executeScp(args: string[], options: TransferOptions): Promise<{ exitCode: number; output: string; error: string }> {
        return new Promise((resolve) => {
            let output = '';
            let error = '';
            
            const process = spawn('scp', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            process.stdout?.on('data', (data: Buffer) => {
                const chunk = data.toString();
                output += chunk;
                
                if (options.verbose) {
                    this.emitProgress({
                        bytesTransferred: 0,
                        totalBytes: 0,
                        filesTransferred: 0,
                        totalFiles: 0,
                        currentFile: chunk.trim(),
                        transferRate: '',
                        percentage: 0
                    });
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

    private parseScpOutput(output: string): number {
        // SCP doesn't provide detailed transfer statistics
        // We can count files mentioned in verbose output
        if (!output) return 0;
        
        const lines = output.split('\n').filter(line => line.trim());
        return lines.length;
    }
}
