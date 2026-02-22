import { indicatorRepository } from '../db/repositories/indicators.js';
import { config } from '../config.js';

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
            // Bullish Entry: RSI pullback in non-overbought zone + positive MACD momentum
            if (rsi < config.trading.l2RsiBullCeiling && macdHist > 0) {
                timing = 'ENTRY';
            }
            // Bearish Entry: RSI elevated + negative MACD momentum (enables SELL signals)
            if (rsi > config.trading.l2RsiBearFloor && macdHist < 0) {
                timing = 'ENTRY';
            }
            // Overbought/Oversold Exit signals
            if (rsi > 80 || rsi < 15) {
                timing = 'EXIT';
            }
        }

        return { timing, details };
    }
}
