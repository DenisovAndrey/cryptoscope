import db from '../database.js';

export interface IndicatorData {
    asset: string;
    timeframe: string;
    timestamp: number;
    name: string;
    value: number;
}

export const indicatorRepository = {
    saveMany(data: IndicatorData[]) {
        const insert = db.prepare(`
      INSERT OR REPLACE INTO indicators (asset, timeframe, timestamp, name, value)
      VALUES (?, ?, ?, ?, ?)
    `);

        const transaction = db.transaction((items: IndicatorData[]) => {
            for (const item of items) {
                insert.run(item.asset, item.timeframe, item.timestamp, item.name, item.value);
            }
        });

        transaction(data);
    },

    getLatest(asset: string, timeframe: string, name: string): IndicatorData | undefined {
        return db.prepare(`
      SELECT asset, timeframe, timestamp, name, value
      FROM indicators
      WHERE asset = ? AND timeframe = ? AND name = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(asset, timeframe, name) as IndicatorData | undefined;
    },

    getAllForTimestamp(asset: string, timeframe: string, timestamp: number): IndicatorData[] {
        return db.prepare(`
      SELECT asset, timeframe, timestamp, name, value
      FROM indicators
      WHERE asset = ? AND timeframe = ? AND timestamp = ?
    `).all(asset, timeframe, timestamp) as IndicatorData[];
    },

    getForTimestamp(asset: string, timeframe: string, name: string, timestamp: number): IndicatorData | undefined {
        return db.prepare(`
      SELECT asset, timeframe, timestamp, name, value
      FROM indicators
      WHERE asset = ? AND timeframe = ? AND name = ? AND timestamp = ?
    `).get(asset, timeframe, name, timestamp) as IndicatorData | undefined;
    }
};
