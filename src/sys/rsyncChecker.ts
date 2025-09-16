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

        // First try standard PATH check
        try {
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
            // Standard rsync not found, check alternative locations
            console.log('Standard rsync not found in PATH, checking alternative locations...');
        }

        // Check alternative installation locations
        const alternativeCheck = await this.checkAlternativeLocations(platform, platformName);
        if (alternativeCheck.isAvailable) {
            return alternativeCheck;
        }

        // Not found anywhere
        const installInstructions = this.getInstallInstructions(platform);
        
        return {
            isAvailable: false,
            platform,
            platformName,
            errorMessage: `Rsync is not installed or not found in PATH or common installation locations`,
            installInstructions: installInstructions.map(method => 
                `${method.method}: ${method.command}`
            ).join('\n'),
        };
    }

    /**
     * Check alternative installation locations for rsync
     */
    private static async checkAlternativeLocations(platform: string, platformName: string): Promise<RsyncCompatibilityResult> {
        if (platform === 'win32') {
            // Check Git Bash installation
            const gitResult = await this.checkRsyncInGitBash();
            if (gitResult.isAvailable) {
                console.log('Found rsync in Git Bash installation');
                return gitResult;
            }

            // Check WSL installations
            const wslResult = await this.checkRsyncInWSL();
            if (wslResult.isAvailable) {
                console.log('Found rsync in WSL installation');
                return wslResult;
            }

            // Check Scoop installation
            const scoopResult = await this.checkRsyncInScoop();
            if (scoopResult.isAvailable) {
                console.log('Found rsync in Scoop installation');
                return scoopResult;
            }

            // Check Chocolatey installation
            const chocoResult = await this.checkRsyncInChocolatey();
            if (chocoResult.isAvailable) {
                console.log('Found rsync in Chocolatey installation');
                return chocoResult;
            }
        }

        return {
            isAvailable: false,
            platform,
            platformName,
            errorMessage: 'Rsync not found in any known installation locations'
        };
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
                        command: 'wsl sudo apt update && wsl sudo apt install -y rsync',
                        description: 'Install rsync in existing WSL2 Ubuntu (or setup WSL2 if needed)',
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
                    // Special handling for methods that might need additional steps
                    if (method.method === 'Git Bash') {
                        console.log('Git installed but rsync not found. Checking if rsync is available in Git Bash...');
                        // Try to find rsync in Git installation
                        try {
                            execSync('where git', { stdio: 'pipe' });
                            const gitResult = await this.checkRsyncInGitBash();
                            if (gitResult.isAvailable) {
                                return {
                                    success: true,
                                    message: `Rsync is available in Git Bash installation`
                                };
                            }
                        } catch {
                            // Git not found in PATH
                        }
                    } else if (method.method === 'WSL2') {
                        console.log('WSL2 setup completed. Checking if rsync is available in WSL...');
                        const wslResult = await this.checkRsyncInWSL();
                        if (wslResult.isAvailable) {
                            return {
                                success: true,
                                message: `Rsync is available in WSL2`
                            };
                        }
                    }
                    
                    console.log(`${method.method} installation completed but rsync is still not available`);
                    lastError = `${method.method} installation completed but rsync not found`;
                    continue;
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                
                // Enhanced error handling for specific scenarios
                if (method.method === 'Chocolatey' && errorMessage.includes('Access to the path')) {
                    console.log(`${method.method} failed due to permissions. Try running as administrator.`);
                    lastError = `${method.method} requires administrator privileges`;
                } else if (method.method === 'Git Bash' && errorMessage.includes('already installed')) {
                    console.log('Git is already installed. Checking for rsync availability...');
                    // Check if rsync is available in existing Git installation
                    const gitResult = await this.checkRsyncInGitBash();
                    if (gitResult.isAvailable) {
                        return {
                            success: true,
                            message: `Rsync found in existing Git Bash installation`
                        };
                    }
                    lastError = `Git installed but rsync not found in Git Bash`;
                } else if (method.method === 'WSL2' && errorMessage.includes('already exists')) {
                    console.log('WSL Ubuntu already exists. Attempting to install rsync inside WSL...');
                    try {
                        execSync('wsl sudo apt update && wsl sudo apt install -y rsync', { 
                            stdio: 'inherit',
                            timeout: 300000
                        });
                        const wslResult = await this.checkRsyncInWSL();
                        if (wslResult.isAvailable) {
                            return {
                                success: true,
                                message: `Successfully installed rsync in existing WSL2 Ubuntu`
                            };
                        }
                        lastError = `WSL rsync installation completed but not accessible`;
                    } catch (wslError) {
                        console.log(`Failed to install rsync in WSL: ${wslError}`);
                        lastError = `WSL rsync installation failed: ${wslError}`;
                    }
                } else {
                    console.log(`${method.method} installation failed: ${errorMessage}`);
                    lastError = `${method.method} failed: ${errorMessage}`;
                }
                continue;
            }
        }

        // All methods failed - provide helpful guidance
        let guidanceMessage = `All installation methods failed. Attempted: ${attemptedMethods.join(', ')}.`;
        
        if (platform === 'win32') {
            guidanceMessage += '\n\nRecommended next steps:\n';
            guidanceMessage += '1. Run PowerShell as Administrator and try: choco install rsync\n';
            guidanceMessage += '2. Or install Scoop and try: scoop install rsync\n';
            guidanceMessage += '3. Or use WSL2: wsl --install -d Ubuntu then wsl sudo apt install rsync\n';
            guidanceMessage += '4. Or download Git for Windows which includes rsync in Git Bash\n';
            guidanceMessage += `\nLast error: ${lastError}`;
        } else {
            guidanceMessage += `\nLast error: ${lastError}`;
        }

        return {
            success: false,
            message: guidanceMessage
        };
    }

    /**
     * Get ordered list of installation methods to try for a platform
     */
    private static getOrderedInstallationMethods(platform: string, instructions: InstallationMethod[]): InstallationMethod[] {
        // Filter to only executable methods for automatic installation
        const executableMethods = instructions.filter(method => method.isExecutable);
        
        // Further filter based on prerequisites and existing installations
        const viableMethods = executableMethods.filter(method => {
            // Skip methods where rsync is already available
            if (this.isRsyncAlreadyAvailableForMethod(method)) {
                console.log(`Skipping ${method.method} - rsync already available in this location`);
                return false;
            }
            
            // Skip methods where prerequisites don't exist
            if (!this.arePrerequisitesMet(method)) {
                console.log(`Skipping ${method.method} - prerequisites not met`);
                return false;
            }
            
            return true;
        });
        
        if (platform === 'win32') {
            // Prefer non-admin methods first, then admin methods
            const ordered: string[] = ['Scoop', 'Chocolatey', 'Git Bash', 'WSL2'];
            return this.orderMethodsByPreference(viableMethods, ordered);
        } else if (platform === 'darwin') {
            // Try Homebrew first, then others
            const ordered: string[] = ['Homebrew', 'MacPorts', 'Xcode Command Line Tools'];
            return this.orderMethodsByPreference(viableMethods, ordered);
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

            return this.orderMethodsByPreference(viableMethods, availableManagers);
        }

        // Default: return all viable methods, non-admin first
        return viableMethods.filter(method => !method.requiresAdmin)
                           .concat(viableMethods.filter(method => method.requiresAdmin));
    }

    /**
     * Check if rsync is already available for a specific installation method
     */
    private static isRsyncAlreadyAvailableForMethod(method: InstallationMethod): boolean {
        try {
            if (method.method === 'Git Bash') {
                // Check if rsync exists in Git installation
                const gitPath = execSync('where git', { encoding: 'utf8', stdio: 'pipe' }).trim();
                const gitDir = gitPath.split('\\').slice(0, -2).join('\\');
                const possiblePaths = [
                    `${gitDir}\\usr\\bin\\rsync.exe`,
                    `${gitDir}\\bin\\rsync.exe`,
                    `${gitDir}\\mingw64\\bin\\rsync.exe`
                ];
                
                return possiblePaths.some(path => {
                    try {
                        execSync(`"${path}" --version`, { stdio: 'ignore', timeout: 2000 });
                        return true;
                    } catch {
                        return false;
                    }
                });
            } else if (method.method === 'WSL2') {
                // Check if rsync exists in WSL
                try {
                    execSync('wsl rsync --version', { stdio: 'ignore', timeout: 5000 });
                    return true;
                } catch {
                    return false;
                }
            } else if (method.method === 'Scoop') {
                // Check if rsync exists in Scoop
                try {
                    execSync('scoop which rsync', { stdio: 'ignore', timeout: 3000 });
                    return true;
                } catch {
                    const userProfile = process.env.USERPROFILE || '';
                    const scoopPath = `${userProfile}\\scoop\\apps\\rsync\\current\\rsync.exe`;
                    try {
                        execSync(`"${scoopPath}" --version`, { stdio: 'ignore', timeout: 2000 });
                        return true;
                    } catch {
                        return false;
                    }
                }
            } else if (method.method === 'Chocolatey') {
                // Check if rsync exists in Chocolatey
                const commonPaths = [
                    'C:\\ProgramData\\chocolatey\\lib\\rsync\\tools\\rsync.exe',
                    'C:\\ProgramData\\chocolatey\\bin\\rsync.exe'
                ];
                
                return commonPaths.some(path => {
                    try {
                        execSync(`"${path}" --version`, { stdio: 'ignore', timeout: 2000 });
                        return true;
                    } catch {
                        return false;
                    }
                });
            }
            
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Check if prerequisites are met for an installation method
     */
    private static arePrerequisitesMet(method: InstallationMethod): boolean {
        try {
            if (method.method === 'Git Bash') {
                // Check if winget is available OR if Git is already installed
                try {
                    execSync('winget --version', { stdio: 'ignore', timeout: 3000 });
                    return true;
                } catch {
                    // If winget not available, check if Git is already installed
                    try {
                        execSync('where git', { stdio: 'ignore', timeout: 3000 });
                        return true; // Git already installed, no need to install again
                    } catch {
                        return false;
                    }
                }
            } else if (method.method === 'WSL2') {
                // Check if WSL is available
                try {
                    execSync('wsl --list', { stdio: 'ignore', timeout: 5000 });
                    return true;
                } catch {
                    // WSL not available, check if it can be installed
                    try {
                        execSync('dism /online /get-featureinfo /featurename:Microsoft-Windows-Subsystem-Linux', 
                               { stdio: 'ignore', timeout: 10000 });
                        return true;
                    } catch {
                        return false;
                    }
                }
            }
            
            // For other methods, use existing tool availability check
            return this.isInstallationToolAvailable(method);
        } catch {
            return false;
        }
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
     * Check if rsync is available in Git Bash
     */
    private static async checkRsyncInGitBash(): Promise<RsyncCompatibilityResult> {
        try {
            // Try to find Git installation path
            const gitPath = execSync('where git', { encoding: 'utf8', stdio: 'pipe' }).trim();
            const gitDir = gitPath.split('\\').slice(0, -2).join('\\'); // Go up from bin/git.exe
            
            // Common paths for rsync in Git for Windows
            const possiblePaths = [
                `${gitDir}\\usr\\bin\\rsync.exe`,
                `${gitDir}\\bin\\rsync.exe`,
                `${gitDir}\\mingw64\\bin\\rsync.exe`
            ];
            
            for (const path of possiblePaths) {
                try {
                    execSync(`"${path}" --version`, { stdio: 'ignore' });
                    const versionOutput = execSync(`"${path}" --version`, { encoding: 'utf8', stdio: 'pipe' });
                    const versionMatch = versionOutput.match(/rsync\s+version\s+([\d.]+)/i);
                    const version = versionMatch ? versionMatch[1] : 'unknown';
                    
                    return {
                        isAvailable: true,
                        version,
                        platform: 'win32',
                        platformName: 'Windows (Git Bash)',
                    };
                } catch {
                    // Try next path
                }
            }
            
            return {
                isAvailable: false,
                platform: 'win32',
                platformName: 'Windows (Git Bash)',
                errorMessage: 'Rsync not found in Git Bash installation'
            };
        } catch {
            return {
                isAvailable: false,
                platform: 'win32',
                platformName: 'Windows (Git Bash)',
                errorMessage: 'Git not found or Git Bash not accessible'
            };
        }
    }

    /**
     * Check if rsync is available in WSL
     */
    private static async checkRsyncInWSL(): Promise<RsyncCompatibilityResult> {
        try {
            const versionOutput = execSync('wsl rsync --version', { 
                encoding: 'utf8', 
                stdio: 'pipe',
                timeout: 10000
            });
            
            const versionMatch = versionOutput.match(/rsync\s+version\s+([\d.]+)/i);
            const version = versionMatch ? versionMatch[1] : 'unknown';
            
            return {
                isAvailable: true,
                version,
                platform: 'win32',
                platformName: 'Windows (WSL2)',
            };
        } catch {
            return {
                isAvailable: false,
                platform: 'win32',
                platformName: 'Windows (WSL2)',
                errorMessage: 'Rsync not found in WSL or WSL not accessible'
            };
        }
    }

    /**
     * Check if rsync is available in Scoop installation
     */
    private static async checkRsyncInScoop(): Promise<RsyncCompatibilityResult> {
        try {
            // Check if Scoop is installed
            const scoopPath = execSync('scoop which rsync', { 
                encoding: 'utf8', 
                stdio: 'pipe',
                timeout: 5000
            }).trim();
            
            if (scoopPath) {
                const versionOutput = execSync(`"${scoopPath}" --version`, { 
                    encoding: 'utf8', 
                    stdio: 'pipe',
                    timeout: 5000
                });
                
                const versionMatch = versionOutput.match(/rsync\s+version\s+([\d.]+)/i);
                const version = versionMatch ? versionMatch[1] : 'unknown';
                
                return {
                    isAvailable: true,
                    version,
                    platform: 'win32',
                    platformName: 'Windows (Scoop)',
                };
            }
        } catch {
            // Try alternative method - check Scoop apps directory
            try {
                const userProfile = process.env.USERPROFILE || '';
                const scoopApps = `${userProfile}\\scoop\\apps\\rsync\\current\\rsync.exe`;
                
                execSync(`"${scoopApps}" --version`, { stdio: 'ignore', timeout: 5000 });
                const versionOutput = execSync(`"${scoopApps}" --version`, { 
                    encoding: 'utf8', 
                    stdio: 'pipe' 
                });
                
                const versionMatch = versionOutput.match(/rsync\s+version\s+([\d.]+)/i);
                const version = versionMatch ? versionMatch[1] : 'unknown';
                
                return {
                    isAvailable: true,
                    version,
                    platform: 'win32',
                    platformName: 'Windows (Scoop)',
                };
            } catch {
                // Not found
            }
        }
        
        return {
            isAvailable: false,
            platform: 'win32',
            platformName: 'Windows (Scoop)',
            errorMessage: 'Rsync not found in Scoop installation'
        };
    }

    /**
     * Check if rsync is available in Chocolatey installation
     */
    private static async checkRsyncInChocolatey(): Promise<RsyncCompatibilityResult> {
        try {
            // Check common Chocolatey installation paths
            const commonPaths = [
                'C:\\ProgramData\\chocolatey\\lib\\rsync\\tools\\rsync.exe',
                'C:\\ProgramData\\chocolatey\\bin\\rsync.exe',
                'C:\\tools\\rsync\\rsync.exe'
            ];
            
            for (const path of commonPaths) {
                try {
                    execSync(`"${path}" --version`, { stdio: 'ignore', timeout: 5000 });
                    const versionOutput = execSync(`"${path}" --version`, { 
                        encoding: 'utf8', 
                        stdio: 'pipe' 
                    });
                    
                    const versionMatch = versionOutput.match(/rsync\s+version\s+([\d.]+)/i);
                    const version = versionMatch ? versionMatch[1] : 'unknown';
                    
                    return {
                        isAvailable: true,
                        version,
                        platform: 'win32',
                        platformName: 'Windows (Chocolatey)',
                    };
                } catch {
                    // Try next path
                }
            }
        } catch {
            // Chocolatey check failed
        }
        
        return {
            isAvailable: false,
            platform: 'win32',
            platformName: 'Windows (Chocolatey)',
            errorMessage: 'Rsync not found in Chocolatey installation'
        };
    }
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
                // Check if WSL is available and has a distribution
                try {
                    execSync('wsl --list', { stdio: 'ignore' });
                    return true;
                } catch {
                    // If WSL2 is not available, try to install it first
                    try {
                        execSync('wsl --install -d Ubuntu', { stdio: 'ignore', timeout: 10000 });
                        return true;
                    } catch {
                        return false;
                    }
                }
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