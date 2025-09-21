import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { execSync, spawn, ChildProcess } from 'child_process';
import { TransferTarget, TransferResult, TransferOptions } from './interfaces.js';
import { createUnifiedTransferManager, UnifiedTransferManager } from './manager.js';

/**
 * Advanced transfer utilities for application integration
 */

export interface SSHProbeResult {
    host: string;
    port: number;
    accessible: boolean;
    responseTime: number;
    sshVersion?: string;
    authMethods?: string[];
    error?: string;
}

export interface NetworkConnectionResult {
    success: boolean;
    protocol: 'ssh' | 'smb' | 'afp' | 'nfs' | 'ftp' | 'unknown';
    fallbackUsed: boolean;
    connectionTime: number;
    error?: string;
}

export interface FileMetadata {
    path: string;
    name: string;
    size: number;
    type: 'file' | 'directory' | 'symlink';
    extension?: string;
    mimeType?: string;
    created: Date;
    modified: Date;
    accessed: Date;
    permissions?: string;
    isHidden: boolean;
    relativePath: string;
}

export interface FileTransferTiming {
    file: FileMetadata;
    startTime: Date;
    endTime: Date;
    duration: number; // milliseconds
    bytesPerSecond: number;
    status: 'success' | 'failed' | 'skipped';
    error?: string;
}

export interface TransferSession {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    totalDuration?: number;
    totalFiles: number;
    totalBytes: number;
    successfulFiles: number;
    failedFiles: number;
    skippedFiles: number;
    averageSpeed: number; // bytes per second
    peakSpeed: number;
    fileTimes: FileTransferTiming[];
    networkSpeed?: number; // Detected network speed in Mbps
}

export interface CopyOperation {
    id: string;
    type: 'copy' | 'cut';
    source: TransferTarget;
    files: string[];
    timestamp: Date;
    metadata: FileMetadata[];
}

export interface ZipTransferOptions extends TransferOptions {
    compressionLevel?: number; // 0-9
    includeHiddenFiles?: boolean;
    preserveStructure?: boolean;
    zipName?: string;
    password?: string;
}

/**
 * SSH Connection and Probing Utilities
 */
export class SSHProber {
    /**
     * Probe an SSH connection to test accessibility
     */
    static async probeSSH(host: string, port: number = 22, timeout: number = 5000): Promise<SSHProbeResult> {
        const startTime = Date.now();
        
        try {
            // Test basic connectivity first
            const isReachable = await this.testTCPConnection(host, port, timeout);
            if (!isReachable) {
                return {
                    host,
                    port,
                    accessible: false,
                    responseTime: Date.now() - startTime,
                    error: 'Host unreachable'
                };
            }

            // Try to get SSH banner and version
            const sshInfo = await this.getSSHInfo(host, port, timeout);
            
            return {
                host,
                port,
                accessible: true,
                responseTime: Date.now() - startTime,
                sshVersion: sshInfo.version,
                authMethods: sshInfo.authMethods
            };
            
        } catch (error) {
            return {
                host,
                port,
                accessible: false,
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    private static async testTCPConnection(host: string, port: number, timeout: number): Promise<boolean> {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();
            
            const timer = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, timeout);
            
            socket.connect(port, host, () => {
                clearTimeout(timer);
                socket.destroy();
                resolve(true);
            });
            
            socket.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
        });
    }

    private static async getSSHInfo(host: string, port: number, timeout: number): Promise<{version?: string, authMethods?: string[]}> {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();
            let data = '';
            
            const timer = setTimeout(() => {
                socket.destroy();
                resolve({});
            }, timeout);
            
            socket.connect(port, host, () => {
                // SSH server should send version banner immediately
            });
            
            socket.on('data', (chunk: Buffer) => {
                data += chunk.toString();
                
                // Look for SSH version banner
                const versionMatch = data.match(/SSH-([0-9.]+)-(.+)/);
                if (versionMatch) {
                    clearTimeout(timer);
                    socket.destroy();
                    resolve({
                        version: versionMatch[0],
                        authMethods: ['password', 'publickey'] // Common defaults
                    });
                }
            });
            
            socket.on('error', () => {
                clearTimeout(timer);
                resolve({});
            });
        });
    }
}

/**
 * Network Connection Manager with Automatic Fallbacks
 */
