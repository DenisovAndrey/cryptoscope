import { Backtester } from './backtest.js';
import { logger } from '../utils/logger.js';
import db from '../db/database.js';

async function runQA() {
    const backtester = new Backtester();
    const results = [];

    const testCases = [
        { name: 'Strong Bullish Trend (Q4 2023)', asset: 'BTC', testTime: new Date('2023-10-25T12:00:00Z').getTime() },
        { name: 'Strong Bearish Trend (LUNA Crash)', asset: 'BTC', testTime: new Date('2022-05-10T00:00:00Z').getTime() },
        { name: 'FTX Market Crash (Nov 2022)', asset: 'BTC', testTime: new Date('2022-11-08T12:00:00Z').getTime() },
        { name: 'Sideways Accumulation (Summer 2023)', asset: 'BTC', testTime: new Date('2023-07-15T00:00:00Z').getTime() },
        { name: 'ETF Approval Rally (Jan 2024)', asset: 'BTC', testTime: new Date('2024-01-10T12:00:00Z').getTime() },
        { name: 'ETH Merge Momentum (Sep 2022)', asset: 'ETH', testTime: new Date('2022-09-14T00:00:00Z').getTime() },
        { name: 'Bull Market Top Exhaustion (Mar 2024)', asset: 'BTC', testTime: new Date('2024-03-14T12:00:00Z').getTime() },
        { name: 'Oversold Relief Rally (Jan 2023)', asset: 'BTC', testTime: new Date('2023-01-08T00:00:00Z').getTime() },
        { name: 'Macro Fear (Rate Hikes 2022)', asset: 'BTC', testTime: new Date('2022-06-15T12:00:00Z').getTime() },
        { name: 'Local Bottom Support (Oct 2022)', asset: 'BTC', testTime: new Date('2022-10-13T12:00:00Z').getTime() },
        { name: 'ETH Bullish Follow-through (Feb 2024)', asset: 'ETH', testTime: new Date('2024-02-25T00:00:00Z').getTime() }
    ];

    logger.info(`🚀 Starting QA Backtest Suite (${testCases.length} cases)`);

    // Fetch global historical data once
    const { fetchHistoricalSentiment } = await import('./historicalData.js');
    await fetchHistoricalSentiment();

    for (const testCase of testCases) {
        try {
            const result = await backtester.runCase(testCase.name, testCase.asset, 0, testCase.testTime);
            results.push(result);
        } catch (error: any) {
            logger.error({ name: testCase.name, err: error.message }, 'Test Case Failed');
        }
    }

    // Report Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 QA BACKTEST SUMMARY REPORT');
    console.log('='.repeat(50));

    const successful = results.filter(r => r.outcome === 'SUCCESS').length;
    const failed = results.filter(r => r.outcome === 'FAILED').length;
    const totalSignals = successful + failed;
    const winRate = totalSignals > 0 ? (successful / totalSignals) * 100 : 0;
    const totalPnl = results.reduce((acc, r) => acc + r.pnl, 0);

    results.forEach(res => {
        const dateStr = new Date(res.timestamp).toLocaleDateString();
        const signalStr = res.signal ? `${res.signal.direction} @ ${res.signal.entryZoneHigh.toFixed(0)}` : 'NO SIGNAL';
        const detailStr = `L1: ${res.l1Direction}(${res.l1Score?.toFixed(2)}) | L2: ${res.l2Timing}`;
        console.log(`[${res.outcome.padEnd(7)}] ${res.caseName.padEnd(35)} | ${dateStr} | ${signalStr.padEnd(15)} | ${detailStr}`);
    });

    console.log('='.repeat(50));
    console.log(`Win Rate: ${winRate.toFixed(1)}% (${successful}/${totalSignals})`);
    console.log(`Total PnL (R): ${totalPnl.toFixed(2)}`);
    console.log('='.repeat(50));

    process.exit(0);
}

runQA();
