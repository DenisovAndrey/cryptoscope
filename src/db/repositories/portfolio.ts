import db from '../database.js';

export interface PortfolioBalance {
    asset: string;
    amount: number;
    updatedAt?: string;
}

export interface PortfolioHistoryEntry {
    timestamp: number;
    asset: string;
    amount: number;
    valueEur?: number;
}

export const portfolioRepository = {
    setBalance(asset: string, amount: number) {
        const result = db.prepare(`
            INSERT OR REPLACE INTO portfolio (asset, amount, updated_at)
            VALUES (?, ?, datetime('now'))
        `).run(asset.toUpperCase(), amount);

        // Automatically log to history when setting balance
        this.logHistory(asset, amount);

        return result;
    },

    getBalance(asset: string): number {
        const row = db.prepare(`
            SELECT amount FROM portfolio WHERE asset = ?
        `).get(asset.toUpperCase()) as { amount: number } | undefined;
        return row ? row.amount : 0;
    },

    getAllBalances(): PortfolioBalance[] {
        return db.prepare(`
            SELECT asset, amount, updated_at as updatedAt FROM portfolio
        `).all() as PortfolioBalance[];
    },

    logHistory(asset: string, amount: number, valueEur?: number) {
        return db.prepare(`
            INSERT INTO portfolio_history (timestamp, asset, amount, value_eur)
            VALUES (?, ?, ?, ?)
        `).run(Date.now(), asset.toUpperCase(), amount, valueEur || null);
    },

    getHistory(asset: string, limit: number = 30): PortfolioHistoryEntry[] {
        return db.prepare(`
            SELECT timestamp, asset, amount, value_eur as valueEur 
            FROM portfolio_history 
            WHERE asset = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `).all(asset.toUpperCase(), limit) as PortfolioHistoryEntry[];
    }
};
