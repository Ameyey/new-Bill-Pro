const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { generateToken } = require('../config/jwt');
const { getSubscriptionInfo } = require('../middleware/subscriptionCheck');

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, companyName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.run(
      'INSERT INTO users (name, email, password_hash, password_plain, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), passwordHash, password, phone || '', 'admin']
    );

    const userId = result.lastInsertRowid;

    // Create 29-day free trial subscription
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);
    await db.run(
      `INSERT INTO subscriptions (user_id, plan_type, trial_start, trial_end, status)
       VALUES (?, 'trial', ?, ?, 'active')`,
      [userId, now.toISOString(), trialEnd.toISOString()]
    );

    // Create clean default company settings for the newly registered user
    const finalCompanyName = companyName && companyName.trim() ? companyName.trim() : `${name.trim()}'s Business`;
    await db.run(
      `INSERT INTO company_settings (
        user_id, company_name, email, phone, invoice_prefix, next_invoice_no, default_gst_rate
      ) VALUES (?, ?, ?, ?, 'INV-', 1, 18.00)`,
      [
        userId,
        finalCompanyName,
        email.toLowerCase().trim(),
        phone && phone.trim() ? phone.trim() : null
      ]
    );

    const user = await db.get('SELECT id, name, email, phone, role FROM users WHERE id = ?', [userId]);
    const token = generateToken(user);
    const subscription = await getSubscriptionInfo(userId);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully with 29-day free trial!',
      token,
      user,
      subscription
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed. ' + error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Check if login is allowed / approved by admin
    if (user.login_allowed !== undefined && user.login_allowed !== null && (user.login_allowed === 0 || user.login_allowed === '0' || user.login_allowed === false)) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not allowed to log in (Login access disabled or pending approval by administrator).'
      });
    }

    const token = generateToken(user);
    const subscription = await getSubscriptionInfo(user.id);
    const company = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [user.id]);

    const userResponse = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    };

    return res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: userResponse,
      subscription,
      company
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed. ' + error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const subscription = await getSubscriptionInfo(req.user.id);
    const company = await db.get('SELECT * FROM company_settings WHERE user_id = ?', [req.user.id]);
    if (company && !company.logo_url) {
      const logoImg = await db.get(
        "SELECT file_path FROM invoice_images WHERE user_id = ? AND (image_slot = 1 OR image_type = 'logo') ORDER BY id DESC LIMIT 1",
        [req.user.id]
      );
      if (logoImg?.file_path) {
        company.logo_url = logoImg.file_path;
        try {
          await db.run('UPDATE company_settings SET logo_url = ? WHERE user_id = ?', [logoImg.file_path, req.user.id]);
        } catch (e) {}
      }
    }

    return res.json({
      success: true,
      user: req.user,
      subscription,
      company
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    await db.get('SELECT id, email FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    return res.json({
      success: true,
      message: 'Reset link / instructions sent to ' + email + '. (For testing, you can also login with default credentials admin123)'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
