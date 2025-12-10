const DEBANK_API_KEY = process.env.REACT_APP_DEBANK_ACCESS_KEY;
const MORALIS_API_KEY = process.env.REACT_APP_MORALIS_API_KEY;

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Simple in-memory cache: { "BTC": { price: 100000, timestamp: 1234567890 } }
const priceCache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedPrice = async (key, fetchFn) => {
    const now = Date.now();
    if (priceCache[key] && (now - priceCache[key].timestamp < CACHE_TTL)) {
        return priceCache[key].price;
    }
    const price = await fetchFn();
    if (price > 0) {
        priceCache[key] = { price, timestamp: now };
    }
    return price;
};

const fetchWithRetry = async (url, options = {}, retries = 3, timeout = 5000) => {
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);

            if (response.ok) return response;

            if (i < retries - 1 && (response.status === 429 || response.status >= 500)) {
                console.warn(`[API] Attempt ${i + 1} failed (${response.status}). Retrying...`);
                await wait(1000 * (i + 1));
                continue;
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        } catch (error) {
            clearTimeout(id);
            const isTimeout = error.name === 'AbortError';
            if (i < retries - 1) {
                console.warn(`[API] Attempt ${i + 1} error: ${isTimeout ? 'Timeout (5s)' : error.message}. Retrying...`);
                await wait(1000 * (i + 1));
                continue;
            }
            throw error;
        }
    }
};

// --- BINANCE HELPER ---
const fetchBinancePrice = async (symbol) => {
    // Symbol e.g., 'BTCUSDT', 'TRXUSDT', 'SOLUSDT'
    const cleanSymbol = symbol.toUpperCase();
    // Use cache key based on symbol, e.g. "PRICE_BTCUSDT"
    return getCachedPrice(`PRICE_${cleanSymbol}`, async () => {
        try {
            const response = await fetchWithRetry(`https://api.binance.com/api/v3/ticker/price?symbol=${cleanSymbol}`);
            const data = await response.json();
            return parseFloat(data.price);
        } catch (error) {
            console.warn(`Failed to fetch Binance price for ${cleanSymbol}:`, error);
            return 0;
        }
    });
};

// --- EVM ---
export const fetchDebankBalance = async (address) => {
    if (!DEBANK_API_KEY) {
        console.error("Missing REACT_APP_DEBANK_ACCESS_KEY. DeBank request aborted.");
        return 0;
    }
    try {
        const response = await fetchWithRetry(`https://pro-openapi.debank.com/v1/user/total_balance?id=${address}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'AccessKey': DEBANK_API_KEY
            }
        });
        const data = await response.json();
        return parseFloat(data.total_usd_value || 0);
    } catch (error) {
        console.warn(`Failed to fetch DeBank balance for ${address}:`, error);
        return null; // Return null on max retries failure
    }
};

// --- SOLANA ---
export const fetchSolanaNetWorth = async (address) => {
    try {
        if (!MORALIS_API_KEY) {
            console.warn("Moralis API Key is missing");
            return 0;
        }

        const headers = {
            'Accept': 'application/json',
            'X-API-Key': MORALIS_API_KEY,
        };

        // 1. Fetch Native SOL Balance
        const balanceResponse = await fetchWithRetry(
            `https://solana-gateway.moralis.io/account/mainnet/${address}/balance`,
            { method: 'GET', headers }
        );
        const balanceData = await balanceResponse.json();
        const solBalance = parseFloat(balanceData.solana || 0);

        // 2. Fetch SOL Price (Binance)
        const solPrice = await fetchBinancePrice('SOLUSDT');

        let totalUsd = solBalance * solPrice;

        // 3. Fetch Token Balances
        const tokensResponse = await fetchWithRetry(
            `https://solana-gateway.moralis.io/account/mainnet/${address}/tokens`,
            { method: 'GET', headers }
        );
        const tokensData = await tokensResponse.json();

        // 4. Calculate Token Values
        if (Array.isArray(tokensData) && tokensData.length > 0) {
            const pricePromises = tokensData.map(async (token) => {
                if (token.possibleSpam) return 0;

                try {
                    // Cache token prices by Mint Address
                    const price = await getCachedPrice(`SOL_TOKEN_${token.mint}`, async () => {
                        const tokenPriceResponse = await fetchWithRetry(
                            `https://solana-gateway.moralis.io/token/mainnet/${token.mint}/price`,
                            { method: 'GET', headers }
                        );
                        const priceData = await tokenPriceResponse.json();
                        return parseFloat(priceData.usdPrice || 0);
                    });

                    return parseFloat(token.amount) * price;
                } catch (e) {
                    return 0;
                }
            });

            const tokenValues = await Promise.all(pricePromises);
            const totalTokenValue = tokenValues.reduce((a, b) => a + b, 0);
            totalUsd += totalTokenValue;
        }

        return totalUsd;

    } catch (error) {
        console.warn(`Failed to fetch net worth for ${address}:`, error);
        return null;
    }
};

