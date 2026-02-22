import {
    EMA,
    RSI,
    MACD,
    BollingerBands,
    ATR
} from 'trading-signals';
import { Candle } from '../db/repositories/candles.js';
import { indicatorRepository, IndicatorData } from '../db/repositories/indicators.js';
import { logger } from '../utils/logger.js';

export class IndicatorCalculator {
    constructor(private asset: string, private timeframe: string) { }

    public calculateAndSave(candles: Candle[]) {
        if (candles.length === 0) return;

        // Use sorted candles (oldest first for trading-signals)
        const sortedCandles = [...candles].sort((a, b) => a.openTime - b.openTime);

        // Initialize indicators
        const ema20 = new EMA(20);
        const ema50 = new EMA(50);
        const ema200 = new EMA(200);
        const rsi14 = new RSI(14);
        const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
        const bb = new BollingerBands(20, 2);
        const atr = new ATR(14);

        const indicatorOutputs: IndicatorData[] = [];

        for (const candle of sortedCandles) {
            const price = candle.close;

            // Update indicators
            ema20.update(price, false);
            ema50.update(price, false);
            ema200.update(price, false);
            rsi14.update(price, false);
            macd.update(price, false);
            bb.update(price, false);
            atr.update({ high: candle.high, low: candle.low, close: candle.close }, false);

            // Only save if matured (some indicators need enough data)
            if (ema20.isStable && ema200.isStable && rsi14.isStable && macd.isStable) {
                const timestamp = candle.openTime;
                const asset = this.asset;
                const timeframe = this.timeframe;

                const results = [
                    { name: 'ema_20', value: Number(ema20.getResult()!.valueOf()) },
                    { name: 'ema_50', value: Number(ema50.getResult()!.valueOf()) },
                    { name: 'ema_200', value: Number(ema200.getResult()!.valueOf()) },
                    { name: 'rsi_14', value: Number(rsi14.getResult()!.valueOf()) },
                    { name: 'macd', value: Number(macd.getResult()!.signal.valueOf()) }, // MACD Signal line
                    { name: 'macd_histogram', value: Number(macd.getResult()!.histogram.valueOf()) },
                    { name: 'bb_upper', value: Number(bb.getResult()!.upper.valueOf()) },
                    { name: 'bb_lower', value: Number(bb.getResult()!.lower.valueOf()) },
                    { name: 'bb_middle', value: Number(bb.getResult()!.middle.valueOf()) },
                    { name: 'atr_14', value: Number(atr.getResult()!.valueOf()) }
                ];

                for (const res of results) {
                    indicatorOutputs.push({
                        asset,
                        timeframe,
                        timestamp,
                        ...res
                    });
                }
            }
        }

        if (indicatorOutputs.length > 0) {
            indicatorRepository.saveMany(indicatorOutputs);
            logger.debug(
                { asset: this.asset, timeframe: this.timeframe, count: indicatorOutputs.length },
                `Calculated and saved indicators`
            );
        }
    }
}
