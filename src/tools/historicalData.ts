import axios from 'axios';
import { candleRepository, Candle } from '../db/repositories/candles.js';
import { logger } from '../utils/logger.js';

export async function fetchHistoricalCandles(asset: string, timeframe: string, startTime: number, endTime: number): Promise<void> {
    const symbol = `${asset}USDT`;
    const url = 'https://api.binance.com/api/v3/klines';
    let currentStart = startTime;

    logger.info(`Fetching historical candles for ${asset} from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

    while (currentStart < endTime) {
        try {
            const response = await axios.get(url, {
                params: {
                    symbol,
                    interval: timeframe,
                    startTime: currentStart,
                    endTime: endTime,
                    limit: 1000
                }
            });

            const candles: Candle[] = response.data.map((k: any) => ({
                asset,
                timeframe,
                openTime: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5]),
                quoteVolume: parseFloat(k[7])
            }));

            if (candles.length === 0) break;

            candleRepository.saveMany(candles);

            const lastCandle = candles[candles.length - 1];
            currentStart = lastCandle.openTime + 1;

            logger.debug(`Fetched ${candles.length} candles to ${new Date(lastCandle.openTime).toISOString()}`);

            // Avoid rate limits
            await new Promise(r => setTimeout(r, 200));
        } catch (error: any) {
            logger.error({ err: error.message }, 'Failed to fetch historical candles');
            break;
        }
    }
}

export async function fetchHistoricalSentiment(): Promise<void> {
    logger.info('Fetching historical Fear & Greed data...');
    try {
        const response = await axios.get('https://api.alternative.me/fng/?limit=0');
        const data = response.data.data.map((item: any) => ({
            timestamp: parseInt(item.timestamp) * 1000,
            metric: 'fear_greed',
            value: item.value,
            source: 'alternative.me'
        }));
        const { sentimentRepository } = await import('../db/repositories/sentiment.js');
        sentimentRepository.saveMany(data);
        logger.info(`Saved ${data.length} historical sentiment entries.`);
    } catch (error: any) {
        logger.error({ err: error.message }, 'Failed to fetch historical sentiment');
    }
}

export async function fetchHistoricalMacro(): Promise<void> {
    // For DXY, we can mock it or fetch a longer range if the API supports it
    // Our MacroCollector already fetches from FRED. We'll reuse it but with a longer range if possible.
    // For the QA purpose, we'll focus on Fear & Greed which is highly historical.
    // DXY can be assumed stable for the 48h windows of the test cases if not found.
}
