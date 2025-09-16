# FAST-TransferLib Rsync Checker

A comprehensive TypeScript library for checking Rsync compatibility across all major operating systems and providing installation guidance.

## Features

- **Cross-platform compatibility checking** (Windows, macOS, Linux)
- **Enhanced automatic installation** with fallback methods
- **Multiple installation methods** per platform
- **CLI interface** for standalone usage
- **Library interface** for programmatic usage
- **Comprehensive error handling** and reporting

## Enhanced Auto-Installation

The automatic installation feature now intelligently tries multiple installation methods if the first one fails:

1. **Platform Detection**: Automatically detects your operating system
2. **Method Prioritization**: Orders installation methods by preference and availability
3. **Executable vs Manual**: Distinguishes between commands that can be run automatically vs manual steps
4. **Tool Availability Check**: Verifies package managers are installed before attempting
5. **Fallback Strategy**: If one method fails, automatically tries the next available executable option
6. **Comprehensive Reporting**: Provides detailed feedback on what was attempted and why it failed

```typescript
// Enhanced auto-installation with fallback and proper command validation
const result = await RsyncCompatibilityChecker.attemptAutoInstall();
// Will try executable methods only:
// Windows: Scoop → Chocolatey → Git Bash (via winget) → WSL2
// macOS: Homebrew → MacPorts → Xcode Tools
// Linux: APT → DNF → YUM → Pacman (based on availability)
// Skips manual-only methods like Cygwin automatically
```

### Installation Method Types

- **🟢 Automatic (auto)**: Can be executed automatically via command line
- **🔘 Manual (manual)**: Requires manual download/setup (shown for reference but skipped in auto-install)

## Quick Start

### Library Usage

```typescript
import { RsyncCompatibilityChecker, RsyncManager } from 'fast-transferlib';

// Check if rsync is available
const result = await RsyncCompatibilityChecker.checkCompatibility();

if (result.isAvailable) {
    console.log(`Rsync ${result.version} ready!`);
    
    // Use RsyncManager for transfers
    const rsync = new RsyncManager();
    await rsync.initialize();
    
    // Perform file synchronization
    const transferResult = await rsync.sync('./source/', './backup/', {
        archive: true,
        verbose: true,
        compress: true
    });
    
} else {
    console.log(`Rsync not available: ${result.errorMessage}`);
    console.log('Installation instructions:', result.installInstructions);
}
```

### CLI Usage

```bash
# Check rsync availability
npx ts-node src/cli/rsyncCli.ts check

# Get installation instructions
npx ts-node src/cli/rsyncCli.ts install

# Interactive installation guide
npx ts-node src/cli/rsyncCli.ts install --interactive

# Attempt automatic installation
npx ts-node src/cli/rsyncCli.ts install --auto

# Generate full compatibility report
npx ts-node src/cli/rsyncCli.ts report
```

## Installation Instructions by Platform

### Windows
- **Chocolatey**: `choco install rsync`
- **Scoop**: `scoop install rsync`
- **WSL2**: `wsl --install -d Ubuntu && wsl sudo apt install rsync`
- **Git Bash**: Included with Git for Windows
- **Cygwin**: Available through Cygwin installer

### macOS
- **Homebrew**: `brew install rsync`
- **MacPorts**: `sudo port install rsync`
- **Xcode Command Line Tools**: `xcode-select --install`

### Linux
- **Debian/Ubuntu**: `sudo apt update && sudo apt install rsync`
- **Fedora**: `sudo dnf install rsync`
- **CentOS/RHEL**: `sudo yum install rsync`
- **Arch**: `sudo pacman -S rsync`
- **openSUSE**: `sudo zypper install rsync`
- **Alpine**: `apk add rsync`

## API Reference

### RsyncCompatibilityChecker

#### `checkCompatibility(): Promise<RsyncCompatibilityResult>`
Checks if rsync is available on the current system.

#### `getInstallInstructions(platform?: string): InstallationMethod[]`
Returns installation methods for the specified or current platform.

#### `attemptAutoInstall(): Promise<{success: boolean, message: string}>`
Attempts automatic installation using the best available method.

#### `getCompatibilityReport(): Promise<string>`
Generates a formatted compatibility and installation report.

### RsyncManager

#### `initialize(): Promise<boolean>`
Initialize the manager and check rsync availability.

#### `sync(source: string, destination: string, options?: RsyncOptions): Promise<RsyncTransferResult>`
Synchronize files from source to destination.

#### `dryRun(source: string, destination: string, options?: RsyncOptions): Promise<RsyncTransferResult>`
Perform a dry run to see what would be transferred.

## Examples

See `examples.js` for comprehensive usage examples including:
- Basic compatibility checking
- Error handling and fallbacks
- Real-world integration scenarios
- CLI automation scripts

## Requirements

- Node.js 16.0.0 or higher
- TypeScript 5.2.2 or higher

## License

GPL-3.0-only