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