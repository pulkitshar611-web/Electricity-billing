const prisma = require('../config/prisma');

// Get all meters
const getAllMeters = async (req, res) => {
    try {
        const meters = await prisma.meter.findMany({
            include: {
                consumer: {
                    include: {
                        user: {
                            select: { name: true, email: true }
                        }
                    }
                },
                registers: true
            }
        });

        const formatted = meters.map(m => ({
            id: m.id,
            meterId: m.meterId,
            consumerName: m.consumer.user.name,
            connectionType: m.connectionType,
            status: m.status,
            ipAddress: m.ipAddress,
            port: m.port,
            comPort: m.comPort,
            baudRate: m.baudRate,
            modbusAddress: m.modbusAddress,
            lastUpdated: m.lastUpdated,
            registers: m.registers
        }));


        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        console.error('getAllMeters Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Test connection (simulated)
const testConnection = async (req, res) => {
    try {
        const { id } = req.params;
        const meter = await prisma.meter.findUnique({ where: { id: Number(id) } });

        if (!meter) return res.status(404).json({ success: false, message: 'Meter not found.' });

        // Simulate connection logic
        const isSuccess = Math.random() > 0.2; // 80% success rate for simulation

        const newStatus = isSuccess ? 'Connected' : 'Failed';
        
        await prisma.meter.update({
            where: { id: Number(id) },
            data: { status: newStatus, lastUpdated: new Date() }
        });

        res.status(200).json({ 
            success: isSuccess, 
            message: isSuccess ? 'Connected successfully' : 'Connection failed',
            status: newStatus
        });
    } catch (error) {
        console.error('testConnection Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Get live dashboard data
const getLiveDashboardData = async (req, res) => {
    try {
        // Find all meters and generate random data for them
        const meters = await prisma.meter.findMany({
            include: {
                consumer: {
                    include: {
                        user: { select: { name: true } }
                    }
                }
            }
        });

        const liveData = meters.map(m => {
            // Simulate live values
            const voltage = (220 + Math.random() * 10).toFixed(2);
            const current = (5 + Math.random() * 5).toFixed(2);
            const power = (voltage * current / 1000).toFixed(2); // kW

            return {
                meterId: m.meterId,
                consumerName: m.consumer.user.name,
                voltage,
                current,
                power,
                status: m.status,
                lastUpdated: new Date()
            };
        });

        res.status(200).json({ success: true, data: liveData });
    } catch (error) {
        console.error('getLiveDashboardData Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// Update register mapping
const updateRegisters = async (req, res) => {
    try {
        const { id } = req.params;
        const { registers } = req.body;

        // Delete existing registers
        await prisma.register.deleteMany({ where: { meterId: Number(id) } });

        // Batch create new registers
        if (registers && registers.length > 0) {
            await prisma.register.createMany({
                data: registers.map(r => ({
                    meterId: Number(id),
                    label: r.label,
                    address: Number(r.address),
                    type: r.type || 'Holding'
                }))
            });
        }

        res.status(200).json({ success: true, message: 'Register mapping updated successfully' });
    } catch (error) {
        console.error('updateRegisters Error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

module.exports = {
    getAllMeters,
    testConnection,
    getLiveDashboardData,
    updateRegisters
};

