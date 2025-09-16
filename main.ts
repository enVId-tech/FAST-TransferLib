/**
 * FAST-TransferLib - Cross-platform transfer library with automatic Rsync setup
 * Main entry point for the library
 */

// Core rsync functionality
export { default as RsyncManager } from './src/sys/rsync.js';
export type { RsyncOptions, RsyncTransferResult } from './src/sys/rsync.js';

// Compatibility checking
export { 
    RsyncCompatibilityChecker,
    checkRsyncCompatibility,
    getRsyncInstallInstructions 
} from './src/sys/rsyncChecker.js';
export type { 
    RsyncCompatibilityResult, 
    InstallationMethod 
} from './src/sys/rsyncChecker.js';

// System utilities
export { SYSTEM } from './src/sys/system.js';

// CLI (for programmatic access)
export { default as RsyncCLI } from './src/cli/rsyncCli.js';