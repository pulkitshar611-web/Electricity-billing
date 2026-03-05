const prisma = require('../config/prisma');

// ─────────────────────────────────────────
// GET /api/settings
// ─────────────────────────────────────────
const getSettings = async (req, res) => {
    try {
        let settings = await prisma.systemSetting.findFirst();

        // If no settings exist, create default
        if (!settings) {
            settings = await prisma.systemSetting.create({
                data: {} // Uses default values defined in schema
            });
        }

        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error('getSettings Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// PUT /api/settings
// ─────────────────────────────────────────
const updateSettings = async (req, res) => {
    try {
        const updateData = req.body;

        const settings = await prisma.systemSetting.findFirst();

        if (!settings) {
            const newSettings = await prisma.systemSetting.create({
                data: updateData
            });
            return res.status(200).json({ success: true, data: newSettings });
        }

        const updatedSettings = await prisma.systemSetting.update({
            where: { id: settings.id },
            data: updateData
        });

        res.status(200).json({ success: true, data: updatedSettings });
    } catch (error) {
        console.error('updateSettings Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { getSettings, updateSettings };
