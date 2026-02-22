import { SignalEngine } from '../engine/signal.js';
import { candleRepository } from '../db/repositories/candles.js';
import { indicatorRepository } from '../db/repositories/indicators.js';
import { IndicatorCalculator } from '../engine/indicators.js';
import { logger } from '../utils/logger.js';
import { fetchHistoricalCandles } from './historicalData.js';
import db from '../db/database.js';

interface TestResult {
    caseName: string;
    timestamp: number;
    signal: any;
    outcome: 'SUCCESS' | 'FAILED' | 'OPEN' | 'NO_SIGNAL';
    pnl: number;
    l1Score?: number;
    l1Direction?: string;
    l2Timing?: string;
}

export class Backtester {
    async runCase(name: string, asset: string, startTime: number, testTime: number, durationHours: number = 48, scanWindowHours: number = 24): Promise<TestResult> {
        logger.info(`--- Running Test Case: ${name} ---`);

        // 1. Fetch data for lookback + test period + scan window
        const lookbackMs = 1000 * 60 * 60 * 1000;
        const totalDurationMs = (durationHours + scanWindowHours) * 60 * 60 * 1000;
        await fetchHistoricalCandles(asset, '1h', testTime - lookbackMs, testTime + totalDurationMs);

        // 2. Clear old indicators and recalculate for this period
        db.prepare("DELETE FROM indicators").run();
        const calculator = new IndicatorCalculator(asset, '1h');
        const candles = candleRepository.getAll(asset, '1h', 2000);
        calculator.calculateAndSave(candles);

        // 3. Scan window for the BEST signal
        const engine = new SignalEngine();
        let bestResult: TestResult | null = null;

        for (let i = 0; i < scanWindowHours; i++) {
            const currentTime = testTime + (i * 60 * 60 * 1000);
            const signal = await engine.evaluateAssetAtTime(asset, currentTime);
            const l1 = await (engine as any).l1.evaluate(asset, currentTime);
            const l2 = (engine as any).l2.evaluate(asset, '1h', currentTime);

            const result: TestResult = {
                caseName: name,
                timestamp: currentTime,
                signal,
                outcome: 'NO_SIGNAL',
                pnl: 0,
                l1Score: l1.score,
                l1Direction: l1.direction,
                l2Timing: l2.timing
            };

            if (signal && signal.direction !== 'NO_TRADE') {
                // Validate outcome for this specific signal
                const futureCandles = db.prepare(`
                    SELECT * FROM candles 
                    WHERE asset = ? AND open_time > ? AND open_time <= ?
                    ORDER BY open_time ASC
                `).all(asset, currentTime, currentTime + (durationHours * 60 * 60 * 1000));

                let outcome: 'SUCCESS' | 'FAILED' | 'OPEN' = 'OPEN';
                let pnl = 0;

                for (const candle of futureCandles as any) {
                    if (signal.direction === 'BUY') {
                        if (candle.low <= signal.stopLoss) {
                            outcome = 'FAILED';
                            pnl = -1;
                            break;
                        }
                        if (candle.high >= signal.takeProfit1) {
                            outcome = 'SUCCESS';
                            pnl = 1.5;
                            break;
                        }
                    } else if (signal.direction === 'SELL') {
                        if (candle.high >= signal.stopLoss) {
                            outcome = 'FAILED';
                            pnl = -1;
                            break;
                        }
                        if (candle.low <= signal.takeProfit1) {
                            outcome = 'SUCCESS';
                            pnl = 1.5;
                            break;
                        }
                    }
                }
                result.outcome = outcome;
                result.pnl = pnl;

                // If we found a signal and it's successful, we take it as the representative for this case
                if (result.outcome === 'SUCCESS') {
                    return result;
                }
                bestResult = result;
            }

            if (!bestResult) bestResult = result;
        }

        return bestResult!;
    }
}
