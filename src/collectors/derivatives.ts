import axios from 'axios';
import { BaseCollector } from './base.js';
import { derivativesRepository, DerivativesData } from '../db/repositories/derivatives.js';
import { logger } from '../utils/logger.js';

export class DerivativesCollector extends BaseCollector {
    private static FUTURES_BASE = 'https://fapi.binance.com/fapi/v1';

    constructor(private asset: string) {
        super(`DerivativesCollector-${asset}`);
    }

    async collect(): Promise<void> {
        await this.runCollection(async () => {
            const symbol = `${this.asset}USDT`;
            const timestamp = Date.now();

            const [fundingRes, oiRes] = await Promise.all([
                axios.get(`${DerivativesCollector.FUTURES_BASE}/premiumIndex`, { params: { symbol } }),
                axios.get(`${DerivativesCollector.FUTURES_BASE}/openInterest`, { params: { symbol } })
            ]);

            const data: DerivativesData[] = [
                {
                    asset: this.asset,
                    timestamp,
                    metric: 'funding_rate',
                    value: parseFloat(fundingRes.data.lastFundingRate),
                    source: 'binance'
                },
                {
                    asset: this.asset,
                    timestamp,
                    metric: 'open_interest',
                    value: parseFloat(oiRes.data.openInterest),
                    source: 'binance'
                }
            ];

            derivativesRepository.saveMany(data);
            logger.debug({ asset: this.asset }, `Saved derivatives data (funding, OI)`);
        });
    }
}
