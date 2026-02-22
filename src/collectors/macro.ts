import axios from 'axios';
import { BaseCollector } from './base.js';
import { macroRepository, MacroData } from '../db/repositories/macro.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

export class MacroCollector extends BaseCollector {
    private static FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

    constructor() {
        super('MacroCollector');
    }

    async collect(): Promise<void> {
        if (!config.fred.apiKey) {
            logger.warn('Skipping MacroCollector: FRED_API_KEY not provided');
            return;
        }

        await this.runCollection(async () => {
            // DXY: Nominal Broad U.S. Dollar Index
            const metrics = [
                { id: 'DTWEXBGS', name: 'dxy' },
                { id: 'FEDFUNDS', name: 'fed_rate' }
            ];

            const allData: MacroData[] = [];

            for (const metric of metrics) {
                const response = await axios.get(MacroCollector.FRED_BASE, {
                    params: {
                        series_id: metric.id,
                        api_key: config.fred.apiKey,
                        file_type: 'json',
                        limit: 1,
                        sort_order: 'desc'
                    }
                });

                const latest = response.data.observations[0];
                if (latest && latest.value !== '.') {
                    allData.push({
                        timestamp: new Date(latest.date).getTime(),
                        metric: metric.name,
                        value: parseFloat(latest.value),
                        source: 'fred'
                    });
                }
            }

            if (allData.length > 0) {
                macroRepository.saveMany(allData);
                logger.debug({ count: allData.length }, `Saved macro data from FRED`);
            }
        });
    }
}
