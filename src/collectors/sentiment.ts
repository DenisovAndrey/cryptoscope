import axios from 'axios';
import { BaseCollector } from './base.js';
import { sentimentRepository, SentimentData } from '../db/repositories/sentiment.js';
import { logger } from '../utils/logger.js';

export class SentimentCollector extends BaseCollector {
    private static FNG_URL = 'https://api.alternative.me/fng/';

    constructor() {
        super('SentimentCollector');
    }

    async collect(): Promise<void> {
        await this.runCollection(async () => {
            const response = await axios.get(SentimentCollector.FNG_URL, {
                params: { limit: 1, format: 'json' }
            });

            const item = response.data.data[0];
            if (!item) return;

            const data: SentimentData[] = [
                {
                    timestamp: parseInt(item.timestamp, 10) * 1000,
                    metric: 'fear_greed',
                    value: item.value,
                    source: 'alternative.me'
                },
                {
                    timestamp: parseInt(item.timestamp, 10) * 1000,
                    metric: 'fear_greed_classification',
                    value: item.value_classification,
                    source: 'alternative.me'
                }
            ];

            sentimentRepository.saveMany(data);
            logger.debug({ value: item.value }, `Saved Fear & Greed Index`);
        });
    }
}
