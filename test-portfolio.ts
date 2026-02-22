import { initDb } from './src/db/database.js';
import { portfolioRepository } from './src/db/repositories/portfolio.js';

try {
    initDb();
    portfolioRepository.setBalance('EUR', 5000);
    portfolioRepository.setBalance('BTC', 0.1);
    portfolioRepository.setBalance('ETH', 2.0);

    console.log('--- Portfolio Balances ---');
    console.log(portfolioRepository.getAllBalances());
    process.exit(0);
} catch (error) {
    console.error(error);
    process.exit(1);
}
