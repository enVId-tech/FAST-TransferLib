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
    isExecutable: boolean;  // New property to indicate if command can be executed automatically
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
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'Scoop',
                        command: 'scoop install rsync',
                        description: 'Install via Scoop package manager',
                        requiresAdmin: false,
                        isExecutable: true
                    },
                    {
                        method: 'WSL2',
                        command: 'wsl --install -d Ubuntu && wsl sudo apt update && wsl sudo apt install rsync',
                        description: 'Install Ubuntu WSL2 and rsync within it',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'Git Bash',
                        command: 'winget install Git.Git',
                        description: 'Git for Windows includes rsync in Git Bash environment',
                        requiresAdmin: false,
                        isExecutable: true
                    },
                    {
                        method: 'Cygwin',
                        command: 'Manual installation required - Download Cygwin installer from https://www.cygwin.com/ and select rsync package',
                        description: 'Install via Cygwin Unix-like environment (manual setup required)',
                        requiresAdmin: false,
                        isExecutable: false
                    }
                ];

            case 'darwin':
                return [
                    {
                        method: 'Homebrew',
                        command: 'brew install rsync',
                        description: 'Install via Homebrew package manager (recommended)',
                        requiresAdmin: false,
                        isExecutable: true
                    },
                    {
                        method: 'MacPorts',
                        command: 'sudo port install rsync',
                        description: 'Install via MacPorts package manager',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'Xcode Command Line Tools',
                        command: 'xcode-select --install',
                        description: 'May include rsync with development tools',
                        requiresAdmin: false,
                        isExecutable: true
                    }
                ];

            case 'linux':
                return [
                    {
                        method: 'APT (Debian/Ubuntu)',
                        command: 'sudo apt update && sudo apt install rsync',
                        description: 'Install on Debian-based distributions',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'YUM (CentOS/RHEL)',
                        command: 'sudo yum install rsync',
                        description: 'Install on Red Hat-based distributions',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'DNF (Fedora)',
                        command: 'sudo dnf install rsync',
                        description: 'Install on Fedora',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'Pacman (Arch)',
                        command: 'sudo pacman -S rsync',
                        description: 'Install on Arch Linux',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'Zypper (openSUSE)',
                        command: 'sudo zypper install rsync',
                        description: 'Install on openSUSE',
                        requiresAdmin: true,
                        isExecutable: true
                    },
                    {
                        method: 'APK (Alpine)',
                        command: 'apk add rsync',
                        description: 'Install on Alpine Linux',
                        requiresAdmin: true,
                        isExecutable: true
                    }
                ];

            default:
                return [
                    {
                        method: 'Package Manager',
                        command: 'Use your system\'s package manager to install rsync',
                        description: `Unknown platform: ${currentPlatform}`,
                        requiresAdmin: true,
                        isExecutable: false
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
        
        // Get ordered list of methods to try
        const methodsToTry = this.getOrderedInstallationMethods(platform, instructions);
        
        if (methodsToTry.length === 0) {
            return {
                success: false,
                message: 'No automatic installation methods available for this platform'
            };
        }

        const attemptedMethods: string[] = [];
        let lastError = '';

        // Try each method in order until one succeeds
        for (const method of methodsToTry) {
            attemptedMethods.push(method.method);
            
            // Skip non-executable methods (manual installation required)
            if (!method.isExecutable) {
                console.log(`Skipping ${method.method} (manual installation required)`);
                lastError = `${method.method} requires manual installation`;
                continue;
            }
            
            try {
                console.log(`Attempting to install rsync using ${method.method}...`);
                console.log(`Running: ${method.command}`);

                // Skip methods that require admin privileges on non-Windows systems
                if (method.requiresAdmin && platform !== 'win32') {
                    console.log(`Skipping ${method.method} (requires admin privileges)`);
                    lastError = `${method.method} requires admin privileges`;
                    continue;
                }

                // Check if the required tool is available before attempting installation
                if (!this.isInstallationToolAvailable(method)) {
                    console.log(`Skipping ${method.method} (tool not available)`);
                    lastError = `${method.method} tool not available`;
                    continue;
                }

                // Execute the installation command
                execSync(method.command, { 
                    stdio: 'inherit',
                    timeout: 300000 // 5 minutes timeout
                });

                // Verify installation
                const result = await this.checkCompatibility();
                if (result.isAvailable) {
                    return {
                        success: true,
                        message: `Successfully installed rsync ${result.version} using ${method.method}`
                    };
                } else {
                    console.log(`${method.method} installation completed but rsync is still not available`);
                    lastError = `${method.method} installation completed but rsync not found`;
                    continue;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(`${method.method} installation failed: ${errorMessage}`);
                lastError = `${method.method} failed: ${errorMessage}`;
                continue;
            }
        }

        // All methods failed
        return {
            success: false,
            message: `All installation methods failed. Attempted: ${attemptedMethods.join(', ')}. Last error: ${lastError}`
        };
    }

    /**
     * Get ordered list of installation methods to try for a platform
     */
    private static getOrderedInstallationMethods(platform: string, instructions: InstallationMethod[]): InstallationMethod[] {
        // Filter to only executable methods for automatic installation
        const executableMethods = instructions.filter(method => method.isExecutable);
        
        if (platform === 'win32') {
            // Prefer non-admin methods first, then admin methods
            const ordered: string[] = ['Scoop', 'Chocolatey', 'Git Bash', 'WSL2'];
            return this.orderMethodsByPreference(executableMethods, ordered);
        } else if (platform === 'darwin') {
            // Try Homebrew first, then others
            const ordered: string[] = ['Homebrew', 'MacPorts', 'Xcode Command Line Tools'];
            return this.orderMethodsByPreference(executableMethods, ordered);
        } else if (platform === 'linux') {
            // Detect available package managers and order them
            const availableManagers: string[] = [];
            
            // Check for package managers in order of preference
            const managerChecks = [
                { manager: 'APT', command: 'which apt' },
                { manager: 'DNF', command: 'which dnf' },
                { manager: 'YUM', command: 'which yum' },
                { manager: 'Pacman', command: 'which pacman' },
                { manager: 'Zypper', command: 'which zypper' },
                { manager: 'APK', command: 'which apk' }
            ];

            for (const check of managerChecks) {
                try {
                    execSync(check.command, { stdio: 'ignore' });
                    availableManagers.push(check.manager);
                } catch {
                    // Manager not available
                }
            }

            return this.orderMethodsByPreference(executableMethods, availableManagers);
        }

        // Default: return all executable methods, non-admin first
        return executableMethods.filter(method => !method.requiresAdmin)
                                .concat(executableMethods.filter(method => method.requiresAdmin));
    }

    /**
     * Order installation methods by preference
     */
    private static orderMethodsByPreference(instructions: InstallationMethod[], preferenceOrder: string[]): InstallationMethod[] {
        const ordered: InstallationMethod[] = [];
        
        // Add methods in preference order
        for (const preferred of preferenceOrder) {
            const method = instructions.find(m => m.method.includes(preferred));
            if (method) {
                ordered.push(method);
            }
        }
        
        // Add any remaining methods not in preference list
        for (const method of instructions) {
            if (!ordered.includes(method)) {
                ordered.push(method);
            }
        }
        
        return ordered;
    }

    /**
     * Check if the installation tool for a method is available
     */
    private static isInstallationToolAvailable(method: InstallationMethod): boolean {
        try {
            if (method.method === 'Chocolatey') {
                execSync('choco --version', { stdio: 'ignore' });
                return true;
            } else if (method.method === 'Scoop') {
                execSync('scoop --version', { stdio: 'ignore' });
                return true;
            } else if (method.method === 'Git Bash') {
                // Check if winget is available for installing Git
                execSync('winget --version', { stdio: 'ignore' });
                return true;
            } else if (method.method === 'WSL2') {
                // Check if WSL is available
                execSync('wsl --status', { stdio: 'ignore' });
                return true;
            } else if (method.method === 'Homebrew') {
                execSync('brew --version', { stdio: 'ignore' });
                return true;
            } else if (method.method === 'MacPorts') {
                execSync('port version', { stdio: 'ignore' });
                return true;
            } else if (method.method.includes('APT')) {
                execSync('which apt', { stdio: 'ignore' });
                return true;
            } else if (method.method.includes('DNF')) {
                execSync('which dnf', { stdio: 'ignore' });
                return true;
            } else if (method.method.includes('YUM')) {
                execSync('which yum', { stdio: 'ignore' });
                return true;
            } else if (method.method.includes('Pacman')) {
                execSync('which pacman', { stdio: 'ignore' });
                return true;
            } else if (method.method.includes('Zypper')) {
                execSync('which zypper', { stdio: 'ignore' });
                return true;
            } else if (method.method.includes('APK')) {
                execSync('which apk', { stdio: 'ignore' });
                return true;
            }
            
            // For methods without specific tool checks, assume available
            return true;
        } catch {
            return false;
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