export class NetworkConnectionManager {
    /**
     * Establish connection with automatic fallback to native protocols
     */
    static async establishConnection(target: TransferTarget): Promise<NetworkConnectionResult> {
        const startTime = Date.now();
        
        if (!target.isRemote || !target.host) {
            return {
                success: true,
                protocol: 'unknown',
                fallbackUsed: false,
                connectionTime: 0
            };
        }

        // Try SSH first if specified or default
        if (!target.port || target.port === 22) {
            const sshResult = await this.trySSHConnection(target);
            if (sshResult.success) {
                return {
                    ...sshResult,
                    connectionTime: Date.now() - startTime
                };
            }
        }

        // Fallback to native protocols based on OS
        return await this.tryNativeProtocols(target, startTime);
    }

    private static async trySSHConnection(target: TransferTarget): Promise<NetworkConnectionResult> {
        try {
            const probeResult = await SSHProber.probeSSH(target.host!, target.port || 22);
            
            if (probeResult.accessible) {
                return {
                    success: true,
                    protocol: 'ssh',
                    fallbackUsed: false,
                    connectionTime: probeResult.responseTime
                };
            }
            
            return {
                success: false,
                protocol: 'ssh',
                fallbackUsed: false,
                connectionTime: probeResult.responseTime,
                error: probeResult.error
            };
            
        } catch (error) {
            return {
                success: false,
                protocol: 'ssh',
                fallbackUsed: false,
                connectionTime: 0,
                error: error instanceof Error ? error.message : 'SSH connection failed'
            };
        }
    }

    private static async tryNativeProtocols(target: TransferTarget, startTime: number): Promise<NetworkConnectionResult> {
        const platform = os.platform();
        
        try {
            switch (platform) {
                case 'win32':
                    return await this.trySMBConnection(target, startTime);
                case 'darwin':
                    return await this.tryAFPConnection(target, startTime);
                case 'linux':
                    return await this.tryNFSConnection(target, startTime);
                default:
                    return {
                        success: false,
                        protocol: 'unknown',
                        fallbackUsed: true,
                        connectionTime: Date.now() - startTime,
                        error: 'No native protocol available for platform'
                    };
            }
        } catch (error) {
            return {
                success: false,
                protocol: 'unknown',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Native protocol connection failed'
            };
        }
    }

    private static async trySMBConnection(target: TransferTarget, startTime: number): Promise<NetworkConnectionResult> {
        try {
            // Try to test SMB connection
            const smbPath = `\\\\${target.host}\\${target.path.replace(/\//g, '\\\\')}`;
            execSync(`dir "${smbPath}" /A`, { stdio: 'ignore', timeout: 5000 });
            
            return {
                success: true,
                protocol: 'smb',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime
            };
        } catch {
            return {
                success: false,
                protocol: 'smb',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime,
                error: 'SMB connection failed'
            };
        }
    }

    private static async tryAFPConnection(target: TransferTarget, startTime: number): Promise<NetworkConnectionResult> {
        try {
            // Try to mount AFP share
            const afpPath = `afp://${target.host}${target.path}`;
            execSync(`ls "${afpPath}" 2>/dev/null`, { stdio: 'ignore', timeout: 5000 });
            
            return {
                success: true,
                protocol: 'afp',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime
            };
        } catch {
            return {
                success: false,
                protocol: 'afp',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime,
                error: 'AFP connection failed'
            };
        }
    }

    private static async tryNFSConnection(target: TransferTarget, startTime: number): Promise<NetworkConnectionResult> {
        try {
            // Try to test NFS mount
            execSync(`showmount -e ${target.host}`, { stdio: 'ignore', timeout: 5000 });
            
            return {
                success: true,
                protocol: 'nfs',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime
            };
        } catch {
            return {
                success: false,
                protocol: 'nfs',
                fallbackUsed: true,
                connectionTime: Date.now() - startTime,
                error: 'NFS connection failed'
            };
        }
    }
}

/**
 * File and Folder Enumeration Utilities
 */
export class FileEnumerator {
    /**
     * Get all files and folders recursively within a target
     */
    static async enumerateFiles(target: TransferTarget, includeHidden: boolean = false): Promise<FileMetadata[]> {
        const files: FileMetadata[] = [];
        
        if (target.isRemote) {
            return await this.enumerateRemoteFiles(target, includeHidden);
        } else {
            return await this.enumerateLocalFiles(target.path, '', includeHidden);
        }
    }

