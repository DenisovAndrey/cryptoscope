import { Layer1Engine } from './layer1.js';
import { Layer2Engine } from './layer2.js';
import { Layer3Engine } from './layer3.js';
import { candleRepository } from '../db/repositories/candles.js';
import { indicatorRepository } from '../db/repositories/indicators.js';
import { signalRepository, Signal } from '../db/repositories/signals.js';
import { telegramService } from '../utils/telegram.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export class SignalEngine {
    private l1 = new Layer1Engine();
    private l2 = new Layer2Engine();
    private l3 = new Layer3Engine();

    async run() {
        logger.info('Running Signal Engine...');

        for (const asset of config.trading.assets) {
            const latestCandle = candleRepository.getLatest(asset, '1h');
            if (!latestCandle) continue;

            const signal = await this.evaluateAssetAtTime(asset, latestCandle.openTime);
            if (signal) {
                const signalId = signalRepository.save(signal) as number;
                logger.info({ asset, direction: signal.direction, signalId }, '🔥🔥 Signal Generated!');
                await telegramService.sendSignal(signal, signalId);
            } else {
                logger.debug({ asset }, 'No trade signal generated');
            }
        }
    }

    async evaluateAssetAtTime(asset: string, timestamp: number): Promise<Signal | null> {
        const candle = candleRepository.getByTimestamp(asset, '1h', timestamp);
        if (!candle) return null;

        // 0. Trend Strength Gate
        const adx = indicatorRepository.getForTimestamp(asset, '1h', 'adx_14', timestamp);
        if (!adx || adx.value < 18) {
            logger.debug({ asset, adx: adx?.value }, 'Signal suppressed: Low trend strength');
            return null;
        }

        // 1. Directional Evaluation
        const l1Result = await this.l1.evaluate(asset, timestamp);
        logger.debug({ asset, l1: l1Result }, 'L1 Evaluation Result');

        // 2. Timing Evaluation
        const l2Result = this.l2.evaluate(asset, '1h', timestamp);
        logger.debug({ asset, l2: l2Result }, 'L2 Evaluation Result');

        // 3. Risk Calculation (only if Direction + Timing align)
        let direction: 'BUY' | 'SELL' | null = null;
        if (l1Result.direction === 'BULLISH' && l2Result.timing === 'BULL_ENTRY') {
            direction = 'BUY';
        } else if (l1Result.direction === 'BEARISH' && l2Result.timing === 'BEAR_ENTRY') {
            direction = 'SELL';
        }

        if (direction) {
            // Fixed: use indicatorRepository.getForTimestamp instead of getLatest
            const atr = indicatorRepository.getForTimestamp(asset, '1h', 'atr_14', timestamp)?.value || 0;
            if (atr === 0) return null;

            const risk = this.l3.calculate(asset, candle.close, atr, direction);

            return {
                asset,
                timestamp,
                direction,
                compositeScore: l1Result.score,
                layer1Direction: l1Result.direction,
                layer1Score: l1Result.score,
                layer2Timing: l2Result.timing,
                layer2Details: JSON.stringify(l2Result.details),
                entryZoneLow: candle.close * 0.995,
                entryZoneHigh: candle.close * 1.005,
                stopLoss: risk.stopLoss,
                takeProfit1: risk.takeProfit1,
                takeProfit2: risk.takeProfit2,
                positionSizePct: risk.positionSizePct,
                rationale: l1Result.reason,
                status: 'ACTIVE'
            };
        }

        return null;
    }
}
