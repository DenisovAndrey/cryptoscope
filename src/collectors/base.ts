import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';
import { statusService } from '../utils/status.js';

export abstract class BaseCollector {
    constructor(protected name: string) { }

    abstract collect(): Promise<void>;

    protected async runCollection(fn: () => Promise<void>) {
        logger.info({ collector: this.name }, `Starting collection`);
        try {
            await withRetry(fn, { context: this.name });
            logger.info({ collector: this.name }, `Collection completed successfully`);
            statusService.updateStatus(this.name, 'SUCCESS');
        } catch (error: any) {
            logger.error({ collector: this.name, err: error.message }, `Collection failed`);
            statusService.updateStatus(this.name, 'FAILURE', error.message);
        }
    }
}