    private static async enumerateLocalFiles(
        basePath: string, 
        relativePath: string, 
        includeHidden: boolean
    ): Promise<FileMetadata[]> {
        const files: FileMetadata[] = [];
        const fullPath = path.join(basePath, relativePath);
        
        try {
            const stat = await fs.stat(fullPath);
            const items = await fs.readdir(fullPath);
            
            for (const item of items) {
                if (!includeHidden && item.startsWith('.')) {
                    continue;
                }
                
                const itemPath = path.join(fullPath, item);
                const itemRelativePath = path.join(relativePath, item);
                const itemStat = await fs.stat(itemPath);
                
                const metadata: FileMetadata = {
                    path: itemPath,
                    name: item,
                    size: itemStat.size,
                    type: itemStat.isDirectory() ? 'directory' : (itemStat.isSymbolicLink() ? 'symlink' : 'file'),
                    extension: path.extname(item),
                    created: itemStat.birthtime,
                    modified: itemStat.mtime,
                    accessed: itemStat.atime,
                    permissions: itemStat.mode.toString(8),
                    isHidden: item.startsWith('.'),
                    relativePath: itemRelativePath
                };
                
                // Add MIME type for files
                if (metadata.type === 'file') {
                    metadata.mimeType = this.getMimeType(metadata.extension || '');
                }
                
                files.push(metadata);
                
                // Recurse into directories
                if (itemStat.isDirectory()) {
                    const subFiles = await this.enumerateLocalFiles(basePath, itemRelativePath, includeHidden);
                    files.push(...subFiles);
                }
            }
            
        } catch (error) {
            console.warn(`Failed to enumerate ${fullPath}:`, error);
        }
        
        return files;
    }

    private static async enumerateRemoteFiles(target: TransferTarget, includeHidden: boolean): Promise<FileMetadata[]> {
        // For remote files, we'll use rsync or SSH to get file listings
        try {
            if (target.host) {
                const command = includeHidden ? 'find . -type f -o -type d' : 'find . -not -path "*/.*" -type f -o -type d';
                const sshCommand = `ssh ${target.user ? target.user + '@' : ''}${target.host} "cd ${target.path} && ${command}"`;
                
                const output = execSync(sshCommand, { encoding: 'utf8', timeout: 30000 });
                const lines = output.split('\n').filter(line => line.trim());
                
                const files: FileMetadata[] = [];
                
                for (const line of lines) {
                    try {
                        const statCommand = `ssh ${target.user ? target.user + '@' : ''}${target.host} "stat -c '%n|%s|%Y|%X|%Z|%A' ${path.join(target.path, line)}"`;
                        const statOutput = execSync(statCommand, { encoding: 'utf8', timeout: 5000 });
                        const [name, size, mtime, atime, ctime, perms] = statOutput.trim().split('|');
                        
                        const metadata: FileMetadata = {
                            path: path.join(target.path, line),
                            name: path.basename(line),
                            size: parseInt(size),
                            type: line.endsWith('/') ? 'directory' : 'file',
                            extension: path.extname(line),
                            created: new Date(parseInt(ctime) * 1000),
                            modified: new Date(parseInt(mtime) * 1000),
                            accessed: new Date(parseInt(atime) * 1000),
                            permissions: perms,
                            isHidden: path.basename(line).startsWith('.'),
                            relativePath: line
                        };
                        
                        if (metadata.type === 'file') {
                            metadata.mimeType = this.getMimeType(metadata.extension || '');
                        }
                        
                        files.push(metadata);
                    } catch {
                        // Skip files that can't be stat'd
                    }
                }
                
                return files;
            }
        } catch (error) {
            console.warn('Failed to enumerate remote files:', error);
        }
        
        return [];
    }

    private static getMimeType(extension: string): string {
        const mimeTypes: { [key: string]: string } = {
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.mp4': 'video/mp4',
            '.mp3': 'audio/mpeg',
            '.zip': 'application/zip',
            '.js': 'application/javascript',
            '.html': 'text/html',
            '.css': 'text/css',
            '.json': 'application/json'
        };
        
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
}

/**
 * Transfer Session Manager for Timing and Tracking
 */
export class TransferSessionManager extends EventEmitter {
    private activeSessions: Map<string, TransferSession> = new Map();
    private sessionCounter = 0;

