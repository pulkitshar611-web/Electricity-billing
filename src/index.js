const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// 💡 Load env vars FIRST before internal modules (Prisma, Engine, etc.)
dotenv.config();

const modbusEngine = require('./services/modbusEngine');

const authRoutes = require('./routes/auth.routes');
const consumerRoutes = require('./routes/consumer.routes');
const billRoutes = require('./routes/bill.routes');
const paymentRoutes = require('./routes/payment.routes');
const complaintRoutes = require('./routes/complaint.routes');
const settingRoutes = require('./routes/setting.routes');
const operatorRoutes = require('./routes/operator.routes');
const notificationRoutes = require('./routes/notification.routes');
const meterRoutes = require('./routes/meter.routes');
const reportRoutes = require('./routes/report.routes');

const app = express();
const server = http.createServer(app);

// CORS Config
const FRONTEND_URLS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://electricity-billing.kiaantechnology.com',
  'https://electricity-billing-production.up.railway.app',
  'https://electricity-billing-production-4c58.up.railway.app'
];

// Socket.io Setup
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URLS,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: FRONTEND_URLS,
  credentials: true
}));

// Body parsers — REQUIRED to read req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Diagnostic Logger (Debug Railway Routing)
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`🌐 [INBOUND] ${req.method} ${req.originalUrl} - Header Host: ${req.get('host')}`);
  }
  next();
});

// MASTER API ROUTER
console.log('🛠️ Initializing Master API Router at /api...');
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/consumers', consumerRoutes);
apiRouter.use('/bills', billRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/complaints', complaintRoutes);
apiRouter.use('/settings', settingRoutes);
apiRouter.use('/operator', operatorRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/meters', meterRoutes);
apiRouter.use('/reports', reportRoutes);

app.use('/api', apiRouter);
console.log('✅ Route /api/meters registered successfully');

// Catch-all for undefined API routes (Proper Debugging)
app.use('*', (req, res) => {
  const msg = `[API_ERROR] ${req.method} ${req.originalUrl} - Route NOT defined in Backend.`;
  console.error(msg);
  res.status(404).json({ 
    success: false, 
    message: msg, 
    debug: { 
      path: req.originalUrl, 
      method: req.method,
      stack: 'Check index.js route registrations'
    } 
  });
});

// Base route
app.get('/', (req, res) => {
  res.send('PowerBill Real-Time API is running...');
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
  console.log('Client connected to Real-Time Monitoring:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from Real-Time Monitoring');
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('💥 UNHANDLED ERROR:', err.stack);
  res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
});

// Initialize Modbus Engine
modbusEngine.init(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🚀 SERVER RUNNING 🚀`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`MODE: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PORT: ${PORT}`);
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`DB_URL: ${dbUrl.split('@')[1] ? '***@' + dbUrl.split('@')[1] : 'Localhost/Not Defined'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
