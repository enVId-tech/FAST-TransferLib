import { RsyncCompatibilityChecker } from './rsyncChecker.js';
import type { RsyncCompatibilityResult } from './rsyncChecker.js';
import { execSync, spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface RsyncOptions {
    archive?: boolean;          // -a (archive mode)
    verbose?: boolean;          // -v (verbose)
    compress?: boolean;         // -z (compress)
    delete?: boolean;           // --delete
    dryRun?: boolean;          // --dry-run
    exclude?: string[];         // --exclude patterns
    include?: string[];         // --include patterns
    progress?: boolean;         // --progress
    recursive?: boolean;        // -r (recursive)
    preserveLinks?: boolean;    // -l (preserve symlinks)
    preservePerms?: boolean;    // -p (preserve permissions)
    preserveTimes?: boolean;    // -t (preserve times)
    checksum?: boolean;         // -c (checksum)
    customArgs?: string[];      // Additional custom arguments
    // Remote transfer options
    sshKey?: string;           // SSH private key file path
    sshPort?: number;          // SSH port (default 22)
    sshUser?: string;          // SSH username
    sshOptions?: string[];     // Additional SSH options
    bandwidth?: number;        // Bandwidth limit in KB/s
    timeout?: number;          // Connection timeout in seconds
}

export interface RsyncTransferResult {
    success: boolean;
    exitCode: number;
    output: string;
    error?: string;
    bytesTransferred?: number;
    filesTransferred?: number;
    duration?: number;
    sourceSize?: number;
    transferRate?: string;
}

export interface TransferTarget {
    path: string;
    host?: string;             // Remote hostname or IP
    user?: string;             // Remote username
    port?: number;             // SSH port
    isRemote: boolean;
}

export interface FileInfo {
    path: string;
    size: number;
    isDirectory: boolean;
    permissions?: string;
    lastModified?: Date;
}

/**
 * Enhanced RsyncManager with compatibility checking and comprehensive transfer capabilities
 */
class RsyncManager extends EventEmitter {
    private compatibilityResult: RsyncCompatibilityResult | null = null;
    private isInitialized = false;

    constructor() {
        super();
    }

    /**
     * Initialize the RsyncManager by checking compatibility
     */
    async initialize(): Promise<boolean> {
        try {
            this.compatibilityResult = await RsyncCompatibilityChecker.checkCompatibility();
            this.isInitialized = true;
            
            if (!this.compatibilityResult.isAvailable) {
                this.emit('error', new Error(`Rsync not available: ${this.compatibilityResult.errorMessage}`));
                return false;
            }
            
            this.emit('ready', this.compatibilityResult);
            return true;
        } catch (error) {
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Check if rsync is available and ready to use
     */
    isReady(): boolean {
        return this.isInitialized && this.compatibilityResult?.isAvailable === true;
    }

    /**
     * Get compatibility information
     */
    getCompatibilityInfo(): RsyncCompatibilityResult | null {
        return this.compatibilityResult;
    }

    /**
     * Build rsync command from options
     */
    private buildCommand(source: string, destination: string, options: RsyncOptions = {}): string[] {
        const args: string[] = [];
        
        // Add command prefix if needed (e.g., 'wsl' for WSL rsync)
        if (this.compatibilityResult?.commandPrefix) {
            args.push(this.compatibilityResult.commandPrefix);
        }
        
        args.push('rsync');

        // Archive mode (includes -rlptgoD)
        if (options.archive !== false) {
            args.push('-a');
        } else {
            // Individual flags if not using archive mode
            if (options.recursive !== false) args.push('-r');
            if (options.preserveLinks !== false) args.push('-l');
            if (options.preservePerms !== false) args.push('-p');
            if (options.preserveTimes !== false) args.push('-t');
        }

        // Common options
        if (options.verbose) args.push('-v');
        if (options.compress) args.push('-z');
        if (options.progress) args.push('--progress');
        if (options.delete) args.push('--delete');
        if (options.dryRun) args.push('--dry-run');
        if (options.checksum) args.push('-c');

        // Bandwidth limiting
        if (options.bandwidth) {
            args.push('--bwlimit', options.bandwidth.toString());
        }

        // Exclude patterns
        if (options.exclude) {
            options.exclude.forEach(pattern => {
                args.push('--exclude', pattern);
            });
        }

        // Include patterns
        if (options.include) {
            options.include.forEach(pattern => {
                args.push('--include', pattern);
            });
        }

        // Custom arguments (including SSH options)
        if (options.customArgs) {
            args.push(...options.customArgs);
        }

        // Source and destination
        args.push(source, destination);

        return args;
    }

    /**
     * Synchronize files from source to destination
     */
    async sync(source: string, destination: string, options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        if (!this.isReady()) {
            throw new Error('RsyncManager not initialized or rsync not available');
        }

        const startTime = Date.now();
        const command = this.buildCommand(source, destination, options);

        return new Promise((resolve) => {
            const process = spawn(command[0], command.slice(1), {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            process.stdout?.on('data', (data) => {
                const chunk = data.toString();
                output += chunk;
                this.emit('progress', chunk);
            });

            process.stderr?.on('data', (data) => {
                const chunk = data.toString();
                errorOutput += chunk;
                this.emit('error-output', chunk);
            });

            process.on('close', (exitCode) => {
                const duration = Date.now() - startTime;
                const success = exitCode === 0;

                // Parse output for transfer statistics
                let bytesTransferred: number | undefined;
                let filesTransferred: number | undefined;

                const transferMatch = output.match(/sent ([\d,]+) bytes\s+received ([\d,]+) bytes/);
                if (transferMatch) {
                    bytesTransferred = parseInt(transferMatch[1].replace(/,/g, '')) + 
                                     parseInt(transferMatch[2].replace(/,/g, ''));
                }

                const filesMatch = output.match(/Number of files transferred: (\d+)/);
                if (filesMatch) {
                    filesTransferred = parseInt(filesMatch[1]);
                }

                const result: RsyncTransferResult = {
                    success,
                    exitCode: exitCode || 0,
                    output,
                    error: errorOutput || undefined,
                    bytesTransferred,
                    filesTransferred,
                    duration
                };

                this.emit('complete', result);
                resolve(result);
            });

            process.on('error', (error) => {
                const result: RsyncTransferResult = {
                    success: false,
                    exitCode: -1,
                    output,
                    error: error.message,
                    duration: Date.now() - startTime
                };
                
                this.emit('error', error);
                resolve(result);
            });
        });
    }

    /**
     * Perform a dry run to see what would be transferred
     */
    async dryRun(source: string, destination: string, options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        return this.sync(source, destination, { ...options, dryRun: true, verbose: true });
    }

    /**
     * Transfer a file or folder to any location (local or remote)
     */
    async transfer(source: string, destination: TransferTarget | string, options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        if (!this.isReady()) {
            throw new Error('RsyncManager not initialized or rsync not available');
        }

        // Parse destination
        const dest = typeof destination === 'string' 
            ? this.parseDestination(destination)
            : destination;

        // Build source and destination strings
        const sourceStr = source;
        const destStr = this.buildDestinationString(dest, options);

        // Add remote-specific options
        const transferOptions = { ...options };
        if (dest.isRemote) {
            transferOptions.compress = transferOptions.compress !== false; // Default to compression for remote
            
            // Add SSH options if specified
            if (options.sshKey || options.sshPort || options.sshOptions) {
                transferOptions.customArgs = [
                    ...(transferOptions.customArgs || []),
                    ...this.buildSSHArgs(options)
                ];
            }
        }

        return this.sync(sourceStr, destStr, transferOptions);
    }

    /**
     * Transfer a file to a remote system
     */
    async transferToRemote(source: string, remoteHost: string, remotePath: string, 
                          user?: string, options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        const destination: TransferTarget = {
            path: remotePath,
            host: remoteHost,
            user: user,
            port: options.sshPort,
            isRemote: true
        };

        return this.transfer(source, destination, options);
    }

    /**
     * Transfer a file from a remote system
     */
    async transferFromRemote(remoteHost: string, remotePath: string, localDestination: string,
                            user?: string, options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        const source: TransferTarget = {
            path: remotePath,
            host: remoteHost,
            user: user,
            port: options.sshPort,
            isRemote: true
        };

        const sourceStr = this.buildDestinationString(source, options);
        return this.sync(sourceStr, localDestination, options);
    }

    /**
     * Copy a folder recursively (local or remote)
     */
    async copyFolder(source: string, destination: TransferTarget | string, 
                    options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        const folderOptions = {
            ...options,
            recursive: true,
            archive: options.archive !== false // Default to archive mode for folders
        };

        return this.transfer(source, destination, folderOptions);
    }

    /**
     * Mirror a directory (sync with deletion of extra files)
     */
    async mirrorDirectory(source: string, destination: TransferTarget | string,
                         options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        const mirrorOptions = {
            ...options,
            recursive: true,
            archive: options.archive !== false,
            delete: true
        };

        return this.transfer(source, destination, mirrorOptions);
    }

    /**
     * Backup files with timestamped destination
     */
    async backup(source: string, backupRoot: string, options: RsyncOptions = {}): Promise<RsyncTransferResult> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const backupPath = `${backupRoot}/backup-${timestamp}`;
        
        const backupOptions = {
            ...options,
            recursive: true,
            archive: true,
            compress: true
        };

        return this.transfer(source, backupPath, backupOptions);
    }

    /**
     * Get information about files that would be transferred
     */
    async getTransferInfo(source: string, destination: TransferTarget | string,
                         options: RsyncOptions = {}): Promise<FileInfo[]> {
        const dryRunResult = await this.transfer(source, destination, {
            ...options,
            dryRun: true,
            verbose: true
        });

        return this.parseTransferInfo(dryRunResult.output);
    }

    /**
     * Test connection to remote host
     */
    async testRemoteConnection(host: string, user?: string, options: RsyncOptions = {}): Promise<boolean> {
        try {
            const testTarget: TransferTarget = {
                path: '.',
                host,
                user,
                port: options.sshPort,
                isRemote: true
            };

            const result = await this.transfer('.', testTarget, {
                ...options,
                dryRun: true,
                timeout: 10
            });

            return result.success;
        } catch {
            return false;
        }
    }

    // Helper methods

    /**
     * Parse destination string into TransferTarget
     */
    private parseDestination(destination: string): TransferTarget {
        // Check if it's a remote destination (user@host:path or host:path)
        const remoteMatch = destination.match(/^(?:([^@]+)@)?([^:]+):(.+)$/);
        
        if (remoteMatch) {
            const [, user, host, path] = remoteMatch;
            return {
                path,
                host,
                user,
                isRemote: true
            };
        }

        // Local destination
        return {
            path: destination,
            isRemote: false
        };
    }

    /**
     * Build destination string for rsync command
     */
    private buildDestinationString(target: TransferTarget, options: RsyncOptions = {}): string {
        if (!target.isRemote) {
            return target.path;
        }

        const user = target.user || options.sshUser || '';
        const userPrefix = user ? `${user}@` : '';
        const port = target.port || options.sshPort;
        
        if (port && port !== 22) {
            // For non-standard ports, we need to use SSH options
            return `${userPrefix}${target.host}:${target.path}`;
        }

        return `${userPrefix}${target.host}:${target.path}`;
    }

    /**
     * Build SSH arguments for remote transfers
     */
    private buildSSHArgs(options: RsyncOptions): string[] {
        const sshArgs: string[] = [];
        
        if (options.sshKey) {
            sshArgs.push('-e', `ssh -i "${options.sshKey}"`);
        }
        
        if (options.sshPort && options.sshPort !== 22) {
            const existingSSH = sshArgs.length > 1 ? sshArgs[1] : 'ssh';
            sshArgs[1] = `${existingSSH} -p ${options.sshPort}`;
        }
        
        if (options.sshOptions) {
            const existingSSH = sshArgs.length > 1 ? sshArgs[1] : 'ssh';
            sshArgs[1] = `${existingSSH} ${options.sshOptions.join(' ')}`;
        }

        if (options.timeout) {
            const existingSSH = sshArgs.length > 1 ? sshArgs[1] : 'ssh';
            sshArgs[1] = `${existingSSH} -o ConnectTimeout=${options.timeout}`;
        }

        return sshArgs;
    }

    /**
     * Parse transfer information from dry run output
     */
    private parseTransferInfo(output: string): FileInfo[] {
        const files: FileInfo[] = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Parse rsync dry-run output format
            const fileMatch = line.match(/^([>c]f[+.][+.][+.][+.][+.][+.][+.][+.][+.]) (.+)$/);
            if (fileMatch) {
                const [, flags, path] = fileMatch;
                files.push({
                    path,
                    size: 0, // Size not available in basic dry-run
                    isDirectory: flags.includes('d'),
                    permissions: flags.substring(1, 10)
                });
            }
        }
        
        return files;
    }

    /**
     * Get installation instructions if rsync is not available
     */
    getInstallationInstructions() {
        return RsyncCompatibilityChecker.getInstallInstructions();
    }

    /**
     * Attempt automatic installation of rsync
     */
    async installRsync() {
        return RsyncCompatibilityChecker.attemptAutoInstall();
    }

    /**
     * Generate a compatibility report
     */
    async generateReport(): Promise<string> {
        return RsyncCompatibilityChecker.getCompatibilityReport();
    }
}

export default RsyncManager;