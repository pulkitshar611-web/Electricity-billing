const prisma = require('../config/prisma');
const bcrypt = require('bcryptjs');

// ─────────────────────────────────────────
// GET /api/settings
// ─────────────────────────────────────────
const getSettings = async (req, res) => {
    try {
        let settings = await prisma.systemSetting.findFirst();

        // If no settings exist, create default
        if (!settings) {
            settings = await prisma.systemSetting.create({
                data: {
                    residentialRate: 6,
                    commercialRate: 8,
                    industrialRate: 12,
                    taxPercent: 5
                }
            });
        }

        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        console.error('getSettings Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────
// PUT /api/settings
// ─────────────────────────────────────────
const updateSettings = async (req, res) => {
    try {
        const settings = await prisma.systemSetting.update({
            where: { id: 1 },
            data: req.body
        });
        res.status(200).json({ success: true, data: settings, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('updateSettings Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────
// GET /api/settings/team
// ─────────────────────────────────────────
const getTeam = async (req, res) => {
    try {
        const members = await prisma.user.findMany({
            where: { role: { in: ['ADMIN', 'OPERATOR'] } },
            select: { id: true, name: true, email: true, role: true, createdAt: true }
        });
        res.status(200).json({ success: true, data: members });
    } catch (error) {
        console.error('getTeam Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────
// POST /api/settings/team
// ─────────────────────────────────────────
const addTeamMember = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ success: false, message: 'Email already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: { 
                name, 
                email, 
                password: hashedPassword, 
                role: role.toUpperCase(),
                ...(role.toUpperCase() === 'OPERATOR' && { operator: { create: {} } })
            }
        });

        res.status(201).json({ success: true, message: 'Team member added successfully', data: user });
    } catch (error) {
        console.error('addTeamMember error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ─────────────────────────────────────────
// DELETE /api/settings/team/:id
// ─────────────────────────────────────────
const removeTeamMember = async (req, res) => {
    try {
        const { id } = req.params;
        if (Number(id) === req.user.id) return res.status(400).json({ success: false, message: 'Cannot remove yourself' });

        await prisma.user.delete({ where: { id: Number(id) } });
        res.status(200).json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
        console.error('removeTeamMember Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { getSettings, updateSettings, getTeam, addTeamMember, removeTeamMember };
