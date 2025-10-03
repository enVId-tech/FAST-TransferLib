# FAST-TransferLib Rsync Manager

A comprehensive TypeScript library for rsync compatibility checking, automatic installation, and file/folder transfer operations across all major operating systems.

## Features

- **Cross-platform compatibility checking** (Windows, macOS, Linux)
- **Enhanced automatic installation** with fallback methods
- **File and folder transfer operations** (local and remote)
- **Multiple installation methods** per platform
- **CLI interface** for standalone usage
- **Library interface** for programmatic usage
- **SSH support** for remote transfers
- **Comprehensive error handling** and reporting

## File Transfer Capabilities

The library now includes comprehensive file and folder transfer functionality:

### Transfer Operations
- **Basic Transfer**: Copy files/folders to local or remote destinations
- **Recursive Copy**: Copy entire directory structures with progress tracking
- **Mirror Operations**: Exact synchronization with deletion of extra files
- **Incremental Backup**: Space-efficient backups using hard links
- **Remote Transfers**: SSH-based transfers to/from remote servers

### SSH Support
- **SSH Key Authentication**: Support for custom SSH private keys
- **Custom Ports**: Configure non-standard SSH ports
- **SSH Options**: Pass additional SSH configuration options
- **User@Host Format**: Standard SSH destination format support

### Transfer Options
- **Verbose Output**: Detailed transfer progress and file listings
- **Dry Run**: Preview operations without making changes
- **Exclude Patterns**: Skip files matching specific patterns
- **Compression**: Enable compression for faster transfers over networks
- **Progress Tracking**: Real-time transfer progress monitoring

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

- **Automatic (auto)**: Can be executed automatically via command line
- **Manual (manual)**: Requires manual download/setup (shown for reference but skipped in auto-install)

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
    
    // Local file transfer
    const localResult = await rsync.transfer('file.txt', '/backup/', {
        verbose: true
    });
    
    // Remote transfer to server
    const remoteResult = await rsync.transferToRemote('src/', {
        user: 'username',
        host: 'server.com',
        path: '/home/user/backup/'
    }, {
        recursive: true,
        sshKey: '~/.ssh/id_rsa'
    });
    
    // Mirror directory (exact copy with deletion)
    const mirrorResult = await rsync.mirrorDirectory('src/', '/mirror/', {
        verbose: true,
        dryRun: true  // Preview changes first
    });
    
    // Incremental backup
    const backupResult = await rsync.backup('data/', '/backups/', {
        exclude: ['*.log', 'node_modules/']
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

# File transfer operations
npx ts-node src/rsync/cli/rsyncCli.ts transfer file.txt /backup/
npx ts-node src/rsync/cli/rsyncCli.ts transfer --recursive src/ user@host:/backup/
npx ts-node src/rsync/cli/rsyncCli.ts transfer --ssh-key ~/.ssh/id_rsa src/ user@host:/data/

# Copy operations
npx ts-node src/rsync/cli/rsyncCli.ts copy src/ /backup/
npx ts-node src/rsync/cli/rsyncCli.ts copy --verbose --exclude "*.log" src/ /backup/

# Mirror operations
npx ts-node src/rsync/cli/rsyncCli.ts mirror src/ /mirror/
npx ts-node src/rsync/cli/rsyncCli.ts mirror --dry-run src/ /mirror/

# Backup operations
npx ts-node src/rsync/cli/rsyncCli.ts backup src/ /backups/
npx ts-node src/rsync/cli/rsyncCli.ts backup --exclude "node_modules" src/ /backups/

# Installation commands
npx ts-node src/rsync/cli/rsyncCli.ts install
npx ts-node src/rsync/cli/rsyncCli.ts install --interactive
npx ts-node src/rsync/cli/rsyncCli.ts install --auto

# Generate compatibility report
npx ts-node src/rsync/cli/rsyncCli.ts report
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
Attempts automatic installation using available package managers.

#### `getCompatibilityReport(): Promise<string>`
Generates a comprehensive compatibility and installation report.

### RsyncManager

#### Core Transfer Methods

##### `transfer(source: string, destination: string, options?: RsyncOptions): Promise<RsyncResult>`
Basic file/folder transfer to local or remote destination.

##### `transferToRemote(source: string, target: TransferTarget, options?: RsyncOptions): Promise<RsyncResult>`
Transfer files to a remote server via SSH.

##### `transferFromRemote(source: TransferTarget, destination: string, options?: RsyncOptions): Promise<RsyncResult>`
Download files from a remote server via SSH.

#### Specialized Operations

##### `copyFolder(source: string, destination: string, options?: RsyncOptions): Promise<RsyncResult>`
Copy folders recursively with progress tracking.

##### `mirrorDirectory(source: string, destination: string, options?: RsyncOptions): Promise<RsyncResult>`
Create exact mirror of source (deletes extra files in destination).

##### `backup(source: string, backupDir: string, options?: RsyncOptions): Promise<RsyncResult>`
Create incremental backup using hard links for space efficiency.

### Interfaces

#### `RsyncOptions`
```typescript
interface RsyncOptions {
    verbose?: boolean;          // Enable verbose output
    recursive?: boolean;        // Recursive directory transfer
    delete?: boolean;          // Delete files not in source
    dryRun?: boolean;          // Preview without making changes
    compress?: boolean;        // Enable compression
    exclude?: string[];        // Exclude patterns
    sshKey?: string;          // SSH private key path
    port?: number;            // SSH port number
    sshOptions?: string;      // Additional SSH options
}
```

#### `TransferTarget`
```typescript
interface TransferTarget {
    user: string;             // SSH username
    host: string;             // Remote hostname/IP
    path: string;             // Remote path
}
```

#### `RsyncResult`
```typescript
interface RsyncResult {
    success: boolean;         // Operation success status
    exitCode?: number;        // Command exit code
    output?: string;          // Command output
    error?: string;           // Error message
}
```
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