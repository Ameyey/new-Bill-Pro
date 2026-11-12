const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('./config/db');
const { createSchema } = require('./models/schema');
const { seedData } = require('./models/seed');

// Import routes
const authRoutes = require('./routes/authRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const myUserRoutes = require('./routes/myUserRoutes');

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static uploads folder
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/images', uploadRoutes);
app.use('/api/my-users', myUserRoutes);
app.use('/api/my_user', myUserRoutes);
app.use('/api/my_users', myUserRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BillPro API', timestamp: new Date() });
});

// Root route
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'BillPro API is running', timestamp: new Date() });
});

// Startup sequence
async function startServer() {
  try {
    console.log('Initializing database...');
    db.init();
    await createSchema();
    await seedData();
    console.log('Database initialized and verified.');

    app.listen(PORT, () => {
      console.log(`Server running smoothly on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server failed to start:', error);
  }
}

// Start HTTP listener only when running locally (not inside Vercel serverless environment)
if (!process.env.VERCEL) {
  startServer();
} else {
  db.init();
}

module.exports = app;

