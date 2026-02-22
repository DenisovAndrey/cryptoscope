-- Price candles from exchanges
CREATE TABLE IF NOT EXISTS candles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,           -- 'BTC', 'ETH'
    timeframe TEXT NOT NULL,       -- '1h', '4h', '1d'
    open_time INTEGER NOT NULL,    -- Unix timestamp ms
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume REAL NOT NULL,
    quote_volume REAL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(asset, timeframe, open_time)
);

-- Computed technical indicators
CREATE TABLE IF NOT EXISTS indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,
    timeframe TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    name TEXT NOT NULL,            -- 'ema_20', 'rsi_14', etc.
    value REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(asset, timeframe, timestamp, name)
);

-- On-chain metrics
CREATE TABLE IF NOT EXISTS onchain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL DEFAULT 'BTC',
    timestamp INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT DEFAULT 'lookintobitcoin',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(asset, timestamp, metric)
);

-- Sentiment data
CREATE TABLE IF NOT EXISTS sentiment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT DEFAULT 'alternative.me',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(timestamp, metric)
);

-- Macro data
CREATE TABLE IF NOT EXISTS macro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT DEFAULT 'fred',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(timestamp, metric)
);

-- Derivatives data
CREATE TABLE IF NOT EXISTS derivatives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    source TEXT DEFAULT 'binance',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(asset, timestamp, metric)
);

-- Generated signals
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    direction TEXT NOT NULL,
    composite_score REAL,
    layer1_direction TEXT,
    layer1_score REAL,
    layer2_timing TEXT,
    layer2_details TEXT,
    entry_zone_low REAL,
    entry_zone_high REAL,
    stop_loss REAL,
    take_profit_1 REAL,
    take_profit_2 REAL,
    position_size_pct REAL,
    rationale TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Trade journal (manual tracking after executing signals)
CREATE TABLE IF NOT EXISTS trade_journal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER REFERENCES signals(id),
    asset TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_time INTEGER,
    exit_time INTEGER,
    entry_price REAL,
    exit_price REAL,
    position_size REAL,
    amount REAL,
    pnl_eur REAL,
    pnl_pct REAL,
    status TEXT DEFAULT 'OPEN', -- 'OPEN', 'CLOSED'
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Portfolio history for growth tracking
CREATE TABLE IF NOT EXISTS portfolio_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    asset TEXT NOT NULL,
    amount REAL NOT NULL,
    value_eur REAL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio (
    asset TEXT PRIMARY KEY,        -- 'BTC', 'ETH', 'EUR'
    amount REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_candles_lookup ON candles(asset, timeframe, open_time);
CREATE INDEX IF NOT EXISTS idx_indicators_lookup ON indicators(asset, timeframe, timestamp);
CREATE INDEX IF NOT EXISTS idx_signals_active ON signals(status, asset);
CREATE INDEX IF NOT EXISTS idx_portfolio_history ON portfolio_history(timestamp, asset);
