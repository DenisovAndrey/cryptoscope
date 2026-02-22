/**
 * Historical Backtest: Full-Year 2025 Performance Analysis
 * 
 * This script fetches hourly candles for BTC and ETH for 2025 (up to now),
 * runs the signal engine at every hourly candle, evaluates each signal
 * against actual future price data, and produces a comprehensive report.
 */
import { SignalEngine } from '../engine/signal.js';
import { IndicatorCalculator } from '../engine/indicators.js';
import { candleRepository } from '../db/repositories/candles.js';
import { indicatorRepository } from '../db/repositories/indicators.js';
import { fetchHistoricalCandles, fetchHistoricalSentiment } from './historicalData.js';
import { logger } from '../utils/logger.js';
import db from '../db/database.js';

interface TradeResult {
    asset: string;
    date: string;
    direction: 'BUY' | 'SELL';
    entryPrice: number;
    stopLoss: number;
    tp1: number;
    tp2: number;
    positionSizePct: number;
    compositeScore: number;
    rationale: string;
    outcome: 'TP1_HIT' | 'TP2_HIT' | 'STOPPED_OUT' | 'EXPIRED';
    pnlR: number;
    actualPriceAfter48h: number;
    actualMovePct: number;
    hoursToOutcome: number;
}

async function fetchAllData(asset: string, startTime: number, endTime: number) {
    console.log(`\n📦 Fetching historical data for ${asset}...`);
    await fetchHistoricalCandles(asset, '1h', startTime, endTime);

    // Calculate indicators
    const candles = db.prepare(`
        SELECT asset, timeframe, open_time as openTime, open, high, low, close, volume, quote_volume as quoteVolume
        FROM candles
        WHERE asset = ? AND timeframe = '1h'
        ORDER BY open_time ASC
    `).all(asset) as any[];

    console.log(`  📊 ${candles.length} candles loaded. Calculating indicators...`);
    const calculator = new IndicatorCalculator(asset, '1h');
    calculator.calculateAndSave(candles);
    console.log(`  ✅ Indicators calculated for ${asset}`);
}

async function evaluateSignals(asset: string, startTime: number, endTime: number): Promise<TradeResult[]> {
    const engine = new SignalEngine();
    const trades: TradeResult[] = [];

    // Get all candle timestamps in the evaluation window
    const candles = db.prepare(`
        SELECT open_time as openTime, close, high, low
        FROM candles
        WHERE asset = ? AND timeframe = '1h' AND open_time >= ? AND open_time <= ?
        ORDER BY open_time ASC
    `).all(asset, startTime, endTime) as any[];

    console.log(`\n🔍 Scanning ${candles.length} hourly candles for ${asset} signals...`);
    let signalCount = 0;
    let lastSignalTime = 0;
    const MIN_GAP_MS = 24 * 60 * 60 * 1000; // Minimum 24h between signals to avoid overlaps

    for (const candle of candles) {
        // Skip if too close to last signal
        if (candle.openTime - lastSignalTime < MIN_GAP_MS) continue;

        const signal = await engine.evaluateAssetAtTime(asset, candle.openTime);

        if (signal && (signal.direction === 'BUY' || signal.direction === 'SELL')) {
            signalCount++;
            lastSignalTime = candle.openTime;

            // Evaluate outcome using actual future data (48h window)
            const futureCandles = db.prepare(`
                SELECT open_time as openTime, high, low, close
                FROM candles
                WHERE asset = ? AND timeframe = '1h' AND open_time > ? AND open_time <= ?
                ORDER BY open_time ASC
            `).all(asset, candle.openTime, candle.openTime + (48 * 60 * 60 * 1000)) as any[];

            let outcome: TradeResult['outcome'] = 'EXPIRED';
            let pnlR = 0;
            let hoursToOutcome = 48;
            const entryPrice = candle.close;

            for (let i = 0; i < futureCandles.length; i++) {
                const fc = futureCandles[i];
                const hours = (fc.openTime - candle.openTime) / (60 * 60 * 1000);

                if (signal.direction === 'BUY') {
                    if (fc.low <= signal.stopLoss) {
                        outcome = 'STOPPED_OUT';
                        pnlR = -1;
                        hoursToOutcome = hours;
                        break;
                    }
                    if (fc.high >= signal.takeProfit2) {
                        outcome = 'TP2_HIT';
                        pnlR = 3; // Updated to 3R target
                        hoursToOutcome = hours;
                        break;
                    }
                    if (fc.high >= signal.takeProfit1) {
                        outcome = 'TP1_HIT';
                        pnlR = 2; // Using 2R target
                        hoursToOutcome = hours;
                        break;
                    }
                } else { // SELL
                    if (fc.high >= signal.stopLoss) {
                        outcome = 'STOPPED_OUT';
                        pnlR = -1;
                        hoursToOutcome = hours;
                        break;
                    }
                    if (fc.low <= signal.takeProfit2) {
                        outcome = 'TP2_HIT';
                        pnlR = 3; // Updated to 3R target
                        hoursToOutcome = hours;
                        break;
                    }
                    if (fc.low <= signal.takeProfit1) {
                        outcome = 'TP1_HIT';
                        pnlR = 2;
                        hoursToOutcome = hours;
                        break;
                    }
                }
            }

            // Calculate actual price move after 48h
            const last48h = futureCandles[futureCandles.length - 1];
            const actualPriceAfter48h = last48h ? last48h.close : entryPrice;
            const actualMovePct = ((actualPriceAfter48h - entryPrice) / entryPrice) * 100;

            trades.push({
                asset,
                date: new Date(candle.openTime).toISOString().slice(0, 16),
                direction: signal.direction,
                entryPrice,
                stopLoss: signal.stopLoss,
                tp1: signal.takeProfit1,
                tp2: signal.takeProfit2,
                positionSizePct: signal.positionSizePct,
                compositeScore: signal.compositeScore,
                rationale: signal.rationale,
                outcome,
                pnlR,
                actualPriceAfter48h,
                actualMovePct: Math.round(actualMovePct * 100) / 100,
                hoursToOutcome
            });
        }
    }

    console.log(`  📈 Found ${signalCount} signals for ${asset}`);
    return trades;
}

