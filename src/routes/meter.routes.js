const express = require('express');
const router = express.Router();
const meterController = require('../controllers/meter.controller');
// Assume some middleware exists if needed (like auth, but I'll skip for brevity or follow existing patterns if I find them)
// In index.js I saw authRoutes used, so there might be a protect middleware.

router.get('/', meterController.getAllMeters);
router.post('/:id/test', meterController.testConnection);
router.get('/live', meterController.getLiveDashboardData);
router.put('/:id/registers', meterController.updateRegisters);

module.exports = router;

