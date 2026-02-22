import 'dotenv/config';

export const config = {
    env: process.env.NODE_ENV || 'development',
    dbPath: process.env.DB_PATH || './data/cryptoscope.db',
    logLevel: process.env.LOG_LEVEL || 'info',

    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
    },

    fred: {
        apiKey: process.env.FRED_API_KEY || '',
    },

    trading: {
        portfolioValueEur: parseFloat(process.env.PORTFOLIO_VALUE_EUR || '2000'),
        riskPerTradePct: parseFloat(process.env.RISK_PER_TRADE_PCT || '2'),
        maxPositions: parseInt(process.env.MAX_POSITIONS || '3', 10),
        maxPortfolioRiskPct: parseFloat(process.env.MAX_PORTFOLIO_RISK_PCT || '6'),
        assets: (process.env.ASSETS || 'BTC,ETH').split(',').map(a => a.trim()),

        // Signal tuning
        l1BullishThreshold: parseFloat(process.env.L1_BULLISH_THRESHOLD || '0.2'),
        l1BearishThreshold: parseFloat(process.env.L1_BEARISH_THRESHOLD || '-0.2'),
        l2RsiBullCeiling: parseFloat(process.env.L2_RSI_BULL_CEILING || '55'),
        l2RsiBearFloor: parseFloat(process.env.L2_RSI_BEAR_FLOOR || '68'),
        atrMultiplier: {
            BTC: parseFloat(process.env.ATR_MULTIPLIER_BTC || '1.5'),
            ETH: parseFloat(process.env.ATR_MULTIPLIER_ETH || '2.0'),
            DEFAULT: parseFloat(process.env.ATR_MULTIPLIER_DEFAULT || '1.5'),
        },
        tp1Multiplier: parseFloat(process.env.TP1_MULTIPLIER || '2.0'),
        tp2Multiplier: parseFloat(process.env.TP2_MULTIPLIER || '3.0'), // Lowered to 3.0 (Phase D)
        maxPositionPct: parseFloat(process.env.MAX_POSITION_PCT || '30'),
    },

    scheduler: {
        priceCron: process.env.PRICE_CRON || '0 * * * *',
        signalCron: process.env.SIGNAL_CRON || '10 */4 * * *',
        dailyReportCron: process.env.DAILY_REPORT_CRON || '0 8 * * *',
    }
};

// Validation
if (config.env === 'production') {
    if (!config.telegram.token) throw new Error('TELEGRAM_BOT_TOKEN is required in production');
    if (!config.telegram.chatId) throw new Error('TELEGRAM_CHAT_ID is required in production');
}
