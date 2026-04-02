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
            meterName: m.meterName,
            consumerName: m.consumer.user.name,
            connectionType: m.connectionType,
            status: m.status,
            ipAddress: m.ipAddress,
            port: m.port,
            comPort: m.comPort,
            baudRate: m.baudRate,
            dataBits: m.dataBits,
            parity: m.parity,
            stopBits: m.stopBits,
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

// Create or update meter
const upsertMeter = async (req, res) => {
    try {
        const { id, meterId, meterName, consumerId, connectionType, ipAddress, port, comPort, baudRate, dataBits, parity, stopBits, modbusAddress } = req.body;
        
        const data = {
            meterId,
            meterName: meterName || 'New Meter',
            consumerId: Number(consumerId),
            connectionType,
            ipAddress,
            port: port ? Number(port) : null,
            comPort,
            baudRate: baudRate ? Number(baudRate) : null,
            dataBits: dataBits ? Number(dataBits) : 8,
            parity: parity || 'none',
            stopBits: stopBits ? Number(stopBits) : 1,
            modbusAddress: modbusAddress ? Number(modbusAddress) : 1
        };

        let result;
        if (id) {
            result = await prisma.meter.update({
                where: { id: Number(id) },
                data
            });
        } else {
            result = await prisma.meter.create({ data });
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('upsertMeter Error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// Delete meter
const deleteMeter = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.meter.delete({ where: { id: Number(id) } });
        res.status(200).json({ success: true, message: 'Meter deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Test connection (real attempt)
const testConnection = async (req, res) => {
    try {
        const { id } = req.params;
        const meter = await prisma.meter.findUnique({ 
            where: { id: Number(id) },
            include: { registers: true }
        });

        if (!meter) return res.status(404).json({ success: false, message: 'Meter not found.' });

        const modbusEngine = require('../services/modbusEngine');
        let isSuccess = false;
        let message = 'Connection failed';
        
        try {
            const client = await modbusEngine.connectToMeter(meter);
            isSuccess = !!client;
            message = 'Connected successfully';
        } catch (err) {
            isSuccess = false;
            message = `Connection failed: ${err.message}`;
        }
        
        const newStatus = isSuccess ? 'Connected' : 'Failed';
        
        await prisma.meter.update({
            where: { id: Number(id) },
            data: { status: newStatus, lastUpdated: new Date() }
        });

        res.status(200).json({ 
            success: isSuccess, 
            message: message,
            status: newStatus
        });
    } catch (error) {
        console.error('testConnection Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};
// Get live dashboard data (API Fallback)
const getLiveDashboardData = async (req, res) => {
    try {
        const meters = await prisma.meter.findMany({
            include: {
                consumer: {
                    include: {
                        user: { select: { name: true } }
                    }
                },
                registers: true
            }
        });

        // Normally, Socket.io pushes this, but for the first load, let's get the most recent reading for each meter
        const dataWithLatest = await Promise.all(meters.map(async (m) => {
            const latestReading = await prisma.meterReading.findFirst({
                where: { meterId: m.id },
                orderBy: { createdAt: 'desc' }
            });

            return {
                ...m,
                ...latestReading, // This will spread voltage, current, energy etc.
                id: m.id, // Ensure original meter id is kept
                meterId: m.meterId,
                status: m.status,
                lastUpdated: m.lastUpdated || latestReading?.createdAt
            };
        }));

        res.status(200).json({ success: true, data: dataWithLatest });
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
            // Note: On some SQLite environments, Prisma createMany might have issues, 
            // but for standard SQLite it works. We maintain address as a String.
            await prisma.register.createMany({
                data: registers.map(r => ({
                    meterId: Number(id),
                    label: r.label,
                    address: String(r.address),
                    functionCode: Number(r.functionCode) || 3,
                    dataType: r.dataType || 'Float'
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
    upsertMeter,
    deleteMeter,
    testConnection,
    getLiveDashboardData,
    updateRegisters
};

