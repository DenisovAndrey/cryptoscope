import { candleRepository } from '../db/repositories/candles.js';
import { IndicatorCalculator } from './indicators.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export async function runIndicatorEngine() {
    logger.info('Running Indicator Engine...');

    for (const asset of config.trading.assets) {
        const timeframes = ['1h', '4h', '1d']; // Support multiple even if not fully scheduled yet

        for (const tf of timeframes) {
            const candles = candleRepository.getAll(asset, tf, 1000); // Get enough for stability
            if (candles.length > 0) {
                const calculator = new IndicatorCalculator(asset, tf);
                calculator.calculateAndSave(candles);
            }
        }
    }
}
