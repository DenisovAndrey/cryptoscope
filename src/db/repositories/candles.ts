import db from '../database.js';

export interface Candle {
    asset: string;
    timeframe: string;
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    quoteVolume?: number;
}

export const candleRepository = {
    saveMany(candles: Candle[]) {
        const insert = db.prepare(`
      INSERT OR IGNORE INTO candles (asset, timeframe, open_time, open, high, low, close, volume, quote_volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const transaction = db.transaction((data: Candle[]) => {
            for (const candle of data) {
                insert.run(
                    candle.asset,
                    candle.timeframe,
                    candle.openTime,
                    candle.open,
                    candle.high,
                    candle.low,
                    candle.close,
                    candle.volume,
                    candle.quoteVolume ?? null
                );
            }
        });

        transaction(candles);
    },

    getLatest(asset: string, timeframe: string): Candle | undefined {
        const row = db.prepare(`
      SELECT asset, timeframe, open_time as openTime, open, high, low, close, volume, quote_volume as quoteVolume
      FROM candles
      WHERE asset = ? AND timeframe = ?
      ORDER BY open_time DESC
      LIMIT 1
    `).get(asset, timeframe) as Candle | undefined;
        return row;
    },

    getAll(asset: string, timeframe: string, limit = 500): Candle[] {
        return db.prepare(`
      SELECT asset, timeframe, open_time as openTime, open, high, low, close, volume, quote_volume as quoteVolume
      FROM candles
      WHERE asset = ? AND timeframe = ?
      ORDER BY open_time DESC
      LIMIT ?
    `).all(asset, timeframe, limit) as Candle[];
    },

    getByTimestamp(asset: string, timeframe: string, timestamp: number): Candle | undefined {
        return db.prepare(`
      SELECT asset, timeframe, open_time as openTime, open, high, low, close, volume, quote_volume as quoteVolume
      FROM candles
      WHERE asset = ? AND timeframe = ? AND open_time = ?
    `).get(asset, timeframe, timestamp) as Candle | undefined;
    }
};
