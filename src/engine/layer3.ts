import { config } from '../config.js';

export interface RiskResult {
    positionSizePct: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
}

export class Layer3Engine {
    calculate(asset: string, currentPrice: number, atr: number, direction: 'BUY' | 'SELL'): RiskResult {
        const riskPerTrade = config.trading.riskPerTradePct / 100;

        // Stop Loss: asset-specific or default ATR multiplier
        const multiplier = (config.trading.atrMultiplier as any)[asset] || (config.trading.atrMultiplier as any).DEFAULT;
        const slDistance = atr * multiplier;
        const stopLoss = direction === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance;

        // Position Sizing: (Risk Amount) / (Distance to Stop)
        // For simplicity, we ensure it doesn't exceed 20% of portfolio per trade
        const riskPctOfPrice = slDistance / currentPrice;
        let positionSizePct = (riskPerTrade / riskPctOfPrice) * 100;

        if (positionSizePct > config.trading.maxPositionPct) positionSizePct = config.trading.maxPositionPct;

        // Take Profit: configurable R-multiples
        const tp1 = direction === 'BUY' ? currentPrice + (slDistance * config.trading.tp1Multiplier) : currentPrice - (slDistance * config.trading.tp1Multiplier);
        const tp2 = direction === 'BUY' ? currentPrice + (slDistance * config.trading.tp2Multiplier) : currentPrice - (slDistance * config.trading.tp2Multiplier);

        return {
            positionSizePct: Math.round(positionSizePct * 100) / 100,
            stopLoss,
            takeProfit1: tp1,
            takeProfit2: tp2
        };
    }
}
