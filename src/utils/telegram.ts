import TelegramBot from 'node-telegram-bot-api';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { portfolioRepository } from '../db/repositories/portfolio.js';
import { tradeJournalRepository } from '../db/repositories/journal.js';
import { signalRepository } from '../db/repositories/signals.js';
import { statusService } from './status.js';
import { systemEvents, SystemEventTypes } from './events.js';
import { pipelineManager } from '../engine/pipeline.js';

export class TelegramService {
    private bot: TelegramBot | null = null;
    private logPath = join(process.cwd(), 'logs', 'app.log');

    constructor() {
        if (config.telegram.token) {
            this.bot = new TelegramBot(config.telegram.token, { polling: true });
            this.setupListeners();
            this.registerCommands();
            this.setupErrorNotifications();
            logger.info('Telegram Bot initialized with polling');
        } else {
            logger.warn('Telegram Bot Token not provided, notifications will be logged only.');
        }
    }

    private escapeMarkdown(text: string): string {
        if (!text) return "";
        // Basic Markdown escaping for characters that cause 400 Bad Request
        return text.replace(/([_*`[\]()])/g, '\\$1');
    }

    private setupErrorNotifications() {
        systemEvents.on(SystemEventTypes.ERROR, (error: string) => {
            // Ignore Telegram internal errors to prevent notification loops
            if (error.includes('ETELEGRAM') || error.includes('polling_error')) {
                return;
            }

            if (this.bot && config.telegram.chatId) {
                const escapedError = this.escapeMarkdown(error);
                const message = `⚠️ *SYSTEM ERROR* ⚠️\n\n\`\`\`\n${escapedError}\n\`\`\`\n\nCheck /status or /logs for more details.`;
                this.bot.sendMessage(config.telegram.chatId, message, { parse_mode: 'Markdown' });
            }
        });
    }

    private async registerCommands() {
        if (!this.bot) return;
        try {
            await this.bot.setMyCommands([
                { command: 'start', description: 'Start the bot and show menu' },
                { command: 'analyze', description: 'Trigger full analysis cycle NOW' },
                { command: 'balance', description: 'Show portfolio balances' },
                { command: 'performance', description: 'Show trade performance' },
                { command: 'status', description: 'Check system health' },
                { command: 'logs', description: 'View recent logs' },
                { command: 'help', description: 'Show help message' }
            ]);
        } catch (error) {
            logger.error({ err: error }, 'Failed to set Telegram commands');
        }
    }

    private getMainMenu() {
        return {
            reply_markup: {
                keyboard: [
                    [{ text: '🔍 Analyze Now' }],
                    [{ text: '📊 Balance' }, { text: '📈 Performance' }],
                    [{ text: '🏥 Status' }, { text: '📋 Logs' }],
                    [{ text: '❓ Help' }]
                ],
                resize_keyboard: true,
                persistent: true
            }
        };
    }

