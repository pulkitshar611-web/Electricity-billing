const express = require('express');
const {
    processPayment,
    getMyPayments,
    getAllPayments,
} = require('../controllers/payment.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// All Payments (Admin)
router.get('/', protect, authorize('ADMIN'), getAllPayments);

// My Payments (Consumer)
router.get('/my', protect, authorize('CONSUMER'), getMyPayments);

// Process Payment (Consumer)
router.post('/', protect, authorize('CONSUMER'), processPayment);

module.exports = router;
