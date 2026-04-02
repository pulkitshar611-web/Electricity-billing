const express = require('express');
const router = express.Router();
const meterController = require('../controllers/meter.controller');
// Assume some middleware exists if needed (like auth, but I'll skip for brevity or follow existing patterns if I find them)
// In index.js I saw authRoutes used, so there might be a protect middleware.

const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/', protect, authorize('ADMIN', 'OPERATOR'), meterController.getAllMeters);
router.post('/', protect, authorize('ADMIN'), meterController.upsertMeter);
router.delete('/:id', protect, authorize('ADMIN'), meterController.deleteMeter);
router.post('/:id/test', protect, authorize('ADMIN', 'OPERATOR'), meterController.testConnection);
router.get('/live', protect, authorize('ADMIN', 'OPERATOR'), meterController.getLiveDashboardData);
router.put('/:id/registers', protect, authorize('ADMIN'), meterController.updateRegisters);

module.exports = router;

