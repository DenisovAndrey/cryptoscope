import { indicatorRepository } from '../db/repositories/indicators.js';

export interface TimingResult {
    timing: 'ENTRY' | 'EXIT' | 'NO_SIGNAL';
    details: any;
}

export class Layer2Engine {
    evaluate(asset: string, timeframe: string, timestamp: number): TimingResult {
        const indicators = indicatorRepository.getAllForTimestamp(asset, timeframe, timestamp);

        const rsi = indicators.find(i => i.name === 'rsi_14')?.value;
        const macdHist = indicators.find(i => i.name === 'macd_histogram')?.value;
        const bbUpper = indicators.find(i => i.name === 'bb_upper')?.value;
        const bbLower = indicators.find(i => i.name === 'bb_lower')?.value;

        let timing: 'ENTRY' | 'EXIT' | 'NO_SIGNAL' = 'NO_SIGNAL';
        const details: any = { rsi, macdHist };

        if (rsi && macdHist) {
            // Bullish Entry: RSI crosses above 30 or MACD flip while RSI < 60
            if (rsi < 40 && macdHist > 0) {
                timing = 'ENTRY';
            }
            // Bearish Exit: RSI > 70 or MACD flip negative
            if (rsi > 70 || macdHist < 0) {
                timing = 'EXIT';
            }
        }

        return { timing, details };
    }
}
