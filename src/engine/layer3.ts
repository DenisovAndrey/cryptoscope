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

        // Stop Loss: 2 * ATR away from current price
        const slDistance = atr * 2;
        const stopLoss = direction === 'BUY' ? currentPrice - slDistance : currentPrice + slDistance;

        // Position Sizing: (Risk Amount) / (Distance to Stop)
        // For simplicity, we ensure it doesn't exceed 20% of portfolio per trade
        const riskPctOfPrice = slDistance / currentPrice;
        let positionSizePct = (riskPerTrade / riskPctOfPrice) * 100;

        if (positionSizePct > 20) positionSizePct = 20;

        // Take Profit: 1.5R and 3R
        const tp1 = direction === 'BUY' ? currentPrice + (slDistance * 1.5) : currentPrice - (slDistance * 1.5);
        const tp2 = direction === 'BUY' ? currentPrice + (slDistance * 3) : currentPrice - (slDistance * 3);

        return {
            positionSizePct: Math.round(positionSizePct * 100) / 100,
            stopLoss,
            takeProfit1: tp1,
            takeProfit2: tp2
        };
    }
}
