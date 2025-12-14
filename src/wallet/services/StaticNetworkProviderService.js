const fs = require('fs');
const path = require('path');

const BASE_ASSETS_PATH = process.env.ASSETS_BASE_PATH;
if (!BASE_ASSETS_PATH) throw new Error('ASSETS_BASE_PATH is not defined in .env');

const BLOCKCHAIN_PATH = path.join(BASE_ASSETS_PATH, 'blockchains');
const NETWORK_LOGO_PATH = path.join(BASE_ASSETS_PATH, 'logos/networkLogo');
const TOKEN_LOGO_PATH = path.join(BASE_ASSETS_PATH, 'logos/networkTokenLogo');

class StaticNetworkProviderService {

    static getNetworkInfo(networkId) {
        const filePath = path.join(BLOCKCHAIN_PATH, 'bsc', 'assets', networkId, 'info.json');
        if (!fs.existsSync(filePath)) throw new Error('Network info not found');
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    static getNetworkLogo(chain) {
        const filePath = path.join(NETWORK_LOGO_PATH, `${chain}.png`);
        if (!fs.existsSync(filePath)) throw new Error('Network logo not found');
        return filePath;
    }

    static async *searchTokens(searchToken, limit = 50) {
        searchToken = searchToken.toLowerCase();
        let count = 0;

        const blockchains = fs.readdirSync(BLOCKCHAIN_PATH);

        for (const chain of blockchains) {
            const assetsPath = path.join(BLOCKCHAIN_PATH, chain, 'assets');
            if (!fs.existsSync(assetsPath)) continue;

            const assetFolders = fs.readdirSync(assetsPath);

            for (const assetId of assetFolders) {
                const infoPath = path.join(assetsPath, assetId, 'info.json');

                if (!fs.existsSync(infoPath)) continue;

                try {
                    const infoData = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

                    if (infoData.symbol && infoData.symbol.toLowerCase().includes(searchToken)) {

                        const tokenLogo = path.join(TOKEN_LOGO_PATH, chain, `${assetId}.png`);
                        const logoPath = fs.existsSync(tokenLogo) ? tokenLogo : null;

                        count++;
                        yield { info: infoData, logoPath };

                        if (count >= limit) return;
                    }
                } catch (e) {
                    console.warn(`Failed to parse JSON for ${assetId}: ${e.message}`);
                }
            }
        }
    }

    static getNetworkList() {
        const list = [];

        const blockchains = fs.readdirSync(BLOCKCHAIN_PATH);

        for (const chain of blockchains) {
            const infoPath = path.join(BLOCKCHAIN_PATH, chain, 'info', 'info.json');

            if (!fs.existsSync(infoPath)) continue;

            try {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

                const logoPath = path.join(NETWORK_LOGO_PATH, `${chain}.png`);

                let imageKey = null;
                if (fs.existsSync(logoPath)) {
                    imageKey = `${chain}.png`;
                }

                list.push({
                    chain,
                    name: info.name || null,
                    symbol: info.symbol || null,
                    type: info.type || null,
                    decimals: info.decimals || null,
                    image: imageKey
                });

            } catch (err) {
                console.warn(`Failed to load network info for ${chain}: ${err.message}`);
            }
        }

        return list;
    }

    static searchNetworkList(query) {
        if (!query) return this.getNetworkList();

        query = query.toLowerCase();
        const allNetworks = this.getNetworkList();

        return allNetworks.filter(net =>
            (net.name && net.name.toLowerCase().includes(query)) ||
            (net.symbol && net.symbol.toLowerCase().includes(query)) ||
            (net.chain && net.chain.toLowerCase().includes(query)) ||
            (net.type && net.type.toLowerCase().includes(query))
        );
    }


    static getNetworkTokenList(coinName) {
        const chain = coinName.toLowerCase();

        const assetsPath = path.join(BLOCKCHAIN_PATH, chain, "assets");

        if (!fs.existsSync(assetsPath)) {
            throw new Error(`Assets not found for chain: ${coinName}`);
        }

        const result = [];

        const assetFolders = fs.readdirSync(assetsPath);

        for (const assetId of assetFolders) {
            const infoPath = path.join(assetsPath, assetId, "info.json");
            if (!fs.existsSync(infoPath)) continue;

            try {
                const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));

                const logoFile = `${assetId}.png`;
                const logoPath = path.join(TOKEN_LOGO_PATH, chain, logoFile);

                const logoKey = fs.existsSync(logoPath) ? logoFile : null;

                result.push({
                    address: assetId,
                    name: info.name || null,
                    symbol: info.symbol || null,
                    decimals: info.decimals || null,
                    type: info.type || "token",
                    image: logoKey
                });

            } catch (err) {
                console.warn(`Failed to load token info for ${assetId}: ${err.message}`);
            }
        }
        return result;
    }

}

StaticNetworkProviderService.findToken = async (symbol) => {
    symbol = symbol.toLowerCase();
    for await (const token of StaticNetworkProviderService.searchTokens(symbol, 1)) {
        return token;
    }
    return null;
};





module.exports = StaticNetworkProviderService;
