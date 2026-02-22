import db from '../database.js';

export interface Signal {
  id?: number;
  asset: string;
  timestamp: number;
  direction: 'BUY' | 'SELL' | 'NO_TRADE';
  compositeScore: number;
  layer1Direction: string;
  layer1Score: number;
  layer2Timing: string;
  layer2Details: string;
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  positionSizePct: number;
  rationale: string;
  status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED';
}

export const signalRepository = {
  save(signal: Signal) {
    const stmt = db.prepare(`
      INSERT INTO signals (
        asset, timestamp, direction, composite_score, 
        layer1_direction, layer1_score, layer2_timing, layer2_details,
        entry_zone_low, entry_zone_high, stop_loss, take_profit_1, take_profit_2,
        position_size_pct, rationale, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      signal.asset,
      signal.timestamp,
      signal.direction,
      signal.compositeScore,
      signal.layer1Direction,
      signal.layer1Score,
      signal.layer2Timing,
      signal.layer2Details,
      signal.entryZoneLow,
      signal.entryZoneHigh,
      signal.stopLoss,
      signal.takeProfit1,
      signal.takeProfit2,
      signal.positionSizePct,
      signal.rationale,
      signal.status
    );

    return result.lastInsertRowid;
  },

  getLatest(asset: string): Signal | undefined {
    const row = db.prepare(`
      SELECT 
        id, asset, timestamp, direction, composite_score as compositeScore,
        layer1_direction as layer1Direction, layer1_score as layer1Score,
        layer2_timing as layer2Timing, layer2_details as layer2Details,
        entry_zone_low as entryZoneLow, entry_zone_high as entryZoneHigh,
        stop_loss as stopLoss, take_profit_1 as takeProfit1, take_profit_2 as takeProfit2,
        position_size_pct as positionSizePct, rationale, status
      FROM signals
      WHERE asset = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(asset) as Signal | undefined;
    return row;
  },

  getById(id: number): Signal | undefined {
    const row = db.prepare(`
      SELECT 
        id, asset, timestamp, direction, composite_score as compositeScore,
        layer1_direction as layer1Direction, layer1_score as layer1Score,
        layer2_timing as layer2Timing, layer2_details as layer2Details,
        entry_zone_low as entryZoneLow, entry_zone_high as entryZoneHigh,
        stop_loss as stopLoss, take_profit_1 as takeProfit1, take_profit_2 as takeProfit2,
        position_size_pct as positionSizePct, rationale, status
      FROM signals
      WHERE id = ?
    `).get(id) as Signal | undefined;
    return row;
  },

  updateStatus(id: number, status: string) {
    db.prepare('UPDATE signals SET status = ? WHERE id = ?').run(status, id);
  }
};
