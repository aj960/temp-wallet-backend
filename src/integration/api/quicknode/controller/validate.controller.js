const { success, error } = require('../../../../utils/response');
const { ethers } = require('ethers');

exports.validateAddress = async (req, res) => {
  const { address } = req.body;
  
  if (!address) return error(res, 'Address is required');
  
  const isValid = ethers.utils.isAddress(address);
  
  return success(res, { 
    address, 
    isValid 
  });
};



