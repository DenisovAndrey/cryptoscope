import db from '../database.js';

export interface MacroData {
    timestamp: number;
    metric: string;
    value: number;
    source: string;
}

export const macroRepository = {
    saveMany(data: MacroData[]) {
        const insert = db.prepare(`
      INSERT OR REPLACE INTO macro (timestamp, metric, value, source)
      VALUES (?, ?, ?, ?)
    `);

        const transaction = db.transaction((items: MacroData[]) => {
            for (const item of items) {
                insert.run(item.timestamp, item.metric, item.value, item.source);
            }
        });

        transaction(data);
    },

    getLatestByMetric(metric: string): MacroData | undefined {
        return db.prepare(`
      SELECT timestamp, metric, value, source
      FROM macro
      WHERE metric = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(metric) as MacroData | undefined;
    },

    getAllLatest(): MacroData[] {
        return db.prepare(`
      SELECT timestamp, metric, value, source
      FROM macro
      GROUP BY metric
      HAVING MAX(timestamp)
    `).all() as MacroData[];
    },

    getLatestBefore(metric: string, timestamp: number): MacroData | undefined {
        return db.prepare(`
      SELECT timestamp, metric, value, source
      FROM macro
      WHERE metric = ? AND timestamp <= ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(metric, timestamp) as MacroData | undefined;
    }
};
