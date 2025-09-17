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