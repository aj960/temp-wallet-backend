const fs = require('fs');
const path = require('path');

const BASE_PATH = process.env.LOGOS_BASE_PATH;
if (!BASE_PATH) throw new Error('LOGOS_BASE_PATH is not defined in .env');

const NETWORK_LOGO_PATH = path.join(BASE_PATH, 'networkLogo');
const TOKEN_LOGO_PATH = path.join(BASE_PATH, 'networkTokenLogo');

class StaticNetworkImagesProviderService {

    static _toBase64(filePath) {
        if (!fs.existsSync(filePath)) return null;

        const buffer = fs.readFileSync(filePath);
        return `data:image/png;base64,${buffer.toString('base64')}`;
    }

    static getAllNetworkCoinImages() {
        if (!fs.existsSync(NETWORK_LOGO_PATH)) return [];

        const files = fs.readdirSync(NETWORK_LOGO_PATH);

        return files
            .filter(f => f.endsWith('.png'))
            .map(f => ({
                name: f,
                image: this._toBase64(path.join(NETWORK_LOGO_PATH, f))
            }));
    }

    static getNetworkTokenImages(key) {
        const folder = path.join(TOKEN_LOGO_PATH, key);

        if (!fs.existsSync(folder)) return [];

        const files = fs.readdirSync(folder);

        return files
            .filter(f => f.endsWith('.png'))
            .map(f => ({
                name: f,
                image: this._toBase64(path.join(folder, f))
            }));
    }

    static getAnyImage(BaseNetworkCoinName) {
        if (!BaseNetworkCoinName) throw new Error('Image key is required');

        const key = BaseNetworkCoinName.toLowerCase().endsWith('.png')
            ? BaseNetworkCoinName.slice(0, -4)
            : BaseNetworkCoinName;

        const networkImage = path.join(NETWORK_LOGO_PATH, `${key}.png`);
        if (fs.existsSync(networkImage)) {
            return this._toBase64(networkImage);
        }

        if (!fs.existsSync(TOKEN_LOGO_PATH)) throw new Error('Token logo folder not found');
        const chains = fs.readdirSync(TOKEN_LOGO_PATH);

        for (const chain of chains) {
            const imagePath = path.join(TOKEN_LOGO_PATH, chain, `${key}.png`);
            if (fs.existsSync(imagePath)) {
                return this._toBase64(imagePath);
            }
        }

        throw new Error('Image not found');
    }

}

module.exports = StaticNetworkImagesProviderService;
