/**
 * FAST-TransferLib - Cross-platform transfer library with automatic Rsync setup
 * Main entry point for the library
 */

// Core rsync functionality
export { default as RsyncManager } from './src/rsync/lib/rsync.js';
export type { RsyncOptions, RsyncTransferResult } from './src/rsync/lib/rsync.js';

// Compatibility checking
export { 
    RsyncCompatibilityChecker,
    checkRsyncCompatibility,
    getRsyncInstallInstructions 
} from './src/rsync/lib/rsyncChecker.js';
export type { 
    RsyncCompatibilityResult, 
    InstallationMethod 
} from './src/rsync/lib/rsyncChecker.js';

// System utilities
export { SYSTEM } from './src/sys/system.js';

// CLI (for programmatic access)
export { default as RsyncCLI } from './src/rsync/cli/rsyncCli.js';

// New unified transfer system
export { 
    UnifiedTransferManager, 
    createUnifiedTransferManager 
} from './src/transfer/manager.js';
export type { 
    UnifiedTransferOptions, 
    MethodSelectionResult 
} from './src/transfer/manager.js';

// Transfer interfaces and types
export type {
    TransferOptions,
    TransferResult,
    TransferTarget,
    TransferProgress,
    TransferProvider,
    FallbackCapabilities
} from './src/transfer/interfaces.js';

// Platform-specific providers (for advanced usage)
export { RobocopyProvider, XCopyProvider } from './src/transfer/providers/windows.js';
export { DittoProvider } from './src/transfer/providers/macos.js';
export { CpProvider, TarProvider, ScpProvider } from './src/transfer/providers/linux.js';

// Advanced transfer utilities
export {
    SSHProber,
    NetworkConnectionManager,
    FileEnumerator,
    TransferSessionManager,
    FileOperationsManager
} from './src/transfer/advanced-utils.js';
export type {
    SSHProbeResult,
    NetworkConnectionResult,
    FileMetadata,
    FileTransferTiming,
    TransferSession,
    CopyOperation
} from './src/transfer/advanced-utils.js';

// ZIP compression and transfer utilities
export {
    ZipTransferManager,
    NetworkSpeedDetector
} from './src/utils/zip-utils.js';
export type {
    ZipTransferOptions,
    ZipResult
} from './src/utils/zip-utils.js';

// File operation retry utilities (for handling locked files on Windows)
export {
    retryFileOperation,
    copyFileWithRetry,
    readFileWithRetry,
    writeFileWithRetry,
    renameWithRetry,
    unlinkWithRetry,
    mkdirWithRetry,
    statWithRetry,
    DEFAULT_RETRY_OPTIONS
} from './src/utils/file-retry.js';
export type {
    RetryOptions
} from './src/utils/file-retry.js';
