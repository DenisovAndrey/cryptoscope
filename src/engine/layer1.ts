import { indicatorRepository } from '../db/repositories/indicators.js';
import { sentimentRepository, SentimentData } from '../db/repositories/sentiment.js';
import { onChainRepository, OnChainData } from '../db/repositories/onchain.js';
import { macroRepository, MacroData } from '../db/repositories/macro.js';
import { logger } from '../utils/logger.js';

export interface LayerResult {
    direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    score: number; // 0 to 1
    reason: string;
}

export class Layer1Engine {
    async evaluate(asset: string, timestamp: number): Promise<LayerResult> {
        const indicators = indicatorRepository.getAllForTimestamp(asset, '1h', timestamp);

        // 1. Trend (EMA Stack)
        const ema20 = indicators.find(i => i.name === 'ema_20')?.value;
        const ema50 = indicators.find(i => i.name === 'ema_50')?.value;
        const ema200 = indicators.find(i => i.name === 'ema_200')?.value;

        let trendScore = 0;
        let trendReason = 'Neutral';

        if (ema20 && ema50 && ema200) {
            if (ema20 > ema50 && ema50 > ema200) {
                trendScore = 1;
                trendReason = 'Perfect Bullish Alignment';
            } else if (ema20 < ema50 && ema50 < ema200) {
                trendScore = -1;
                trendReason = 'Perfect Bearish Alignment';
            }
        }

        // 2. Sentiment (Fear & Greed)
        const fngItem = sentimentRepository.getLatestBefore('fear_greed', timestamp);
        const fngValue = fngItem ? parseInt(fngItem.value, 10) : 50;

        let sentimentScore = 0;
        if (fngValue < 25) sentimentScore = 0.5; // Extreme Fear is a buying opportunity
        if (fngValue > 75) sentimentScore = -0.5; // Extreme Greed is a risk

        // 3. Macro (DXY)
        const dxyItem = macroRepository.getLatestBefore('dxy', timestamp);
        const dxyValue = dxyItem ? dxyItem.value : 100;
        let macroScore = 0;
        if (dxyValue < 100) macroScore = 0.2; // Weak dollar is good for crypto

        // 4. On-Chain (MVRV)
        const mvrvItem = onChainRepository.getLatestBefore(asset, 'mvrv', timestamp);
        const mvrvValue = mvrvItem ? mvrvItem.value : 1.5;
        let onchainScore = 0;
        if (mvrvValue < 1.0) onchainScore = 0.5;
        if (mvrvValue > 3.0) onchainScore = -0.5;

        // Combine
        const finalScore = (trendScore * 0.4) + (sentimentScore * 0.2) + (macroScore * 0.1) + (onchainScore * 0.3);

        return {
            direction: finalScore > 0.3 ? 'BULLISH' : finalScore < -0.3 ? 'BEARISH' : 'NEUTRAL',
            score: Math.abs(finalScore),
            reason: `Trend: ${trendReason}`
        };
    }
}
