import { EventEmitter } from 'events';
import * as os from 'os';
import { TransferProvider, TransferOptions, TransferResult, TransferTarget, TransferProgress } from './interfaces.ts';
import { RobocopyProvider, XCopyProvider } from './providers/windows.ts';
import { DittoProvider, CpProvider as MacCpProvider } from './providers/macos.ts';
import { CpProvider, TarProvider, ScpProvider } from './providers/linux.ts';
import { RsyncCompatibilityChecker } from '../rsync/lib/rsyncChecker.ts';

export interface UnifiedTransferOptions extends TransferOptions {
    // Transfer method preferences
    preferRsync?: boolean;           // Prefer rsync if available (default: true)
    forceNative?: boolean;          // Force use of native tools instead of rsync
    preferredMethod?: string;        // Preferred fallback method name
    allowNetworkFallback?: boolean;  // Allow network fallback methods (default: true)
    
    // Rsync-specific options (when rsync is used)
    rsyncPath?: string;             // Custom rsync binary path
    rsyncArgs?: string[];           // Additional rsync arguments
    
    // Strategy for method selection
    strategy?: 'fastest' | 'most-compatible' | 'preserve-metadata' | 'compress' | 'network';
}

export interface MethodSelectionResult {
    provider: TransferProvider;
    reason: string;
    rsyncAvailable: boolean;
    fallbackUsed: boolean;
}

/**
 * Unified transfer manager that intelligently selects between rsync and fallback methods
 */
export class UnifiedTransferManager extends EventEmitter {
    private availableProviders: Map<string, TransferProvider> = new Map();
    private rsyncAvailable: boolean = false;
    private platformProviders: TransferProvider[] = [];

    constructor() {
        super();
        this.initializePlatformProviders();
    }

    /**
     * Initialize platform-specific providers
     */
    private initializePlatformProviders(): void {
        const platform = os.platform();
        
        switch (platform) {
            case 'win32':
                this.platformProviders = [
                    new RobocopyProvider(),
                    new XCopyProvider()
                ];
                break;
                
            case 'darwin':
                this.platformProviders = [
                    new DittoProvider(),
                    new MacCpProvider(),
                    new ScpProvider() // For network transfers
                ];
                break;
                
            case 'linux':
                this.platformProviders = [
                    new CpProvider(),
                    new TarProvider(),
                    new ScpProvider()
                ];
                break;
                
            default:
                // Fallback to basic providers
                this.platformProviders = [new CpProvider()];
        }
    }

