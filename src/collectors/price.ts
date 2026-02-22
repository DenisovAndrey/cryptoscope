import axios from 'axios';
import { BaseCollector } from './base.js';
import { candleRepository, Candle } from '../db/repositories/candles.js';
import { logger } from '../utils/logger.js';

export class PriceCollector extends BaseCollector {
    private static BINANCE_BASE = 'https://api.binance.com/api/v3';

    constructor(private asset: string, private timeframe: string = '1h') {
        super(`PriceCollector-${asset}-${timeframe}`);
    }

    async collect(): Promise<void> {
        await this.runCollection(async () => {
            const symbol = `${this.asset}USDT`;
            const url = `${PriceCollector.BINANCE_BASE}/klines`;

            const response = await axios.get(url, {
                params: {
                    symbol,
                    interval: this.timeframe,
                    limit: 500
                }
            });

            const candles: Candle[] = response.data.map((k: any) => ({
                asset: this.asset,
                timeframe: this.timeframe,
                openTime: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                quoteVolume: parseFloat(k[7])
            }));

            candleRepository.saveMany(candles);
            logger.debug(
                { asset: this.asset, count: candles.length },
                `Saved candles from Binance`
            );
        });
    }
}
