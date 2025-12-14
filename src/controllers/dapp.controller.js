const db = require('../db/dapps.db');
const { success, error } = require('../utils/response');
const auditLogger = require('../security/audit-logger.service');

// ==================== Get All Categories ====================
exports.getCategories = async (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.icon_url as iconUrl,
        COUNT(d.id) as dappCount
      FROM dapp_categories c
      LEFT JOIN dapps d ON c.id = d.category_id
      GROUP BY c.id
      ORDER BY c.display_order ASC
    `).all();

    return success(res, categories);
  } catch (e) {
    auditLogger.logError(e, { controller: 'getCategories' });
    return error(res, e.message);
  }
};

// ==================== Get Featured DApps ====================
exports.getFeaturedDApps = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const dapps = db.prepare(`
      SELECT 
        d.*,
        GROUP_CONCAT(dc.chain) as chains
      FROM dapps d
      LEFT JOIN dapp_chains dc ON d.id = dc.dapp_id
      WHERE d.featured = 1
      GROUP BY d.id
      ORDER BY d.display_order ASC, d.user_count DESC
      LIMIT ?
    `).all(parseInt(limit));

    const formattedDApps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    }));

    return success(res, { dapps: formattedDApps });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getFeaturedDApps' });
    return error(res, e.message);
  }
};

// ==================== Get Latest DApps ====================
exports.getLatestDApps = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const dapps = db.prepare(`
      SELECT 
        d.*,
        GROUP_CONCAT(dc.chain) as chains
      FROM dapps d
      LEFT JOIN dapp_chains dc ON d.id = dc.dapp_id
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT ?
    `).all(parseInt(limit));

    const formattedDApps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    }));

    return success(res, {
      total: formattedDApps.length,
      page: 1,
      pageSize: parseInt(limit),
      dapps: formattedDApps
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getLatestDApps' });
    return error(res, e.message);
  }
};

// ==================== Get DApps by Category ====================
exports.getDAppsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const dapps = db.prepare(`
      SELECT 
        d.*,
        GROUP_CONCAT(dc.chain) as chains
      FROM dapps d
      LEFT JOIN dapp_chains dc ON d.id = dc.dapp_id
      WHERE d.category_id = ?
      GROUP BY d.id
      ORDER BY d.display_order ASC, d.user_count DESC
      LIMIT ? OFFSET ?
    `).all(categoryId, parseInt(pageSize), offset);

    const totalCount = db.prepare(`
      SELECT COUNT(*) as count FROM dapps WHERE category_id = ?
    `).get(categoryId);

    const formattedDApps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    }));

    return success(res, {
      total: totalCount.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      dapps: formattedDApps
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getDAppsByCategory' });
    return error(res, e.message);
  }
};

// ==================== Get DApps by Chain ====================
exports.getDAppsByChain = async (req, res) => {
  try {
    const { chainId } = req.params;
    const { page = 1, pageSize = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const dapps = db.prepare(`
      SELECT 
        d.*,
        GROUP_CONCAT(DISTINCT dc2.chain) as chains
      FROM dapps d
      INNER JOIN dapp_chains dc ON d.id = dc.dapp_id
      LEFT JOIN dapp_chains dc2 ON d.id = dc2.dapp_id
      WHERE UPPER(dc.chain) = UPPER(?)
      GROUP BY d.id
      ORDER BY d.display_order ASC, d.user_count DESC
      LIMIT ? OFFSET ?
    `).all(chainId, parseInt(pageSize), offset);

    const totalCount = db.prepare(`
      SELECT COUNT(DISTINCT d.id) as count
      FROM dapps d
      INNER JOIN dapp_chains dc ON d.id = dc.dapp_id
      WHERE UPPER(dc.chain) = UPPER(?)
    `).get(chainId);

    const formattedDApps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    }));

    return success(res, {
      total: totalCount.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      dapps: formattedDApps
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getDAppsByChain' });
    return error(res, e.message);
  }
};

// ==================== Search DApps ====================
exports.searchDApps = async (req, res) => {
  try {
    const { query, category, chains, page = 1, pageSize = 20 } = req.body;

    if (!query || query.trim() === '') {
      return error(res, 'Search query is required');
    }

    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    let sql = `
      SELECT 
        d.*,
        GROUP_CONCAT(DISTINCT dc.chain) as chains
      FROM dapps d
      LEFT JOIN dapp_chains dc ON d.id = dc.dapp_id
      WHERE (LOWER(d.name) LIKE LOWER(?) OR LOWER(d.description) LIKE LOWER(?))
    `;
    
    const params = [`%${query}%`, `%${query}%`];

    if (category) {
      sql += ` AND d.category_id = ?`;
      params.push(category);
    }

    if (chains && Array.isArray(chains) && chains.length > 0) {
      sql += ` AND EXISTS (
        SELECT 1 FROM dapp_chains dc2 
        WHERE dc2.dapp_id = d.id 
        AND UPPER(dc2.chain) IN (${chains.map(() => '?').join(',')})
      )`;
      params.push(...chains.map(c => c.toUpperCase()));
    }

    sql += ` GROUP BY d.id ORDER BY d.user_count DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), offset);

    const dapps = db.prepare(sql).all(...params);

    const formattedDApps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    }));

    return success(res, {
      total: formattedDApps.length,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      dapps: formattedDApps
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'searchDApps' });
    return error(res, e.message);
  }
};

