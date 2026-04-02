const prisma = require('../config/prisma');
const { createNotification } = require('./notification.controller');

// Helper: calculate bill amount
const calculateBill = async (consumerType, prevReading, currReading) => {
    const settings = await prisma.systemSetting.findFirst() || { residentialRate: 6, commercialRate: 8, industrialRate: 12, taxPercent: 5 };
    
    let rate = settings.residentialRate;
    if (consumerType === 'COMMERCIAL') rate = settings.commercialRate;
    if (consumerType === 'INDUSTRIAL') rate = settings.industrialRate;

    const units = currReading - prevReading;
    const baseAmount = units * rate;
    const taxAmount = baseAmount * (settings.taxPercent / 100);
    const totalAmount = baseAmount + taxAmount;
    
    return { units, baseAmount, taxAmount, totalAmount, ratePerUnit: rate, taxPercent: settings.taxPercent };
};

// ─────────────────────────────────────────
// GET /api/bills  (Admin)
// ─────────────────────────────────────────
const getAllBills = async (req, res) => {
    try {
        const { status, consumerId } = req.query;
        const where = {};
        if (status && status !== 'All') where.status = status.toUpperCase();
        if (consumerId) where.consumerId = Number(consumerId);

        const bills = await prisma.bill.findMany({
            where,
            include: {
                consumer: { include: { user: { select: { name: true } } } },
                operator: { include: { user: { select: { name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const formatted = bills.map((b) => ({
            id: b.id,
            billNumber: b.billNumber,
            consumerName: b.consumer.user.name,
            consumerId: b.consumerId,
            meterNumber: b.consumer.meterNumber,
            prevReading: b.prevReading,
            currReading: b.currReading,
            units: b.units,
            amount: b.totalAmount,
            dueDate: b.dueDate,
            billMonth: b.billMonth,
            status: b.status,
            generatedBy: b.operator?.user?.name || 'Admin',
            createdAt: b.createdAt,
        }));

        res.status(200).json({ success: true, count: formatted.length, data: formatted });
    } catch (error) {
        console.error('getAllBills Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// GET /api/bills/my  (Consumer - own bills)
// ─────────────────────────────────────────
const getMyBills = async (req, res) => {
    try {
        const consumer = await prisma.consumer.findUnique({ where: { userId: req.user.id } });
        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

        const { status } = req.query;
        const where = { consumerId: consumer.id };
        if (status && status !== 'All') where.status = status.toUpperCase();

        const bills = await prisma.bill.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });

        const formatted = bills.map((b) => ({
            id: b.id,
            billNumber: b.billNumber,
            prevReading: b.prevReading,
            currReading: b.currReading,
            units: b.units,
            amount: b.totalAmount,
            dueDate: b.dueDate,
            billMonth: b.billMonth,
            status: b.status,
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// POST /api/bills/generate  (Admin + Operator)
// ─────────────────────────────────────────
const generateBill = async (req, res) => {
    try {
        const { consumerId, currReading, dueDate, billMonth } = req.body;

        if (!consumerId || !currReading || !dueDate || !billMonth) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const consumer = await prisma.consumer.findUnique({
            where: { id: Number(consumerId) },
            include: { user: true },
        });

        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

        // Check if bill already exists for this consumer and month (Proper logic)
        const existingBill = await prisma.bill.findFirst({
            where: { consumerId: Number(consumerId), billMonth }
        });

        if (existingBill) {
            return res.status(400).json({
                success: false,
                message: `Bill already generated for ${billMonth}. Duplicate generation prevented.`
            });
        }

        const prevReading = consumer.lastReading;

        if (Number(currReading) < prevReading) {
            return res.status(400).json({
                success: false,
                message: `Current reading (${currReading}) cannot be less than previous reading (${prevReading}).`,
            });
        }

        const { units, baseAmount, taxAmount, totalAmount, ratePerUnit, taxPercent } = await calculateBill(consumer.connectionType, prevReading, Number(currReading));

        // Find operator if role is OPERATOR
        let operatorId = null;
        if (req.user.role === 'OPERATOR') {
            const operator = await prisma.operator.findUnique({ where: { userId: req.user.id } });
            operatorId = operator?.id || null;
        }

        const bill = await prisma.bill.create({
            data: {
                consumerId: Number(consumerId),
                operatorId,
                prevReading,
                currReading: Number(currReading),
                units,
                baseAmount,
                ratePerUnit,
                taxPercent,
                taxAmount,
                totalAmount,
                dueDate: new Date(dueDate),
                billMonth,
                status: 'PENDING',
            },
        });

        // Update consumer's last reading
        await prisma.consumer.update({
            where: { id: Number(consumerId) },
            data: { lastReading: Number(currReading) },
        });

        // Trigger Notification
        await createNotification(
            consumer.userId,
            'New Bill Generated ⚡',
            `Your bill for ${billMonth} has been generated. Amount: ₹${totalAmount.toFixed(2)}. Please pay before ${new Date(dueDate).toLocaleDateString()}.`
        );

        res.status(201).json({
            success: true,
            message: 'Bill generated successfully.',
            data: {
                id: bill.id,
                billNumber: bill.billNumber,
                consumerName: consumer.user.name,
                meterNumber: consumer.meterNumber,
                prevReading: bill.prevReading,
                currReading: bill.currReading,
                units: bill.units,
                baseAmount: bill.baseAmount,
                taxAmount: bill.taxAmount,
                totalAmount: bill.totalAmount,
                dueDate: bill.dueDate,
                billMonth: bill.billMonth,
                status: bill.status,
            },
        });
    } catch (error) {
        console.error('generateBill Error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// GET /api/bills/:id
// ─────────────────────────────────────────
const getBillById = async (req, res) => {
    try {
        const bill = await prisma.bill.findUnique({
            where: { id: Number(req.params.id) },
            include: {
                consumer: { include: { user: { select: { name: true, email: true } } } },
            },
        });

        if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });

        res.status(200).json({ success: true, data: bill });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// GET /api/dashboard/stats  (Admin)
// ─────────────────────────────────────────
const getDashboardStats = async (req, res) => {
    try {
        // All queries fire in PARALLEL — no serial round-trips
        const [
            totalConsumers,
            onlineMeters,
            offlineMeters,
            totalBills,
            pendingBills,
            paidPayments,
            recentPayments,
            recentComplaints,
        ] = await Promise.all([
            prisma.consumer.count(),
            prisma.meter.count({ where: { status: 'Connected' } }),
            prisma.meter.count({ where: { status: { not: 'Connected' } } }),

            prisma.bill.count(),

            prisma.bill.aggregate({
                where: { status: 'PENDING' },
                _sum: { totalAmount: true },
            }),

            prisma.payment.aggregate({
                where: { status: 'SUCCESS' },
                _sum: { amount: true },
            }),

            prisma.payment.findMany({
                take: 5,
                orderBy: { paidAt: 'desc' },
                select: {
                    id: true,
                    amount: true,
                    mode: true,
                    paidAt: true,
                    status: true,
                    consumer: { select: { user: { select: { name: true } } } },
                },
            }),

            prisma.complaint.findMany({
                take: 5,
                where: { status: 'PENDING' },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    type: true,
                    status: true,
                    createdAt: true,
                    consumer: { select: { user: { select: { name: true } } } },
                },
            }),
        ]);

        // Handle Monthly Revenue grouping in JS for cross-DB compatibility (SQLite/MySQL)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const paymentsForChart = await prisma.payment.findMany({
            where: {
                status: 'SUCCESS',
                paidAt: { gte: sixMonthsAgo }
            },
            select: { amount: true, paidAt: true },
            orderBy: { paidAt: 'asc' }
        });

        const revenueMap = {};
        paymentsForChart.forEach(p => {
            const month = p.paidAt.toLocaleString('en-US', { month: 'short' });
            revenueMap[month] = (revenueMap[month] || 0) + p.amount;
        });

        const monthlyRevenue = Object.entries(revenueMap).map(([name, revenue]) => ({
            name,
            revenue: Number(revenue.toFixed(2))
        }));

        res.status(200).json({
            success: true,
            data: {
                totalConsumers,
                onlineMeters,
                offlineMeters,
                totalMeters: onlineMeters + offlineMeters,
                totalBills,
                pendingAmount: Number(pendingBills._sum.totalAmount || 0),
                paidAmount: Number(paidPayments._sum.amount || 0),
                recentPayments: recentPayments.map((p) => ({
                    id: p.id,
                    consumerName: p.consumer?.user?.name || 'Unknown',
                    amount: p.amount,
                    mode: p.mode,
                    paidAt: p.paidAt,
                    status: p.status,
                })),
                recentComplaints: recentComplaints.map((c) => ({
                    id: c.id,
                    consumerName: c.consumer?.user?.name || 'Unknown',
                    type: c.type,
                    status: c.status,
                    createdAt: c.createdAt,
                })),
                monthlyRevenue,
            },
        });
    } catch (error) {
        console.error('getDashboardStats Error:', error);
        res.status(500).json({ success: false, message: 'Server error.', error: error.message });
    }
};


module.exports = { getAllBills, getMyBills, generateBill, getBillById, getDashboardStats };
