import { PriceCollector } from '../collectors/price.js';
import { DerivativesCollector } from '../collectors/derivatives.js';
import { SentimentCollector } from '../collectors/sentiment.js';
import { MacroCollector } from '../collectors/macro.js';
import { OnChainCollector } from '../collectors/onchain.js';
import { runIndicatorEngine } from './engine.js';
import { SignalEngine } from './signal.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { statusService } from '../utils/status.js';

export class PipelineManager {
    private isRunning = false;

    async runFullCycle(): Promise<{ success: boolean; message: string }> {
        if (this.isRunning) {
            return { success: false, message: "Pipeline is already running" };
        }

        this.isRunning = true;
        logger.info('👤 On-demand pipeline request triggered');

        try {
            // 1. Data Collection
            for (const asset of config.trading.assets) {
                await new PriceCollector(asset, '1h').collect();
                await new DerivativesCollector(asset).collect();
            }
            await new SentimentCollector().collect();
            await new MacroCollector().collect();
            await new OnChainCollector().collect();

            // 2. Indicator Engine
            await runIndicatorEngine();
            statusService.updateStatus('Indicator Engine', 'SUCCESS');

            // 3. Signal Engine
            const signalEngine = new SignalEngine();
            await signalEngine.run();
            statusService.updateStatus('Signal Engine', 'SUCCESS');

            this.isRunning = false;
            return { success: true, message: "Pipeline cycle completed successfully" };
        } catch (error: any) {
            this.isRunning = false;
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error({ err: errorMsg }, 'On-demand pipeline cycle failed');
            statusService.updateStatus('Engine Cycle', 'FAILURE', errorMsg);
            return { success: false, message: `Pipeline failed: ${errorMsg}` };
        }
    }
}

export const pipelineManager = new PipelineManager();
