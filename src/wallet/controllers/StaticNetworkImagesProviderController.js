const StaticNetworkImagesProviderService = require('../services/StaticNetworkImagesProviderService');
const { success, error } = require('../../utils/response');

exports.getAllNetworkCoinImages = async (req, res) => {
    try {
        const list = StaticNetworkImagesProviderService.getAllNetworkCoinImages();
        success(res, list);
    } catch (e) {
        error(res, e.message);
    }
};

exports.getNetworkTokenImages = async (req, res) => {
    try {
        const key = req.params.BaseNetworkCoinName; // FIXED
        const list = StaticNetworkImagesProviderService.getNetworkTokenImages(key);
        success(res, list);
    } catch (e) {
        error(res, e.message);
    }
};


exports.getAnyImage = async (req, res) => {
    try {
        const key = req.params.key;
        const base64 = StaticNetworkImagesProviderService.getAnyImage(key);
        success(res, { key, image: base64 });
    } catch (e) {
        error(res, e.message);
    }
};

