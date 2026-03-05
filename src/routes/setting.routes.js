const express = require('express');
const { getSettings, updateSettings } = require('../controllers/setting.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

// Admin only can manage settings
router.get('/', protect, authorize('ADMIN'), getSettings);
router.put('/', protect, authorize('ADMIN'), updateSettings);

module.exports = router;
