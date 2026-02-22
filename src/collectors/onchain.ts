import puppeteer from 'puppeteer';
import { BaseCollector } from './base.js';
import { onChainRepository, OnChainData } from '../db/repositories/onchain.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

export class OnChainCollector extends BaseCollector {
    constructor() {
        super('OnChainCollector');
    }

    async collect(): Promise<void> {
        await this.runCollection(async () => {
            const browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            try {
                const metrics = [
                    { name: 'mvrv', url: 'https://www.lookintobitcoin.com/charts/mvrv-zscore/' },
                    { name: 'nupl', url: 'https://www.lookintobitcoin.com/charts/relative-unrealized-profit--loss/' }
                ];

                const results: OnChainData[] = [];

                for (const metric of metrics) {
                    const page = await browser.newPage();
                    logger.debug({ metric: metric.name }, `Navigating to ${metric.url}`);

                    await page.goto(metric.url, { waitUntil: 'networkidle2', timeout: 60000 });

                    // Wait for the chart to be initialized
                    await page.waitForSelector('.highcharts-container', { timeout: 30000 }).catch(() => null);

                    // Wait a bit more for data population
                    await new Promise(r => setTimeout(r, 5000));

                    const chartData = await page.evaluate(() => {
                        const plotEl = document.querySelector('.js-plotly-plot') as any;
                        if (plotEl && plotEl.data) {
                            // Find the correct series
                            const series = plotEl.data.find((s: any) =>
                                s.name.toLowerCase().includes('z-score') ||
                                s.name.toLowerCase().includes('nupl') ||
                                (s.name.includes('Value') && !s.name.includes('Price'))
                            );

                            const targetSeries = series || plotEl.data[0];

                            if (targetSeries && targetSeries.x && targetSeries.y) {
                                // Data often has nulls at the end for future dates, find last non-null
                                for (let i = targetSeries.y.length - 1; i >= 0; i--) {
                                    if (targetSeries.y[i] !== null && targetSeries.y[i] !== undefined) {
                                        return {
                                            timestamp: new Date(targetSeries.x[i]).getTime(),
                                            value: targetSeries.y[i]
                                        };
                                    }
                                }
                            }
                        }
                        return null;
                    });

                    if (chartData && chartData.value !== null) {
                        results.push({
                            asset: 'BTC',
                            timestamp: chartData.timestamp,
                            metric: metric.name,
                            value: Number(chartData.value),
                            source: 'lookintobitcoin'
                        });
                        logger.debug({ metric: metric.name, value: chartData.value, time: new Date(chartData.timestamp).toISOString() }, `Extracted data from Plotly chart`);
                    } else {
                        logger.warn({ metric: metric.name }, `Failed to extract data from Plotly chart`);
                    }

                    await page.close();
                }

                if (results.length > 0) {
                    onChainRepository.saveMany(results);
                }
            } finally {
                await browser.close();
            }
        });
    }
}
