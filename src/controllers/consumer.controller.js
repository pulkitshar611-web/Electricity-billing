const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

// ─────────────────────────────────────────
// GET /api/consumers  (Admin + Operator)
// ─────────────────────────────────────────
const getAllConsumers = async (req, res) => {
    try {
        const { search, status, type } = req.query;

        const where = {};
        if (status && status !== 'All') where.status = status.toUpperCase();
        if (type && type !== 'All') where.connectionType = type.toUpperCase();
        if (search) {
            where.OR = [
                { user: { name: { contains: search } } },
                { meterNumber: { contains: search } },
                { meter: { meterId: { contains: search } } },
            ];
        }


        const consumers = await prisma.consumer.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                meter: true
            },
            orderBy: { createdAt: 'desc' },
        });

        const formatted = consumers.map((c) => ({
            id: c.id,
            userId: c.userId,
            name: c.user.name,
            email: c.user.email,
            meterNumber: c.meterNumber,
            address: c.address,
            type: c.connectionType,
            status: c.status === 'ACTIVE' ? 'Active' : 'Inactive',
            lastReading: c.lastReading,
            createdAt: c.createdAt,
            meter: c.meter
        }));


        res.status(200).json({ success: true, count: formatted.length, data: formatted });
    } catch (error) {
        console.error('getAllConsumers Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// GET /api/consumers/:id  (Admin + Operator)
// ─────────────────────────────────────────
const getConsumerById = async (req, res) => {
    try {
        const consumer = await prisma.consumer.findUnique({
            where: { id: Number(req.params.id) },
            include: { 
                user: { select: { name: true, email: true } },
                meter: true
            },
        });


        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

        res.status(200).json({
            success: true,
            data: {
                id: consumer.id,
                name: consumer.user.name,
                email: consumer.user.email,
                meterNumber: consumer.meterNumber,
                address: consumer.address,
                type: consumer.connectionType,
                status: consumer.status,
                lastReading: consumer.lastReading,
                meter: consumer.meter
            },
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// POST /api/consumers  (Admin)
// ─────────────────────────────────────────
const createConsumer = async (req, res) => {
    try {
        const { 
            name, email, password, meterNumber, address, connectionType,
            meterId, meterConnectionType, ipAddress, port, comPort, baudRate, modbusAddress 
        } = req.body;

        if (!name || !email || !password || !meterNumber || !address || !meterId || !meterConnectionType || !modbusAddress) {
            return res.status(400).json({ success: false, message: 'All fields are required including meter details.' });
        }

        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered.' });
        }

        // Check meter number
        const existingMeter = await prisma.consumer.findUnique({ where: { meterNumber } });
        if (existingMeter) {
            return res.status(400).json({ success: false, message: 'Meter number already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password || 'consumer123', 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'CONSUMER',
                consumer: {
                    create: {
                        meterNumber,
                        address,
                        connectionType: connectionType?.toUpperCase() || 'RESIDENTIAL',
                        status: 'ACTIVE',
                        lastReading: 0,
                        meter: {
                            create: {
                                meterId,
                                connectionType: meterConnectionType,
                                ipAddress,
                                port: port ? Number(port) : null,
                                comPort,
                                baudRate: baudRate ? Number(baudRate) : null,
                                modbusAddress: Number(modbusAddress),
                                status: 'Disconnected'
                            }
                        }
                    },
                },
            },
            include: { 
                consumer: {
                    include: { meter: true }
                } 
            },
        });

        res.status(201).json({
            success: true,
            message: 'Consumer and Meter created successfully.',
            data: {
                id: user.consumer.id,
                name: user.name,
                email: user.email,
                meterNumber: user.consumer.meterNumber,
                address: user.consumer.address,
                type: user.consumer.connectionType,
                status: user.consumer.status,
                meter: user.consumer.meter
            },
        });
    } catch (error) {
        console.error('createConsumer Error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// ─────────────────────────────────────────
// PUT /api/consumers/:id  (Admin)
// ─────────────────────────────────────────
const updateConsumer = async (req, res) => {
    try {
        const { 
            name, email, address, connectionType, status,
            meterId, meterConnectionType, ipAddress, port, comPort, baudRate, modbusAddress 
        } = req.body;
        const consumerId = Number(req.params.id);

        const consumer = await prisma.consumer.findUnique({
            where: { id: consumerId },
            include: { user: true, meter: true },
        });

        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

        // Update User
        if (name || email) {
            await prisma.user.update({
                where: { id: consumer.userId },
                data: { ...(name && { name }), ...(email && { email }) },
            });
        }

        // Update Consumer
        const updated = await prisma.consumer.update({
            where: { id: consumerId },
            data: {
                ...(address && { address }),
                ...(connectionType && { connectionType: connectionType.toUpperCase() }),
                ...(status && { status: status.toUpperCase() }),
                meter: {
                    upsert: {
                        create: {
                            meterId: meterId || consumer.meterNumber,
                            connectionType: meterConnectionType || 'TCP',
                            ipAddress,
                            port: port ? Number(port) : null,
                            comPort,
                            baudRate: baudRate ? Number(baudRate) : null,
                            modbusAddress: Number(modbusAddress || 1),
                        },
                        update: {
                            ...(meterId && { meterId }),
                            ...(meterConnectionType && { connectionType: meterConnectionType }),
                            ...(ipAddress && { ipAddress }),
                            ...(port && { port: Number(port) }),
                            ...(comPort && { comPort }),
                            ...(baudRate && { baudRate: Number(baudRate) }),
                            ...(modbusAddress && { modbusAddress: Number(modbusAddress) }),
                        }
                    }
                }
            },
            include: { user: true, meter: true },
        });

        res.status(200).json({
            success: true,
            message: 'Consumer and Meter updated successfully.',
            data: { id: updated.id, name: updated.user.name, meter: updated.meter },
        });
    } catch (error) {
        console.error('updateConsumer Error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};


// ─────────────────────────────────────────
// DELETE /api/consumers/:id  (Admin)
// ─────────────────────────────────────────
const deleteConsumer = async (req, res) => {
    try {
        const consumer = await prisma.consumer.findUnique({ where: { id: Number(req.params.id) } });
        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

        // Delete user (cascades to consumer)
        await prisma.user.delete({ where: { id: consumer.userId } });

        res.status(200).json({ success: true, message: 'Consumer deleted successfully.' });
    } catch (error) {
        console.error('deleteConsumer Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// GET /api/consumers/me  (Consumer - own profile)
// ─────────────────────────────────────────
const getMyProfile = async (req, res) => {
    try {
        const consumer = await prisma.consumer.findUnique({
            where: { userId: req.user.id },
            include: { user: { select: { name: true, email: true, phoneNumber: true } } },
        });
        if (!consumer) return res.status(404).json({ success: false, message: 'Profile not found.' });

        res.status(200).json({
            success: true,
            data: {
                id: consumer.id,
                name: consumer.user.name,
                email: consumer.user.email,
                phoneNumber: consumer.user.phoneNumber,
                meterNumber: consumer.meterNumber,
                address: consumer.address,
                type: consumer.connectionType,
                status: consumer.status,
                lastReading: consumer.lastReading,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// PUT /api/consumers/profile/me  (Consumer - update own profile)
// ─────────────────────────────────────────
const updateMyProfile = async (req, res) => {
    try {
        const { name, email, phoneNumber, address } = req.body;
        const userId = req.user.id;

        const consumer = await prisma.consumer.findUnique({ where: { userId } });
        if (!consumer) return res.status(404).json({ success: false, message: 'Profile not found.' });

        // Update user
        await prisma.user.update({
            where: { id: userId },
            data: { name, email, phoneNumber },
        });

        // Update consumer
        await prisma.consumer.update({
            where: { id: consumer.id },
            data: { address },
        });

        res.status(200).json({ success: true, message: 'Profile updated successfully.' });
    } catch (error) {
        console.error('updateMyProfile Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = {
    getAllConsumers,
    getConsumerById,
    createConsumer,
    updateConsumer,
    deleteConsumer,
    getMyProfile,
    updateMyProfile,
};