// ==================== Get DApp Details ====================
exports.getDAppDetails = async (req, res) => {
  try {
    const { dappId } = req.params;

    const dapp = db.prepare(`
      SELECT 
        d.*,
        GROUP_CONCAT(DISTINCT dc.chain) as chains
      FROM dapps d
      LEFT JOIN dapp_chains dc ON d.id = dc.dapp_id
      WHERE d.id = ?
      GROUP BY d.id
    `).get(dappId);

    if (!dapp) {
      return error(res, 'DApp not found');
    }

    // Get stats
    const stats = db.prepare(`
      SELECT * FROM dapp_stats WHERE dapp_id = ?
    `).get(dappId);

    // Get reviews (limit to recent 10)
    const reviews = db.prepare(`
      SELECT * FROM dapp_reviews 
      WHERE dapp_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `).all(dappId);

    const formattedDApp = {
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    };

    return success(res, {
      dapp: formattedDApp,
      stats: stats || null,
      reviews: reviews || []
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getDAppDetails' });
    return error(res, e.message);
  }
};

// ==================== Get All DApps ====================
exports.getAllDApps = async (req, res) => {
  try {
    const { page = 1, pageSize = 20, featured } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let sql = `
      SELECT 
        d.*,
        GROUP_CONCAT(dc.chain) as chains
      FROM dapps d
      LEFT JOIN dapp_chains dc ON d.id = dc.dapp_id
    `;
    const params = [];

    if (featured !== undefined) {
      sql += ` WHERE d.featured = ?`;
      params.push(featured === 'true' ? 1 : 0);
    }

    sql += ` GROUP BY d.id ORDER BY d.display_order ASC, d.user_count DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), offset);

    const dapps = db.prepare(sql).all(...params);

    const totalCount = featured !== undefined 
      ? db.prepare(`SELECT COUNT(*) as count FROM dapps WHERE featured = ?`).get(featured === 'true' ? 1 : 0)
      : db.prepare(`SELECT COUNT(*) as count FROM dapps`).get();

    const formattedDApps = dapps.map(dapp => ({
      id: dapp.id,
      name: dapp.name,
      description: dapp.description,
      category: dapp.category_id,
      url: dapp.url,
      iconUrl: dapp.icon_url,
      bannerUrl: dapp.banner_url,
      chains: dapp.chains ? dapp.chains.split(',') : [],
      featured: Boolean(dapp.featured),
      verified: Boolean(dapp.verified),
      rating: dapp.rating,
      userCount: dapp.user_count,
      created_at: dapp.created_at
    }));

    return success(res, {
      total: totalCount.count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      dapps: formattedDApps
    });
  } catch (e) {
    auditLogger.logError(e, { controller: 'getAllDApps' });
    return error(res, e.message);
  }
};

