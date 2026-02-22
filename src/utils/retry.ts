import { logger } from './logger.js';

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        retries?: number;
        delay?: number;
        factor?: number;
        context?: string;
    } = {}
): Promise<T> {
    const { retries = 3, delay = 1000, factor = 2, context = 'operation' } = options;

    let lastError: any;
    let currentDelay = delay;

    for (let i = 0; i <= retries; i++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            if (i === retries) break;

            logger.warn(
                { err: error.message, attempt: i + 1, nextDelay: currentDelay, context },
                `Retryable error in ${context}`
            );

            await new Promise((resolve) => setTimeout(resolve, currentDelay));
            currentDelay *= factor;
        }
    }

    logger.error({ err: lastError.message, context }, `Fatal error in ${context} after ${retries} retries`);
    throw lastError;
}
