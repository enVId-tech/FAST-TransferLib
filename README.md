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
2. **Comprehensive Location Scanning**: Checks standard PATH and alternative installation locations
3. **Intelligent Method Filtering**: Skips methods where rsync already exists or prerequisites aren't met
4. **Executable vs Manual**: Distinguishes between commands that can be run automatically vs manual steps
5. **Tool Availability Check**: Verifies package managers are installed before attempting
6. **Fallback Strategy**: If one method fails, automatically tries the next available executable option
7. **Enhanced Error Handling**: Intelligently handles common installation scenarios
8. **Comprehensive Reporting**: Provides detailed feedback and next-step guidance

### Smart Location Detection

The system now performs comprehensive scanning for existing rsync installations:

**Windows Scanning Locations:**
- Standard PATH (`rsync --version`)
- Git Bash: `git_dir\usr\bin\rsync.exe`, `git_dir\bin\rsync.exe`, `git_dir\mingw64\bin\rsync.exe`
- WSL: `wsl rsync --version` (all distributions)
- Scoop: `%USERPROFILE%\scoop\apps\rsync\current\rsync.exe`
- Chocolatey: `C:\ProgramData\chocolatey\lib\rsync\tools\rsync.exe`

**Smart Installation Logic:**
- **Skip if Found**: If rsync exists in Git Bash, skips Git installation
- **Skip if No Prerequisites**: If WSL isn't available, skips WSL method
- **Validate Tools**: Checks if Scoop/Chocolatey are installed before attempting
- **Existing Installation Handling**: Works with already-installed tools

### Smart Error Handling

The system now handles common installation issues automatically:

- **Permission Errors**: Detects Chocolatey permission issues and suggests running as admin
- **Existing Installations**: When Git is already installed, checks for rsync in Git Bash paths
- **WSL Scenarios**: Handles existing WSL distributions and installs rsync directly
- **Timeout Management**: Better handling of long-running installation processes
- **Detailed Guidance**: Provides specific next steps when all automatic methods fail

```typescript
// Enhanced auto-installation with comprehensive location checking
const result = await RsyncCompatibilityChecker.checkCompatibility();
// Now scans: PATH → Git Bash → WSL → Scoop → Chocolatey

const installResult = await RsyncCompatibilityChecker.attemptAutoInstall();
// Intelligently skips methods where rsync already exists
// Only attempts installation where prerequisites are met
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