import { RsyncCompatibilityChecker, RsyncCompatibilityResult } from './rsyncChecker.ts';
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
}

export interface RsyncTransferResult {
    success: boolean;
    exitCode: number;
    output: string;
    error?: string;
    bytesTransferred?: number;
    filesTransferred?: number;
    duration?: number;
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
        const args: string[] = ['rsync'];

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

        // Custom arguments
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