    /**
     * Start a new transfer session
     */
    startSession(): string {
        const sessionId = `session_${++this.sessionCounter}_${Date.now()}`;
        const session: TransferSession = {
            sessionId,
            startTime: new Date(),
            totalFiles: 0,
            totalBytes: 0,
            successfulFiles: 0,
            failedFiles: 0,
            skippedFiles: 0,
            averageSpeed: 0,
            peakSpeed: 0,
            fileTimes: []
        };
        
        this.activeSessions.set(sessionId, session);
        this.emit('sessionStarted', session);
        
        return sessionId;
    }

    /**
     * End a transfer session
     */
    endSession(sessionId: string): TransferSession | null {
        const session = this.activeSessions.get(sessionId);
        if (!session) return null;
        
        session.endTime = new Date();
        session.totalDuration = session.endTime.getTime() - session.startTime.getTime();
        
        // Calculate final statistics
        session.averageSpeed = session.totalBytes / (session.totalDuration / 1000);
        session.peakSpeed = Math.max(...session.fileTimes.map(ft => ft.bytesPerSecond));
        
        // Estimate network speed based on transfer performance
        session.networkSpeed = this.estimateNetworkSpeed(session);
        
        this.activeSessions.delete(sessionId);
        this.emit('sessionEnded', session);
        
        return session;
    }

    /**
     * Track individual file transfer
     */
    trackFileTransfer(
        sessionId: string, 
        file: FileMetadata, 
        startTime: Date, 
        endTime: Date, 
        status: 'success' | 'failed' | 'skipped',
        error?: string
    ): void {
        const session = this.activeSessions.get(sessionId);
        if (!session) return;
        
        const duration = endTime.getTime() - startTime.getTime();
        const bytesPerSecond = duration > 0 ? (file.size / (duration / 1000)) : 0;
        
        const timing: FileTransferTiming = {
            file,
            startTime,
            endTime,
            duration,
            bytesPerSecond,
            status,
            error
        };
        
        session.fileTimes.push(timing);
        session.totalFiles++;
        session.totalBytes += file.size;
        
        switch (status) {
            case 'success':
                session.successfulFiles++;
                break;
            case 'failed':
                session.failedFiles++;
                break;
            case 'skipped':
                session.skippedFiles++;
                break;
        }
        
        if (bytesPerSecond > session.peakSpeed) {
            session.peakSpeed = bytesPerSecond;
        }
        
        this.emit('fileTransferred', sessionId, timing);
    }

    /**
     * Get active session
     */
    getSession(sessionId: string): TransferSession | null {
        return this.activeSessions.get(sessionId) || null;
    }

    /**
     * Get all active sessions
     */
    getActiveSessions(): TransferSession[] {
        return Array.from(this.activeSessions.values());
    }

    private estimateNetworkSpeed(session: TransferSession): number {
        if (session.fileTimes.length === 0) return 0;
        
        // Get successful transfers only
        const successfulTransfers = session.fileTimes.filter(ft => ft.status === 'success');
        if (successfulTransfers.length === 0) return 0;
        
        // Calculate average speed in Mbps
        const avgBytesPerSecond = successfulTransfers.reduce((sum, ft) => sum + ft.bytesPerSecond, 0) / successfulTransfers.length;
        const mbps = (avgBytesPerSecond * 8) / (1024 * 1024); // Convert to Mbps
        
        return Math.round(mbps * 100) / 100; // Round to 2 decimal places
    }
}

/**
 * Copy and Cut Operations Manager
 */
export class FileOperationsManager {
    private static clipboard: CopyOperation | null = null;
    private static operationCounter = 0;

    /**
     * Copy files to clipboard
     */
    static async copyFiles(source: TransferTarget, filePaths: string[]): Promise<CopyOperation> {
        const files = await this.getFileMetadata(source, filePaths);
        
        const operation: CopyOperation = {
            id: `copy_${++this.operationCounter}_${Date.now()}`,
            type: 'copy',
            source,
            files: filePaths,
            timestamp: new Date(),
            metadata: files
        };
        
        this.clipboard = operation;
        return operation;
    }

    /**
     * Cut files to clipboard
     */
    static async cutFiles(source: TransferTarget, filePaths: string[]): Promise<CopyOperation> {
        const files = await this.getFileMetadata(source, filePaths);
        
        const operation: CopyOperation = {
            id: `cut_${++this.operationCounter}_${Date.now()}`,
            type: 'cut',
            source,
            files: filePaths,
            timestamp: new Date(),
            metadata: files
        };
        
        this.clipboard = operation;
        return operation;
    }