function generateReport(allTrades: TradeResult[]) {
    console.log('\n' + '═'.repeat(80));
    console.log('  📊 CRYPTOSCOPE HISTORICAL BACKTEST REPORT — 2025');
    console.log('═'.repeat(80));

    for (const asset of ['BTC', 'ETH']) {
        const trades = allTrades.filter(t => t.asset === asset);
        if (trades.length === 0) {
            console.log(`\n--- ${asset}: No signals generated ---`);
            continue;
        }

        const buys = trades.filter(t => t.direction === 'BUY');
        const sells = trades.filter(t => t.direction === 'SELL');
        const tp1Hits = trades.filter(t => t.outcome === 'TP1_HIT');
        const tp2Hits = trades.filter(t => t.outcome === 'TP2_HIT');
        const stops = trades.filter(t => t.outcome === 'STOPPED_OUT');
        const expired = trades.filter(t => t.outcome === 'EXPIRED');
        const winners = [...tp1Hits, ...tp2Hits];
        const totalPnlR = trades.reduce((s, t) => s + t.pnlR, 0);
        const winRate = trades.length > 0 ? (winners.length / (winners.length + stops.length)) * 100 : 0;
        const avgHoursToOutcome = trades.reduce((s, t) => s + t.hoursToOutcome, 0) / trades.length;

        // Correct direction accuracy
        const correctDirection = trades.filter(t => {
            if (t.direction === 'BUY' && t.actualMovePct > 0) return true;
            if (t.direction === 'SELL' && t.actualMovePct < 0) return true;
            return false;
        });
        const directionAccuracy = (correctDirection.length / trades.length) * 100;

        console.log(`\n${'─'.repeat(80)}`);
        console.log(`  ${asset} SUMMARY`);
        console.log(`${'─'.repeat(80)}`);
        console.log(`  Total Signals:      ${trades.length} (${buys.length} BUY, ${sells.length} SELL)`);
        console.log(`  TP1 Hits:           ${tp1Hits.length} (+2R each)`);
        console.log(`  TP2 Hits:           ${tp2Hits.length} (+3R each)`);
        console.log(`  Stopped Out:        ${stops.length} (-1R each)`);
        console.log(`  Expired (no fill):  ${expired.length} (0R)`);
        console.log(`  Win Rate:           ${winRate.toFixed(1)}%`);
        console.log(`  Direction Accuracy: ${directionAccuracy.toFixed(1)}%`);
        console.log(`  Total PnL:          ${totalPnlR > 0 ? '+' : ''}${totalPnlR.toFixed(1)}R`);
        console.log(`  Avg Time to Outcome:${avgHoursToOutcome.toFixed(1)}h`);

        // Monthly breakdown
        console.log(`\n  Monthly Breakdown:`);
        const byMonth = new Map<string, TradeResult[]>();
        trades.forEach(t => {
            const month = t.date.slice(0, 7);
            if (!byMonth.has(month)) byMonth.set(month, []);
            byMonth.get(month)!.push(t);
        });

        console.log(`  ${'Month'.padEnd(10)} ${'Signals'.padEnd(10)} ${'Wins'.padEnd(8)} ${'Losses'.padEnd(10)} ${'PnL (R)'.padEnd(10)} Win%`);
        for (const [month, mTrades] of [...byMonth.entries()].sort()) {
            const mWins = mTrades.filter(t => t.outcome === 'TP1_HIT' || t.outcome === 'TP2_HIT').length;
            const mLoss = mTrades.filter(t => t.outcome === 'STOPPED_OUT').length;
            const mPnl = mTrades.reduce((s, t) => s + t.pnlR, 0);
            const mWinRate = (mWins + mLoss) > 0 ? ((mWins / (mWins + mLoss)) * 100).toFixed(0) : 'N/A';
            console.log(`  ${month.padEnd(10)} ${String(mTrades.length).padEnd(10)} ${String(mWins).padEnd(8)} ${String(mLoss).padEnd(10)} ${(mPnl > 0 ? '+' : '') + mPnl.toFixed(1).padEnd(9)} ${mWinRate}%`);
        }

        // Trade log
        console.log(`\n  Trade Log:`);
        console.log(`  ${'Date'.padEnd(18)} ${'Dir'.padEnd(6)} ${'Entry'.padEnd(12)} ${'Outcome'.padEnd(14)} ${'PnL'.padEnd(8)} ${'48h Move'.padEnd(10)} ${'Hours'.padEnd(6)} Score`);
        for (const t of trades) {
            const pnlStr = (t.pnlR > 0 ? '+' : '') + t.pnlR.toFixed(1) + 'R';
            const moveStr = (t.actualMovePct > 0 ? '+' : '') + t.actualMovePct.toFixed(2) + '%';
            const outcomeIcon = t.outcome === 'TP1_HIT' || t.outcome === 'TP2_HIT' ? '✅' : t.outcome === 'STOPPED_OUT' ? '❌' : '⏸️';
            console.log(`  ${t.date.padEnd(18)} ${t.direction.padEnd(6)} $${t.entryPrice.toFixed(0).padEnd(11)} ${outcomeIcon} ${t.outcome.padEnd(12)} ${pnlStr.padEnd(8)} ${moveStr.padEnd(10)} ${String(t.hoursToOutcome).padEnd(6)} ${(t.compositeScore * 100).toFixed(0)}%`);
        }
    }

    // Portfolio simulation
    console.log(`\n${'═'.repeat(80)}`);
    console.log('  💰 PORTFOLIO SIMULATION (Starting: €2,000 | Risk: 2% per trade)');
    console.log(`${'═'.repeat(80)}`);

    let portfolio = 2000;
    const riskPct = 0.02;
    let peak = portfolio;
    let maxDrawdown = 0;

    const sortedTrades = [...allTrades].sort((a, b) => a.date.localeCompare(b.date));

    for (const trade of sortedTrades) {
        const riskAmount = portfolio * riskPct;
        const pnl = riskAmount * trade.pnlR;
        portfolio += pnl;
        if (portfolio > peak) peak = portfolio;
        const dd = ((peak - portfolio) / peak) * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;
    }

    const totalReturnPct = ((portfolio - 2000) / 2000 * 100);
    console.log(`  Starting Balance:   €2,000.00`);
    console.log(`  Final Balance:      €${portfolio.toFixed(2)}`);
    console.log(`  Total Return:       ${totalReturnPct > 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`);
    console.log(`  Max Drawdown:       ${maxDrawdown.toFixed(2)}%`);
    console.log(`  Total Trades:       ${sortedTrades.length}`);
    console.log(`${'═'.repeat(80)}`);

    return {
        totalTrades: sortedTrades.length,
        finalBalance: portfolio,
        totalReturnPct,
        maxDrawdown,
        allTrades: sortedTrades
    };
}

