# FAST-TransferLib Rsync Checker

A comprehensive TypeScript library for checking Rsync compatibility across all major operating systems and providing installation guidance.

## Features

- **Cross-platform compatibility checking** (Windows, macOS, Linux)
- **Automatic installation detection** and guidance
- **Multiple installation methods** per platform
- **CLI interface** for standalone usage
- **Library interface** for programmatic usage
- **Comprehensive error handling** and reporting

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