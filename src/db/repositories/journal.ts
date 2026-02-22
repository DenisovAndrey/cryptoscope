import db from '../database.js';

export interface TradeJournalEntry {
  id?: number;
  signalId: number;
  asset: string;
  direction: string;
  entryTime: number;
  exitTime?: number;
  entryPrice: number;
  exitPrice?: number;
  positionSize: number;
  amount: number;
  pnlEur?: number;
  pnlPct?: number;
  status: 'OPEN' | 'CLOSED';
  notes?: string;
  createdAt?: string;
}

export const tradeJournalRepository = {
  create(entry: TradeJournalEntry) {
    const stmt = db.prepare(`
            INSERT INTO trade_journal (
                signal_id, asset, direction, entry_time, entry_price, 
                position_size, amount, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

    const result = stmt.run(
      entry.signalId,
      entry.asset,
      entry.direction,
      entry.entryTime,
      entry.entryPrice,
      entry.positionSize,
      entry.amount,
      entry.status,
      entry.notes || ''
    );

    return result.lastInsertRowid;
  },

  close(id: number, exitTime: number, exitPrice: number, pnlEur: number, pnlPct: number) {
    db.prepare(`
            UPDATE trade_journal 
            SET exit_time = ?, exit_price = ?, pnl_eur = ?, pnl_pct = ?, status = 'CLOSED'
            WHERE id = ?
        `).run(exitTime, exitPrice, pnlEur, pnlPct, id);
  },

  getOpenTrades() {
    return db.prepare("SELECT * FROM trade_journal WHERE status = 'OPEN'").all() as any[];
  },

  getPerformanceStats() {
    return db.prepare(`
            SELECT 
                COUNT(*) as totalTrades,
                SUM(CASE WHEN pnl_eur > 0 THEN 1 ELSE 0 END) as wins,
                SUM(pnl_eur) as totalPnl,
                AVG(pnl_pct) as avgPnlPct
            FROM trade_journal
            WHERE status = 'CLOSED'
        `).get() as { totalTrades: number, wins: number, totalPnl: number, avgPnlPct: number };
  },

  getRecentTrades(limit: number = 5) {
    return db.prepare(`
            SELECT * FROM trade_journal 
            ORDER BY created_at DESC 
            LIMIT ?
        `).all(limit) as any[];
  }
};
