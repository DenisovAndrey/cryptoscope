import db from '../database.js';

export interface SentimentData {
    timestamp: number;
    metric: string;
    value: string;
    source: string;
}

export const sentimentRepository = {
    saveMany(data: SentimentData[]) {
        const insert = db.prepare(`
      INSERT OR REPLACE INTO sentiment (timestamp, metric, value, source)
      VALUES (?, ?, ?, ?)
    `);

        const transaction = db.transaction((items: SentimentData[]) => {
            for (const item of items) {
                insert.run(item.timestamp, item.metric, item.value, item.source);
            }
        });

        transaction(data);
    },

    getLatestByMetric(metric: string): SentimentData | undefined {
        return db.prepare(`
      SELECT timestamp, metric, value, source
      FROM sentiment
      WHERE metric = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(metric) as SentimentData | undefined;
    },

    getAllLatest(): SentimentData[] {
        return db.prepare(`
      SELECT timestamp, metric, value, source
      FROM sentiment
      GROUP BY metric
      HAVING MAX(timestamp)
    `).all() as SentimentData[];
    },

    getLatestBefore(metric: string, timestamp: number): SentimentData | undefined {
        return db.prepare(`
      SELECT timestamp, metric, value, source
      FROM sentiment
      WHERE metric = ? AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(metric, timestamp) as SentimentData | undefined;
    }
};
