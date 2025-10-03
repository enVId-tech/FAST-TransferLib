import { promises as fs } from 'fs';
import { promisify } from 'util';

/**
 * Retry options for file operations
 */
export interface RetryOptions {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
}

/**
 * Default retry configuration for Windows file locks
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
    maxRetries: 5,
    initialDelay: 100,
    maxDelay: 5000,
    backoffFactor: 2,
    retryableErrors: ['EBUSY', 'EPERM', 'EACCES', 'EMFILE', 'ENFILE']
};

/**
 * Sleep utility
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
    return error && typeof error.code === 'string' && retryableErrors.includes(error.code);
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, initialDelay: number, maxDelay: number, backoffFactor: number): number {
    const exponentialDelay = initialDelay * Math.pow(backoffFactor, attempt);
    const jitter = Math.random() * 0.3 * exponentialDelay; // Add 0-30% jitter
    return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Retry a file operation with exponential backoff
 */
export async function retryFileOperation<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // If not retryable or last attempt, throw immediately
            if (!isRetryableError(error, config.retryableErrors) || attempt === config.maxRetries) {
                throw error;
            }

            // Calculate delay and wait
            const delay = calculateDelay(attempt, config.initialDelay, config.maxDelay, config.backoffFactor);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Copy a file with retry logic for locked files
 */
export async function copyFileWithRetry(
    source: string,
    destination: string,
    options: RetryOptions = {}
): Promise<void> {
    return retryFileOperation(
        () => fs.copyFile(source, destination),
        options
    );
}

/**
 * Read a file with retry logic
 */
export async function readFileWithRetry(
    path: string,
    options: RetryOptions & { encoding?: BufferEncoding } = {}
): Promise<string | Buffer> {
    const { encoding, ...retryOptions } = options;
    return retryFileOperation(
        async () => {
            if (encoding) {
                return await fs.readFile(path, encoding);
            }
            return await fs.readFile(path);
        },
        retryOptions
    );
}

/**
 * Write a file with retry logic
 */
export async function writeFileWithRetry(
    path: string,
    data: string | Buffer,
    options: RetryOptions = {}
): Promise<void> {
    return retryFileOperation(
        () => fs.writeFile(path, data),
        options
    );
}

/**
 * Rename/move a file with retry logic
 */
export async function renameWithRetry(
    oldPath: string,
    newPath: string,
    options: RetryOptions = {}
): Promise<void> {
    return retryFileOperation(
        () => fs.rename(oldPath, newPath),
        options
    );
}

/**
 * Delete a file with retry logic
 */
export async function unlinkWithRetry(
    path: string,
    options: RetryOptions = {}
): Promise<void> {
    return retryFileOperation(
        () => fs.unlink(path),
        options
    );
}

/**
 * Create directory with retry logic
 */
export async function mkdirWithRetry(
    path: string,
    options: RetryOptions & { recursive?: boolean } = {}
): Promise<string | undefined> {
    const { recursive, ...retryOptions } = options;
    return retryFileOperation(
        () => fs.mkdir(path, { recursive }),
        retryOptions
    );
}

/**
 * Stat a file with retry logic
 */
export async function statWithRetry(
    path: string,
    options: RetryOptions = {}
): Promise<import('fs').Stats> {
    return retryFileOperation(
        () => fs.stat(path),
        options
    );
}