    /**
     * Initialize the transfer manager by checking rsync availability and provider compatibility
     */
    async initialize(): Promise<void> {
        try {
            // Check rsync availability
            const rsyncResult = await RsyncCompatibilityChecker.checkCompatibility();
            this.rsyncAvailable = rsyncResult.isAvailable;
            
            // Check which fallback providers are available
            for (const provider of this.platformProviders) {
                try {
                    if (await provider.isAvailable()) {
                        this.availableProviders.set(provider.name, provider);
                        
                        // Set up event forwarding
                        provider.on('progress', (progress: TransferProgress) => {
                            this.emit('progress', progress);
                        });
                        
                        provider.on('error', (error: Error) => {
                            this.emit('error', error);
                        });
                    }
                } catch (error) {
                    // Provider initialization failed, skip it
                    console.warn(`Failed to initialize provider ${provider.name}:`, error);
                }
            }
            
            this.emit('initialized', {
                rsyncAvailable: this.rsyncAvailable,
                availableProviders: Array.from(this.availableProviders.keys())
            });
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Select the best transfer method based on options and requirements
     */
    async selectTransferMethod(
        source: TransferTarget, 
        destination: TransferTarget, 
        options: UnifiedTransferOptions = {}
    ): Promise<MethodSelectionResult> {
        
        // If user forces native tools, skip rsync
        if (options.forceNative) {
            const provider = await this.selectFallbackProvider(source, destination, options);
            return {
                provider,
                reason: 'Native tools forced by user',
                rsyncAvailable: this.rsyncAvailable,
                fallbackUsed: true
            };
        }

        // If user prefers a specific method
        if (options.preferredMethod && this.availableProviders.has(options.preferredMethod)) {
            const provider = this.availableProviders.get(options.preferredMethod)!;
            const validation = await provider.validateTargets(source, destination);
            
            if (validation.valid) {
                return {
                    provider,
                    reason: `User preferred method: ${options.preferredMethod}`,
                    rsyncAvailable: this.rsyncAvailable,
                    fallbackUsed: true
                };
            }
        }

        // If rsync is available and preferred (default behavior)
        if (this.rsyncAvailable && options.preferRsync !== false) {
            // For now, we'll assume an RsyncProvider exists in the rsync module
            // This would need to be implemented to wrap the existing rsync functionality
            return {
                provider: await this.createRsyncProvider(options),
                reason: 'Rsync is available and preferred',
                rsyncAvailable: true,
                fallbackUsed: false
            };
        }

        // Rsync not available or not preferred, select fallback
        const provider = await this.selectFallbackProvider(source, destination, options);
        return {
            provider,
            reason: this.rsyncAvailable ? 'Fallback method preferred' : 'Rsync not available',
            rsyncAvailable: this.rsyncAvailable,
            fallbackUsed: true
        };
    }

    /**
     * Select the best fallback provider based on strategy and requirements
     */
    private async selectFallbackProvider(
        source: TransferTarget, 
        destination: TransferTarget, 
        options: UnifiedTransferOptions
    ): Promise<TransferProvider> {
        
        const isNetworkTransfer = source.isRemote || destination.isRemote;
        const strategy = options.strategy || 'most-compatible';
        
        // Filter providers based on capabilities
        const suitableProviders: { provider: TransferProvider; score: number }[] = [];
        
        for (const [name, provider] of this.availableProviders) {
            // Check if provider supports network transfer if needed
            if (isNetworkTransfer && !provider.capabilities.supportsNetworkTransfer && !options.allowNetworkFallback) {
                continue;
            }
            
            // Validate targets
            const validation = await provider.validateTargets(source, destination);
            if (!validation.valid) {
                continue;
            }
            
            // Calculate score based on strategy
            const score = this.calculateProviderScore(provider, strategy, options, isNetworkTransfer);
            suitableProviders.push({ provider, score });
        }
        
        if (suitableProviders.length === 0) {
            throw new Error('No suitable transfer providers available for the given targets and options');
        }
        
        // Sort by score (highest first) and return the best provider
        suitableProviders.sort((a, b) => b.score - a.score);
        return suitableProviders[0].provider;
    }

    /**
     * Calculate score for a provider based on strategy and requirements
     */
    private calculateProviderScore(
        provider: TransferProvider, 
        strategy: string, 
        options: UnifiedTransferOptions,
        isNetworkTransfer: boolean
    ): number {
        let score = 0;
        const caps = provider.capabilities;
        
        switch (strategy) {
            case 'fastest':
                // Prefer providers with good performance characteristics
                if (provider.name === 'robocopy') score += 10;
                if (provider.name === 'rsync') score += 15;
                if (caps.supportsProgress) score += 3;
                if (caps.supportsResume) score += 5;
                break;
                
            case 'most-compatible':
                // Prefer widely compatible providers
                if (provider.name === 'cp') score += 10;
                if (provider.name === 'xcopy') score += 8;
                if (!caps.supportsNetworkTransfer && !isNetworkTransfer) score += 5;
                break;
                
            case 'preserve-metadata':
                // Prefer providers that preserve file metadata
                if (caps.supportsPermissions) score += 5;
                if (caps.supportsTimestamps) score += 5;
                if (caps.supportsSymlinks) score += 3;
                if (provider.name === 'ditto') score += 8; // Excellent for macOS metadata
                if (provider.name === 'robocopy') score += 7; // Good for Windows metadata
                break;
                
            case 'compress':
                // Prefer providers that support compression
                if (caps.supportsCompression) score += 10;
                if (provider.name === 'tar') score += 8;
                if (provider.name === 'ditto') score += 6;
                break;
                
            case 'network':
                // Prefer providers optimized for network transfer
                if (caps.supportsNetworkTransfer) score += 10;
                if (caps.supportsAuthentication) score += 5;
                if (provider.name === 'scp') score += 8;
                if (provider.name === 'robocopy') score += 6; // Good SMB support
                break;
        }
        
        // Bonus points for specific option support
        if (options.compress && caps.supportsCompression) score += 3;
        if (options.progress && caps.supportsProgress) score += 2;
        if (options.delete && caps.supportsDelete) score += 2;
        if (isNetworkTransfer && caps.supportsNetworkTransfer) score += 5;
        
        // Penalty for missing critical features
        if (options.preservePerms && !caps.supportsPermissions) score -= 5;
        if (options.preserveTimes && !caps.supportsTimestamps) score -= 3;
        if (options.preserveLinks && !caps.supportsSymlinks) score -= 2;
        
        return score;
    }

    /**
     * Create a wrapper provider for rsync functionality
     */
    private async createRsyncProvider(options: UnifiedTransferOptions): Promise<TransferProvider> {
        // This would integrate with the existing rsync manager
        // For now, return a placeholder that would wrap the existing RsyncManager
        return new RsyncWrapperProvider(options);
    }

    /**
     * Execute transfer using the best available method
     */
    async transfer(
        source: TransferTarget, 
        destination: TransferTarget, 
        options: UnifiedTransferOptions = {}
    ): Promise<TransferResult & { methodUsed: MethodSelectionResult }> {
        
        const methodSelection = await this.selectTransferMethod(source, destination, options);
        const provider = methodSelection.provider;
        
        this.emit('methodSelected', methodSelection);
        
        try {
            // Prepare for transfer
            const prepared = await provider.prepare(source, destination, options);
            if (!prepared) {
                throw new Error('Failed to prepare transfer');
            }
            
            // Execute transfer
            const result = await provider.transfer(source, destination, options);
            
            // Cleanup
            await provider.cleanup(source, destination);
            
            // Add method information to result
            const enhancedResult = {
                ...result,
                methodUsed: methodSelection
            };
            
            this.emit('transferComplete', enhancedResult);
            return enhancedResult;
            
        } catch (error) {
            // Cleanup on error
            try {
                await provider.cleanup(source, destination);
            } catch {
                // Ignore cleanup errors
            }
            
            this.emit('transferError', error);
            throw error;
        }
    }

    /**
     * Get information about available transfer methods
     */
    getAvailableMethods(): { 
        rsyncAvailable: boolean; 
        fallbackMethods: Array<{ name: string; capabilities: any }> 
    } {
        return {
            rsyncAvailable: this.rsyncAvailable,
            fallbackMethods: Array.from(this.availableProviders.entries()).map(([name, provider]) => ({
                name,
                capabilities: provider.capabilities
            }))
        };
    }

    /**
     * Estimate transfer requirements
     */
    async estimateTransfer(
        source: TransferTarget, 
        destination: TransferTarget, 
        options: UnifiedTransferOptions = {}
    ): Promise<{ totalBytes: number; totalFiles: number; recommendedMethod: string }> {
        
        const methodSelection = await this.selectTransferMethod(source, destination, options);
        const estimate = await methodSelection.provider.estimateTransfer(source, options);
        
        return {
            ...estimate,
            recommendedMethod: methodSelection.provider.name
        };
    }
}

/**
 * Wrapper provider for rsync functionality to fit the TransferProvider interface
 */
class RsyncWrapperProvider extends TransferProvider {
    name = 'rsync';
    capabilities = {
        supportsCompression: true,
        supportsProgress: true,
        supportsResume: true,
        supportsDelete: true,
        supportsSymlinks: true,
        supportsPermissions: true,
        supportsTimestamps: true,
        supportsNetworkTransfer: true,
        supportsAuthentication: true,
        maxRetries: 10,
        preferredFor: ['all-purposes', 'network-transfer', 'incremental-backup']
    };

    constructor(private options: UnifiedTransferOptions) {
        super();
    }

    async isAvailable(): Promise<boolean> {
        const result = await RsyncCompatibilityChecker.checkCompatibility();
        return result.isAvailable;
    }

    async getVersion(): Promise<string | null> {
        const result = await RsyncCompatibilityChecker.checkCompatibility();
        return result.version || null;
    }

    async prepare(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<boolean> {
        // Use existing rsync preparation logic
        return true;
    }

    async transfer(source: TransferTarget, destination: TransferTarget, options: TransferOptions): Promise<TransferResult> {
        // This would integrate with the existing RsyncManager
        // For now, return a placeholder result
        return {
            success: true,
            exitCode: 0,
            output: 'Rsync transfer completed (placeholder)',
            method: 'rsync',
            fallbackUsed: false
        };
    }

    async cleanup(source: TransferTarget, destination: TransferTarget): Promise<void> {
        // Use existing rsync cleanup logic
    }

    async estimateTransfer(source: TransferTarget, options: TransferOptions): Promise<{ totalBytes: number; totalFiles: number }> {
        // Use existing rsync estimation logic or fallback to file system scan
        return { totalBytes: 0, totalFiles: 0 };
    }

    async validateTargets(source: TransferTarget, destination: TransferTarget): Promise<{ valid: boolean; errors: string[] }> {
        // Use existing rsync validation logic
        return { valid: true, errors: [] };
    }
}

/**
 * Factory function to create and initialize a unified transfer manager
 */
export async function createUnifiedTransferManager(): Promise<UnifiedTransferManager> {
    const manager = new UnifiedTransferManager();
    await manager.initialize();
    return manager;
}