// --- TRON ---
const fetchTrxPrice = async () => {
    return fetchBinancePrice('TRXUSDT');
};

export const fetchTronBalance = async (address) => {
    try {
        const res = await fetchWithRetry(`https://apilist.tronscan.org/api/account?address=${address}`);
        const data = await res.json();
        if (!data || !data.tokens) return 0;

        const trxPrice = await fetchTrxPrice();
        if (!trxPrice) return 0;

        let totalTrxValue = 0;
        data.tokens.forEach(token => {
            if (token.balance && token.tokenDecimal !== undefined) {
                const balance = parseFloat(token.balance);
                const decimals = token.tokenDecimal;
                const priceInTrx = token.tokenPriceInTrx || 0;
                if (balance > 0 && priceInTrx > 0) {
                    const quantity = balance / Math.pow(10, decimals);
                    totalTrxValue += quantity * priceInTrx;
                }
            }
        });
        return totalTrxValue * trxPrice;
    } catch (e) {
        console.warn(`Tron fetch failed: ${e}`);
        return null;
    }
};

// --- BTC ---
export const fetchBtcPrice = async () => {
    return fetchBinancePrice('BTCUSDT');
};

export const fetchBtcBalance = async (address) => {
    const PROVIDERS = [
        {
            name: 'Mempool',
            url: `https://mempool.space/api/address/${address}`,
            type: 'esplora'
        },
        {
            name: 'Blockstream',
            url: `https://blockstream.info/api/address/${address}`,
            type: 'esplora'
        },
        {
            name: 'Blockchain.info',
            url: `https://blockchain.info/q/addressbalance/${address}`,
            type: 'plaintext'
        }
    ];

    // Shuffle providers to distribute load (Round-Robin-ish)
    // But keep Blockchain.info last as it has strict limits? 
    // Actually, mixing them is better if limits are per-IP.
    // Let's randomize the first two (Esplora) and keep Blockchain.info as backup
    const esploraProviders = PROVIDERS.slice(0, 2).sort(() => Math.random() - 0.5);
    const sortedProviders = [...esploraProviders, PROVIDERS[2]];

    for (const provider of sortedProviders) {
        try {
            // Lower timeout/retries for individual provider attempts to fail fast so we can try others
            // explicitly passing params to fetchWithRetry to not retry internally too many times
            const res = await fetchWithRetry(provider.url, {}, 1, 3000);

            if (provider.type === 'esplora') {
                const data = await res.json();
                const chainStats = data.chain_stats || {};
                const mempoolStats = data.mempool_stats || {};
                const confirmed = (chainStats.funded_txo_sum || 0) - (chainStats.spent_txo_sum || 0);
                const unconfirmed = (mempoolStats.funded_txo_sum || 0) - (mempoolStats.spent_txo_sum || 0);
                return (confirmed + unconfirmed) / 100000000;
            } else if (provider.type === 'plaintext') {
                const data = await res.text();
                const satoshis = parseInt(data, 10);
                if (isNaN(satoshis)) throw new Error("Invalid response");
                return satoshis / 100000000;
            }
        } catch (e) {
            console.warn(`BTC fetch failed on ${provider.name}:`, e.message);
            // Continue to next provider
            continue;
        }
    }

    console.warn(`All BTC providers failed for ${address}`);
    return null;
};