async function main() {
    console.log('🚀 CryptoScope Historical Backtest — 2024');
    console.log('Using FIXED engine (ADX Filter + Directional Alignment)\n');

    // Define test period: Full Year 2024
    const START = new Date('2024-01-01T00:00:00Z').getTime();
    const END = new Date('2024-12-31T23:59:59Z').getTime();
    const LOOKBACK_MS = 250 * 60 * 60 * 1000; // 250 hours for EMA200 warmup

    // Clean slate for backtest
    db.prepare("DELETE FROM candles").run();
    db.prepare("DELETE FROM indicators").run();
    db.prepare("DELETE FROM signals").run();

    // 1. Fetch sentiment data
    console.log('📦 Fetching historical sentiment data...');
    await fetchHistoricalSentiment();

    // 2. Fetch and process each asset
    const allTrades: TradeResult[] = [];

    for (const asset of ['BTC', 'ETH']) {
        await fetchAllData(asset, START - LOOKBACK_MS, END);
        const trades = await evaluateSignals(asset, START, END);
        allTrades.push(...trades);
    }

    // 3. Generate report
    const summary = generateReport(allTrades);

    // 4. Output JSON for artifact generation
    const reportJson = JSON.stringify(summary, null, 2);
    const fs = await import('fs');
    fs.writeFileSync('./data/backtest_report_2025.json', reportJson);
    console.log('\n📄 Full report saved to data/backtest_report_2025.json');

    process.exit(0);
}

main().catch(err => {
    console.error('Backtest failed:', err);
    process.exit(1);
});
