import db from '../database.js';

export interface DerivativesData {
    asset: string;
    timestamp: number;
    metric: string;
    value: number;
    source?: string;
}

export const derivativesRepository = {
    saveMany(data: DerivativesData[]) {
        const insert = db.prepare(`
      INSERT OR IGNORE INTO derivatives (asset, timestamp, metric, value, source)
      VALUES (?, ?, ?, ?, ?)
    `);

        const transaction = db.transaction((items: DerivativesData[]) => {
            for (const item of items) {
                insert.run(item.asset, item.timestamp, item.metric, item.value, item.source ?? 'binance');
            }
        });

        transaction(data);
    }
};
