exports.success = (res, data) => res.status(200).json({ success: true, data });
exports.error = (res, message, apiFailure = null) =>
  res.status(400).json({ success: false, message, API_Failure: apiFailure });
exports.failure = (res, message, apiFailure = null) =>
  res.status(500).json({ success: false, message, API_Failure: apiFailure });
