const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

const authRoutes = require('./routes/auth.routes');
const consumerRoutes = require('./routes/consumer.routes');
const billRoutes = require('./routes/bill.routes');
const paymentRoutes = require('./routes/payment.routes');
const complaintRoutes = require('./routes/complaint.routes');
const settingRoutes = require('./routes/setting.routes');
const operatorRoutes = require('./routes/operator.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();

// Middleware
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://electricity-billing.kiaantechnology.com',
    'https://electricity-billing-production.up.railway.app',
    'https://electricity-billing-production-4c58.up.railway.app',
  ],
  credentials: true
}));

// Body parsers — REQUIRED to read req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/consumers', consumerRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/notifications', notificationRoutes);

// Catch-all for undefined API routes (Proper Debugging)
app.use('/api/*', (req, res) => {
  console.log(`[API_404_ERR] Route ${req.method} ${req.originalUrl} not found!`);
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found in this system.` });
});

// Base route
app.get('/', (req, res) => {
  res.send('PowerBill API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
