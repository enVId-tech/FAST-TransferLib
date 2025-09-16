import * as os from 'os';
import { execSync, spawn } from 'child_process';
import { SYSTEM } from './system.ts';

export interface RsyncCompatibilityResult {
    isAvailable: boolean;
    version?: string;
    platform: string;
    platformName: string;
    errorMessage?: string;
    installInstructions?: string;
}

export interface InstallationMethod {
    method: string;
    command: string;
    description: string;
    requiresAdmin: boolean;
}

/**
 * Comprehensive Rsync compatibility checker for all major operating systems
 */
export class RsyncCompatibilityChecker {
    /**
     * Check if Rsync is available on the current system
     */
    static async checkCompatibility(): Promise<RsyncCompatibilityResult> {
        const platform = os.platform();
        const platformName = SYSTEM;

        try {
            // Try to get rsync version
            const versionOutput = execSync('rsync --version', { 
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'ignore']
            });

            const versionMatch = versionOutput.match(/rsync\s+version\s+([\d.]+)/i);
            const version = versionMatch ? versionMatch[1] : 'unknown';

            return {
                isAvailable: true,
                version,
                platform,
                platformName,
            };
        } catch (error) {
            const installInstructions = this.getInstallInstructions(platform);
            
            return {
                isAvailable: false,
                platform,
                platformName,
                errorMessage: `Rsync is not installed or not found in PATH`,
                installInstructions: installInstructions.map(method => 
                    `${method.method}: ${method.command}`
                ).join('\n'),
            };
        }
    }

    /**
     * Get installation instructions for the current or specified platform
     */
    static getInstallInstructions(platform?: string): InstallationMethod[] {
        const currentPlatform = platform || os.platform();

        switch (currentPlatform) {
            case 'win32':
                return [
                    {
                        method: 'Chocolatey',
                        command: 'choco install rsync',
                        description: 'Install via Chocolatey package manager',
                        requiresAdmin: true
                    },
                    {
                        method: 'Scoop',
                        command: 'scoop install rsync',
                        description: 'Install via Scoop package manager',
                        requiresAdmin: false
                    },
                    {
                        method: 'WSL2',
                        command: 'wsl --install -d Ubuntu && wsl sudo apt update && wsl sudo apt install rsync',
                        description: 'Install Ubuntu WSL2 and rsync within it',
                        requiresAdmin: true
                    },
                    {
                        method: 'Git Bash',
                        command: 'Download Git for Windows (includes rsync in Git Bash)',
                        description: 'Git for Windows includes rsync in Git Bash environment',
                        requiresAdmin: false
                    },
                    {
                        method: 'Cygwin',
                        command: 'Download Cygwin installer and select rsync package',
                        description: 'Install via Cygwin Unix-like environment',
                        requiresAdmin: false
                    }
                ];

            case 'darwin':
                return [
                    {
                        method: 'Homebrew',
                        command: 'brew install rsync',
                        description: 'Install via Homebrew package manager (recommended)',
                        requiresAdmin: false
                    },
                    {
                        method: 'MacPorts',
                        command: 'sudo port install rsync',
                        description: 'Install via MacPorts package manager',
                        requiresAdmin: true
                    },
                    {
                        method: 'Xcode Command Line Tools',
                        command: 'xcode-select --install',
                        description: 'May include rsync with development tools',
                        requiresAdmin: false
                    }
                ];

            case 'linux':
                return [
                    {
                        method: 'APT (Debian/Ubuntu)',
                        command: 'sudo apt update && sudo apt install rsync',
                        description: 'Install on Debian-based distributions',
                        requiresAdmin: true
                    },
                    {
                        method: 'YUM (CentOS/RHEL)',
                        command: 'sudo yum install rsync',
                        description: 'Install on Red Hat-based distributions',
                        requiresAdmin: true
                    },
                    {
                        method: 'DNF (Fedora)',
                        command: 'sudo dnf install rsync',
                        description: 'Install on Fedora',
                        requiresAdmin: true
                    },
                    {
                        method: 'Pacman (Arch)',
                        command: 'sudo pacman -S rsync',
                        description: 'Install on Arch Linux',
                        requiresAdmin: true
                    },
                    {
                        method: 'Zypper (openSUSE)',
                        command: 'sudo zypper install rsync',
                        description: 'Install on openSUSE',
                        requiresAdmin: true
                    },
                    {
                        method: 'APK (Alpine)',
                        command: 'apk add rsync',
                        description: 'Install on Alpine Linux',
                        requiresAdmin: true
                    }
                ];

            default:
                return [
                    {
                        method: 'Package Manager',
                        command: 'Use your system\'s package manager to install rsync',
                        description: `Unknown platform: ${currentPlatform}`,
                        requiresAdmin: true
                    }
                ];
        }
    }

    /**
     * Attempt to automatically install rsync (where possible)
     */
    static async attemptAutoInstall(): Promise<{ success: boolean; message: string }> {
        const platform = os.platform();
        const instructions = this.getInstallInstructions(platform);
        
        // Find the most suitable automatic installation method
        let selectedMethod: InstallationMethod | null = null;

        if (platform === 'win32') {
            // Try Scoop first (doesn't require admin), then Chocolatey
            selectedMethod = instructions.find(m => m.method === 'Scoop') || 
                           instructions.find(m => m.method === 'Chocolatey') || null;
        } else if (platform === 'darwin') {
            // Try Homebrew first
            selectedMethod = instructions.find(m => m.method === 'Homebrew') || null;
        } else if (platform === 'linux') {
            // Try to detect the package manager
            try {
                execSync('which apt', { stdio: 'ignore' });
                selectedMethod = instructions.find(m => m.method.includes('APT')) || null;
            } catch {
                try {
                    execSync('which dnf', { stdio: 'ignore' });
                    selectedMethod = instructions.find(m => m.method.includes('DNF')) || null;
                } catch {
                    try {
                        execSync('which yum', { stdio: 'ignore' });
                        selectedMethod = instructions.find(m => m.method.includes('YUM')) || null;
                    } catch {
                        try {
                            execSync('which pacman', { stdio: 'ignore' });
                            selectedMethod = instructions.find(m => m.method.includes('Pacman')) || null;
                        } catch {
                            // Fall back to first available method
                            selectedMethod = instructions[0] || null;
                        }
                    }
                }
            }
        }

        if (!selectedMethod) {
            return {
                success: false,
                message: 'No automatic installation method available for this platform'
            };
        }

        try {
            console.log(`Attempting to install rsync using ${selectedMethod.method}...`);
            console.log(`Running: ${selectedMethod.command}`);

            if (selectedMethod.requiresAdmin && platform !== 'win32') {
                return {
                    success: false,
                    message: `Manual installation required. Run: ${selectedMethod.command}`
                };
            }

            // Execute the installation command
            execSync(selectedMethod.command, { 
                stdio: 'inherit',
                timeout: 300000 // 5 minutes timeout
            });

            // Verify installation
            const result = await this.checkCompatibility();
            if (result.isAvailable) {
                return {
                    success: true,
                    message: `Successfully installed rsync ${result.version} using ${selectedMethod.method}`
                };
            } else {
                return {
                    success: false,
                    message: 'Installation completed but rsync is still not available'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: `Installation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Get a formatted report of rsync compatibility and installation options
     */
    static async getCompatibilityReport(): Promise<string> {
        const result = await this.checkCompatibility();
        const instructions = this.getInstallInstructions();
        
        let report = `=== Rsync Compatibility Report ===\n`;
        report += `Platform: ${result.platformName} (${result.platform})\n`;
        report += `Rsync Available: ${result.isAvailable ? 'Yes' : 'No'}\n`;
        
        if (result.isAvailable) {
            report += `Version: ${result.version}\n`;
            report += `Status: Ready to use!\n`;
        } else {
            report += `Error: ${result.errorMessage}\n\n`;
            report += `=== Installation Options ===\n`;
            
            instructions.forEach((method, index) => {
                report += `${index + 1}. ${method.method}\n`;
                report += `   Command: ${method.command}\n`;
                report += `   Description: ${method.description}\n`;
                report += `   Requires Admin: ${method.requiresAdmin ? 'Yes' : 'No'}\n\n`;
            });
        }
        
        return report;
    }
}

// Export for backwards compatibility
export const checkRsyncCompatibility = RsyncCompatibilityChecker.checkCompatibility;
export const getRsyncInstallInstructions = RsyncCompatibilityChecker.getInstallInstructions;