    private setupListeners() {
        if (!this.bot) return;

        // Command mapping for buttons
        this.bot.on('message', (msg) => {
            const text = msg.text;
            if (!text) return;

            if (text === '🔍 Analyze Now') return this.handleAnalyze(msg);
            if (text === '📊 Balance') return this.handleBalance(msg);
            if (text === '📈 Performance') return this.handlePerformance(msg);
            if (text === '🏥 Status') return this.handleStatus(msg);
            if (text === '📋 Logs') return this.handleLogs(msg);
            if (text === '❓ Help') return this.handleHelp(msg);
        });

        this.bot.onText(/\/start/, (msg) => this.handleHelp(msg));
        this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
        this.bot.onText(/\/analyze/, (msg) => this.handleAnalyze(msg));
        this.bot.onText(/\/balance/, (msg) => this.handleBalance(msg));
        this.bot.onText(/\/performance/, (msg) => this.handlePerformance(msg));
        this.bot.onText(/\/status/, (msg) => this.handleStatus(msg));
        this.bot.onText(/\/logs/, (msg) => this.handleLogs(msg));

        // /set_balance <asset> <amount>
        this.bot.onText(/\/set_balance (\w+) ([\d.]+)/, (msg, match) => {
            const chatId = msg.chat.id;
            if (!match) return;

            const asset = match[1].toUpperCase();
            const amount = parseFloat(match[2]);

            portfolioRepository.setBalance(asset, amount);
            this.bot?.sendMessage(chatId, `✅ Updated! Your *${asset}* balance is now *${amount}*.`, { parse_mode: 'Markdown', ...this.getMainMenu() });
        });

        // Handle Callback Queries (Buttons)
        this.bot.on('callback_query', async (query) => {
            const chatId = query.message?.chat.id;
            if (!chatId || !query.data) return;

            const [action, signalIdStr] = query.data.split(':');
            const signalId = parseInt(signalIdStr);

            if (action === 'execute') {
                const signal = signalRepository.getById(signalId);
                if (signal) {
                    tradeJournalRepository.create({
                        signalId: signalId,
                        asset: signal.asset,
                        direction: signal.direction,
                        entryTime: Date.now(),
                        entryPrice: signal.entryZoneHigh,
                        positionSize: signal.positionSizePct,
                        amount: 0,
                        status: 'OPEN',
                        notes: 'Automatically created from Telegram confirmation'
                    });

                    signalRepository.updateStatus(signalId, 'EXECUTED');

                    this.bot?.answerCallbackQuery(query.id, { text: "✅ Signal marked as EXECUTED" });
                    this.bot?.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message?.message_id });
                    this.bot?.sendMessage(chatId, `🚀 *Confirmed:* Trade for ${signal.asset} opened at ${signal.entryZoneHigh}.`, this.getMainMenu());
                }
            } else if (action === 'ignore') {
                signalRepository.updateStatus(signalId, 'CANCELLED');
                this.bot?.answerCallbackQuery(query.id, { text: "❌ Signal marked as IGNORED" });
                this.bot?.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message?.message_id });
            }
        });
    }

    private handleHelp(msg: any) {
        const helpText = `
🚀 *CryptoScope Portfolio Bot* 🚀

Use the menu buttons below or commands to manage your bot.

*Commands:*
/analyze - Run full data & signal engine NOW
/balance - Current holdings
/performance - Trade stats
/status - System health
/logs - Recent activity

*Manage Portfolio:*
/set_balance EUR 1000 - Set Euro balance
/set_balance BTC 0.5 - Set Bitcoin balance
/set_balance ETH 2.0 - Set Ethereum balance
        `.trim();
        this.bot?.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown', ...this.getMainMenu() });
    }

    private handleBalance(msg: any) {
        const balances = portfolioRepository.getAllBalances();
        if (balances.length === 0) {
            this.bot?.sendMessage(msg.chat.id, "Your portfolio is empty.", this.getMainMenu());
            return;
        }

        let text = "*📊 Current Portfolio:* \n";
        balances.forEach(b => { text += `- *${b.asset}:* ${b.amount}\n`; });
        this.bot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', ...this.getMainMenu() });
    }

    private handlePerformance(msg: any) {
        const stats = tradeJournalRepository.getPerformanceStats();
        const winRate = stats.totalTrades > 0 ? (stats.wins / stats.totalTrades * 100).toFixed(1) : "0";
        const text = `
*📈 Performance Dashboard*

*Total Trades:* ${stats.totalTrades}
*Win Rate:* ${winRate}%
*Total PNL:* ${stats.totalPnl?.toFixed(2) || 0} EUR
*Avg PNL %:* ${stats.avgPnlPct?.toFixed(2) || 0}%
        `.trim();
        this.bot?.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown', ...this.getMainMenu() });
    }

    private handleStatus(msg: any) {
        const report = statusService.getReport();
        this.bot?.sendMessage(msg.chat.id, report, { parse_mode: 'Markdown', ...this.getMainMenu() });
    }

    private handleLogs(msg: any) {
        if (!existsSync(this.logPath)) {
            this.bot?.sendMessage(msg.chat.id, "❌ Log file not found.", this.getMainMenu());
            return;
        }

        try {
            const logs = readFileSync(this.logPath, 'utf8');
            const lines = logs.trim().split('\n');
            const lastLines = lines.slice(-15).join('\n');
            this.bot?.sendMessage(msg.chat.id, `*📋 Recent Logs:*\n\`\`\`\n${lastLines}\n\`\`\``, { parse_mode: 'Markdown', ...this.getMainMenu() });
        } catch (error) {
            this.bot?.sendMessage(msg.chat.id, "❌ Error reading logs.", this.getMainMenu());
        }
    }

    private async handleAnalyze(msg: any) {
        const chatId = msg.chat.id;
        this.bot?.sendMessage(chatId, "🔍 *Starting full analysis cycle...* \n(Price -> Derivatives -> Sentiment -> Macro -> On-Chain -> Indicators -> Signals)\n\n_This may take a minute._", { parse_mode: 'Markdown' });

        const result = await pipelineManager.runFullCycle();

        if (result.success) {
            this.bot?.sendMessage(chatId, `✅ *Analysis Complete:* ${result.message}`, this.getMainMenu());
        } else {
            this.bot?.sendMessage(chatId, `❌ *Analysis Failed:* ${result.message}`, this.getMainMenu());
        }
    }

    async sendMessage(message: string) {
        if (this.bot && config.telegram.chatId) {
            try {
                await this.bot.sendMessage(config.telegram.chatId, message, { parse_mode: 'Markdown', ...this.getMainMenu() });
            } catch (error) {
                logger.error({ err: error instanceof Error ? error.message : String(error) }, 'Failed to send Telegram message');
            }
        }
    }

    async sendSignal(signal: any, signalId: number) {
        if (!this.bot || !config.telegram.chatId) return;

        const message = this.formatSignal(signal);
        const options = {
            parse_mode: 'Markdown' as const,
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Execute', callback_data: `execute:${signalId}` },
                        { text: '❌ Ignore', callback_data: `ignore:${signalId}` }
                    ]
                ]
            }
        };

        try {
            await this.bot.sendMessage(config.telegram.chatId, message, options);
        } catch (error) {
            logger.error({ err: error instanceof Error ? error.message : String(error) }, 'Failed to send Signal message');
        }
    }

    formatSignal(signal: any): string {
        const icon = signal.direction === 'BUY' ? '🟩' : '🟥';
        const actionLabel = signal.direction === 'BUY' ? 'BUY' : 'SELL';

        const currentBalance = portfolioRepository.getBalance(signal.asset);
        let quantityStr = "";

        if (signal.direction === 'BUY') {
            const eurBalance = portfolioRepository.getBalance('EUR');
            const targetInvestment = eurBalance * (signal.positionSizePct / 100);
            const quantity = targetInvestment / signal.entryZoneHigh;
            quantityStr = `\n*Action:* ${actionLabel} ${quantity.toFixed(6)} ${signal.asset}`;
        } else {
            const quantity = currentBalance * (signal.positionSizePct / 100);
            quantityStr = `\n*Action:* ${actionLabel} ${quantity.toFixed(6)} ${signal.asset}`;
        }

        return `
${icon} *NEW SIGNAL: ${signal.asset}* ${icon}${quantityStr}
*Direction:* ${signal.direction}
*Score:* ${(signal.compositeScore * 100).toFixed(0)}%

*Entry Zone:* ${signal.entryZoneLow.toFixed(2)} - ${signal.entryZoneHigh.toFixed(2)}
*Stop Loss:* ${signal.stopLoss.toFixed(2)}
*Take Profit 1:* ${signal.takeProfit1.toFixed(2)}
*Take Profit 2:* ${signal.takeProfit2.toFixed(2)}

*Size:* ${signal.positionSizePct}%

*Rationale:* ${this.escapeMarkdown(signal.rationale)}
        `.trim();
    }
}

export const telegramService = new TelegramService();