    /**
     * Paste files from clipboard
     */
    static async pasteFiles(destination: TransferTarget, sessionManager?: TransferSessionManager): Promise<TransferResult> {
        if (!this.clipboard) {
            throw new Error('No files in clipboard');
        }

        const manager = await createUnifiedTransferManager();
        const sessionId = sessionManager?.startSession();
        
        try {
            const result = await manager.transfer(this.clipboard.source, destination, {
                include: this.clipboard.files
            });
            
            // If it was a cut operation, delete source files after successful copy
            if (this.clipboard.type === 'cut' && result.success) {
                await this.deleteSourceFiles(this.clipboard);
            }
            
            if (sessionId && sessionManager) {
                sessionManager.endSession(sessionId);
            }
            
            return result;
            
        } catch (error) {
            if (sessionId && sessionManager) {
                sessionManager.endSession(sessionId);
            }
            throw error;
        } finally {
            // Cleanup if manager has cleanup method
            if ('cleanup' in manager && typeof manager.cleanup === 'function') {
                await manager.cleanup();
            }
        }
    }

    /**
     * Get current clipboard operation
     */
    static getClipboard(): CopyOperation | null {
        return this.clipboard;
    }

    /**
     * Clear clipboard
     */
    static clearClipboard(): void {
        this.clipboard = null;
    }

    private static async getFileMetadata(source: TransferTarget, filePaths: string[]): Promise<FileMetadata[]> {
        const metadata: FileMetadata[] = [];
        
        for (const filePath of filePaths) {
            try {
                if (source.isRemote) {
                    // Get remote file metadata via SSH
                    const fullPath = path.join(source.path, filePath);
                    const command = `ssh ${source.user ? source.user + '@' : ''}${source.host} "stat -c '%n|%s|%Y|%X|%Z|%A' '${fullPath}'"`;
                    const output = execSync(command, { encoding: 'utf8', timeout: 5000 });
                    const [name, size, mtime, atime, ctime, perms] = output.trim().split('|');
                    
                    metadata.push({
                        path: fullPath,
                        name: path.basename(filePath),
                        size: parseInt(size),
                        type: 'file', // Simplified for now
                        extension: path.extname(filePath),
                        created: new Date(parseInt(ctime) * 1000),
                        modified: new Date(parseInt(mtime) * 1000),
                        accessed: new Date(parseInt(atime) * 1000),
                        permissions: perms,
                        isHidden: path.basename(filePath).startsWith('.'),
                        relativePath: filePath
                    });
                } else {
                    // Get local file metadata
                    const fullPath = path.join(source.path, filePath);
                    const stat = await fs.stat(fullPath);
                    
                    metadata.push({
                        path: fullPath,
                        name: path.basename(filePath),
                        size: stat.size,
                        type: stat.isDirectory() ? 'directory' : 'file',
                        extension: path.extname(filePath),
                        created: stat.birthtime,
                        modified: stat.mtime,
                        accessed: stat.atime,
                        permissions: stat.mode.toString(8),
                        isHidden: path.basename(filePath).startsWith('.'),
                        relativePath: filePath
                    });
                }
            } catch (error) {
                console.warn(`Failed to get metadata for ${filePath}:`, error);
            }
        }
        
        return metadata;
    }

    private static async deleteSourceFiles(operation: CopyOperation): Promise<void> {
        // Implementation depends on whether source is local or remote
        if (operation.source.isRemote) {
            // Delete remote files via SSH
            for (const filePath of operation.files) {
                try {
                    const fullPath = path.join(operation.source.path, filePath);
                    const command = `ssh ${operation.source.user ? operation.source.user + '@' : ''}${operation.source.host} "rm -rf '${fullPath}'"`;
                    execSync(command, { timeout: 10000 });
                } catch (error) {
                    console.warn(`Failed to delete remote file ${filePath}:`, error);
                }
            }
        } else {
            // Delete local files
            for (const filePath of operation.files) {
                try {
                    const fullPath = path.join(operation.source.path, filePath);
                    await fs.rm(fullPath, { recursive: true });
                } catch (error) {
                    console.warn(`Failed to delete local file ${filePath}:`, error);
                }
            }
        }
    }
}