import { logger } from './utils/logger.js';
import { initDb } from './db/database.js';
import { config } from './config.js';
import { PriceCollector } from './collectors/price.js';
import { DerivativesCollector } from './collectors/derivatives.js';
import { SentimentCollector } from './collectors/sentiment.js';
import { MacroCollector } from './collectors/macro.js';
import { OnChainCollector } from './collectors/onchain.js';
import { runIndicatorEngine } from './engine/engine.js';
import { SignalEngine } from './engine/signal.js';
import { tradeJournalRepository } from './db/repositories/journal.js';
import { statusService } from './utils/status.js';
import { portfolioRepository } from './db/repositories/portfolio.js';
import { candleRepository } from './db/repositories/candles.js';
import cron from 'node-cron';

async function bootstrap() {
    logger.info('🚀 Starting CryptoScope Service');

    try {
        // 1. Initialize DB
        initDb();

        // 2. Log Performance Stats
        const stats = tradeJournalRepository.getPerformanceStats();
        if (stats) {
            logger.info(
                { totalTrades: stats.totalTrades, wins: stats.wins, totalPnl: stats.totalPnl, avgPnlPct: stats.avgPnlPct },
                'Current Performance Stats'
            );
        }

        // 3. Initial Collection (synchronous for price data to ensure indicators have data)
        logger.info('Performing initial boot data collection...');

        for (const asset of config.trading.assets) {
            await new PriceCollector(asset, '1h').collect();
            await new DerivativesCollector(asset).collect();
        }

        await new SentimentCollector().collect();
        await new MacroCollector().collect();
        await new OnChainCollector().collect();

        // 3. Initial Indicator Calculation
        await runIndicatorEngine();
        statusService.updateStatus('Indicator Engine', 'SUCCESS');

        // 4. Initial Signal Evaluation
        const signalEngine = new SignalEngine();
        await signalEngine.run();
        statusService.updateStatus('Signal Engine', 'SUCCESS');

        // 5. Setup Scheduler
        logger.info('Setting up execution schedules...');

        // Price collection: Every hour
        const priceJob = cron.schedule(config.scheduler.priceCron, async () => {
            for (const asset of config.trading.assets) {
                await new PriceCollector(asset, '1h').collect();
            }
            // Recalculate indicators after price update
            try {
                await runIndicatorEngine();
                statusService.updateStatus('Indicator Engine', 'SUCCESS');

                // Evaluate signals after indicators are ready
                await new SignalEngine().run();
                statusService.updateStatus('Signal Engine', 'SUCCESS');
            } catch (error: any) {
                logger.error({ err: error.message }, 'Engine cycle failed');
                statusService.updateStatus('Engine Cycle', 'FAILURE', error.message);
            }
        });

        // Derivatives: Every 4 hours
        const derivativesJob = cron.schedule('0 */4 * * *', async () => {
            for (const asset of config.trading.assets) {
                await new DerivativesCollector(asset).collect();
            }
        });

        // Sentiment: Every 8 hours
        const sentimentJob = cron.schedule('0 */8 * * *', async () => {
            await new SentimentCollector().collect();
        });

        // On-Chain: 6 AM Daily
        const onchainJob = cron.schedule('0 6 * * *', async () => {
            await new OnChainCollector().collect();
        });

        // Macro: 7 AM Daily
        const macroJob = cron.schedule('0 7 * * *', async () => {
            await new MacroCollector().collect();
        });

        // Portfolio Snapshot: 9 AM Daily
        const snapshotJob = cron.schedule('0 9 * * *', async () => {
            logger.info('Taking daily portfolio snapshot');
            const balances = portfolioRepository.getAllBalances();
            for (const b of balances) {
                let valueEur = 0;
                if (b.asset === 'EUR') {
                    valueEur = b.amount;
                } else {
                    const candle = candleRepository.getLatest(b.asset, '1h');
                    if (candle) valueEur = b.amount * candle.close;
                }
                portfolioRepository.logHistory(b.asset, b.amount, valueEur);
            }
            logger.info('Daily portfolio snapshot complete');
        });

        // Health Watchdog: Every 15 minutes
        const watchdogJob = cron.schedule('*/15 * * * *', async () => {
            logger.debug('Watchdog heartbeat');
            // Simple log check, in a real env this could check external heartbeats
        });

        // Handle Shutdown
        const shutdown = () => {
            logger.info('Shutting down gracefully...');
            priceJob.stop();
            derivativesJob.stop();
            sentimentJob.stop();
            onchainJob.stop();
            macroJob.stop();
            snapshotJob.stop();
            watchdogJob.stop();
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        logger.info('System fully operational and scheduled');
    } catch (error) {
        logger.fatal({ err: error instanceof Error ? error.message : String(error) }, 'Bootstrap failed');
        process.exit(1);
    }
}

bootstrap();
