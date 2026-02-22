import db from '../database.js';

export interface OnChainData {
    asset: string;
    timestamp: number;
    metric: string;
    value: number;
    source: string;
}

export const onChainRepository = {
    saveMany(data: OnChainData[]) {
        const insert = db.prepare(`
      INSERT OR REPLACE INTO onchain (asset, timestamp, metric, value, source)
      VALUES (?, ?, ?, ?, ?)
    `);

        const transaction = db.transaction((items: OnChainData[]) => {
            for (const item of items) {
                insert.run(item.asset, item.timestamp, item.metric, item.value, item.source);
            }
        });

        transaction(data);
    },

    getLatestByMetric(asset: string, metric: string): OnChainData | undefined {
        return db.prepare(`
      SELECT asset, timestamp, metric, value, source
      FROM onchain
      WHERE asset = ? AND metric = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(asset, metric) as OnChainData | undefined;
    },

    getAllLatest(asset: string): OnChainData[] {
        return db.prepare(`
      SELECT asset, timestamp, metric, value, source
      FROM onchain
      WHERE asset = ?
      GROUP BY metric
      HAVING MAX(timestamp)
    `).all(asset) as OnChainData[];
    },

    getLatestBefore(asset: string, metric: string, timestamp: number): OnChainData | undefined {
        return db.prepare(`
      SELECT asset, timestamp, metric, value, source
      FROM onchain
      WHERE asset = ? AND metric = ? AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(asset, metric, timestamp) as OnChainData | undefined;
    }
};
