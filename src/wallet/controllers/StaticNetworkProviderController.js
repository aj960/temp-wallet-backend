const StaticNetworkProviderService = require('../services/StaticNetworkProviderService');
const { success, error } = require('../../utils/response');
const path = require('path');

exports.getNetworkInfo = async (req, res) => {
    try {
        const networkId = req.params.networkId;
        const info = StaticNetworkProviderService.getNetworkInfo(networkId);
        success(res, info);
    } catch (e) {
        error(res, e.message);
    }
};

exports.getNetworkLogo = async (req, res) => {
    try {
        const networkId = req.params.networkId;
        const logoPath = StaticNetworkProviderService.getNetworkLogo(networkId);
        res.sendFile(logoPath);
    } catch (e) {
        error(res, e.message);
    }
};

exports.findTokenBySymbol = async (req, res) => {
    try {
        const { symbol } = req.params;
        if (!symbol) return error(res, 'Symbol parameter is required');

        const result = await StaticNetworkProviderService.findToken(symbol);
        if (!result) return error(res, `Token with symbol "${symbol}" not found`);

        success(res, {
            info: result.info,
            logoPath: result.logoPath
        });
    } catch (e) {
        error(res, e.message);
    }
};


exports.searchTokens = async (req, res) => {
    try {
        const searchToken = req.query.q || '';
        const limit = parseInt(req.query.limit) || 50;

        const results = [];
        for await (const token of StaticNetworkProviderService.searchTokens(searchToken, limit)) {
            results.push(token);
        }

        success(res, results);
    } catch (e) {
        error(res, e.message);
    }
};


exports.getNetworkList = async (req, res) => {
    try {
        const list = StaticNetworkProviderService.getNetworkList();
        success(res, list);
    } catch (e) {
        error(res, e.message);
    }
};

exports.searchNetworkList = async (req, res) => {
    try {
        const query = req.query.q || '';
        const result = StaticNetworkProviderService.searchNetworkList(query);
        success(res, result);
    } catch (e) {
        error(res, e.message);
    }
};


exports.getNetworkTokenList = async (req, res) => {
    try {
        const { coinName } = req.params;
        if (!coinName) return error(res, "coinName is required");

        const result = StaticNetworkProviderService.getNetworkTokenList(coinName);

        success(res, result);
    } catch (e) {
        error(res, e.message);
    }
};

