import { EventEmitter } from 'events';

export interface TransferOptions {
    // Common options
    archive?: boolean;          // Preserve permissions, timestamps, etc.
    verbose?: boolean;          // Verbose output
    compress?: boolean;         // Compress during transfer (if supported)
    delete?: boolean;           // Delete extraneous files from destination
    dryRun?: boolean;          // Show what would be transferred without doing it
    exclude?: string[];         // Exclude patterns
    include?: string[];         // Include patterns
    progress?: boolean;         // Show progress
    recursive?: boolean;        // Transfer directories recursively
    preserveLinks?: boolean;    // Preserve symlinks
    preservePerms?: boolean;    // Preserve permissions
    preserveTimes?: boolean;    // Preserve modification times
    checksum?: boolean;         // Skip based on checksum, not mod-time & size
    
    // Network/remote options
    bandwidth?: number;         // Bandwidth limit in KB/s
    timeout?: number;           // Connection timeout in seconds
    retries?: number;           // Number of retry attempts
    
    // Authentication (for network transfers)
    username?: string;          // Username for remote access
    password?: string;          // Password for remote access
    keyFile?: string;           // Key file for authentication
    
    // Platform-specific options
    useNativeTools?: boolean;   // Force use of native tools instead of rsync
    windowsRobocopy?: boolean;  // Use robocopy on Windows (if available)
    preserveAcls?: boolean;     // Preserve ACLs (Windows/macOS)
    preserveExtendedAttrs?: boolean; // Preserve extended attributes
    
    // Custom arguments for native tools
    customArgs?: string[];      // Additional arguments for native tools
}

export interface TransferResult {
    success: boolean;
    exitCode: number;
    output: string;
    error?: string;
    bytesTransferred?: number;
    filesTransferred?: number;
    duration?: number;
    sourceSize?: number;
    transferRate?: string;
    method: 'rsync' | 'robocopy' | 'xcopy' | 'cp' | 'ditto' | 'tar' | 'scp' | 'smb' | 'unknown';
    fallbackUsed: boolean;
}

export interface TransferTarget {
    path: string;
    host?: string;             // Remote hostname or IP
    user?: string;             // Remote username
    port?: number;             // Port for remote connection
    protocol?: 'smb' | 'nfs' | 'ssh' | 'ftp' | 'sftp' | 'local'; // Transfer protocol
    isRemote: boolean;
    mountPoint?: string;       // Local mount point for network shares
}

export interface TransferProgress {
    bytesTransferred: number;
    totalBytes: number;
    filesTransferred: number;
    totalFiles: number;
    currentFile: string;
    transferRate: string;
    timeRemaining?: string;
    percentage: number;
}

export interface FallbackCapabilities {
    supportsCompression: boolean;
    supportsProgress: boolean;
    supportsResume: boolean;
    supportsDelete: boolean;
    supportsSymlinks: boolean;
    supportsPermissions: boolean;
    supportsTimestamps: boolean;
    supportsNetworkTransfer: boolean;
    supportsAuthentication: boolean;
    maxRetries: number;
    preferredFor: string[];     // Use cases this method is preferred for
}

/**
 * Abstract base class for transfer implementations
 */
export abstract class TransferProvider extends EventEmitter {
    abstract name: string;
    abstract capabilities: FallbackCapabilities;
    
    /**
     * Check if this provider is available on the current system
     */
    abstract isAvailable(): Promise<boolean>;
    
    /**
     * Get the version of the underlying tool
     */
    abstract getVersion(): Promise<string | null>;
    
    /**
     * Prepare for transfer (mount shares, authenticate, etc.)
     */
    abstract prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean>;
    
    /**
     * Execute the transfer
     */
    abstract transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<TransferResult>;
    
    /**
     * Cleanup after transfer (unmount shares, cleanup temp files, etc.)
     */
    abstract cleanup(source: TransferTarget, destination: TransferTarget): Promise<void>;
    
    /**
     * Estimate transfer size and file count
     */
    abstract estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{
        totalBytes: number;
        totalFiles: number;
    }>;
    
    /**
     * Validate transfer targets
     */
    abstract validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{
        valid: boolean;
        errors: string[];
    }>;
    
    protected emitProgress(progress: TransferProgress): void {
        this.emit('progress', progress);
    }
    
    protected emitError(error: Error): void {
        this.emit('error', error);
    }
    
    protected emitComplete(result: TransferResult): void {
        this.emit('complete', result);
    }
}
