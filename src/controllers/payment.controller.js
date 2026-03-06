const prisma = require('../config/prisma');
const { createNotification } = require('./notification.controller');

// ─────────────────────────────────────────
// POST /api/payments  (Consumer - pay a bill)
// ─────────────────────────────────────────
const processPayment = async (req, res) => {
    try {
        const { billId, amount, mode } = req.body;
        const userId = req.user.id;

        if (!billId || !amount) {
            return res.status(400).json({ success: false, message: 'Bill ID and amount are required.' });
        }

        const consumer = await prisma.consumer.findUnique({ where: { userId } });
        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer profile not found.' });

        const bill = await prisma.bill.findUnique({ where: { id: Number(billId) } });
        if (!bill) return res.status(404).json({ success: false, message: 'Bill not found.' });
        if (bill.status === 'PAID') return res.status(400).json({ success: false, message: 'Bill is already paid.' });

        // In a real app, integrate payment gateway here
        const payment = await prisma.$transaction(async (tx) => {
            const p = await tx.payment.create({
                data: {
                    billId: Number(billId),
                    consumerId: consumer.id,
                    amount: Number(amount),
                    mode: mode || 'ONLINE',
                    status: 'SUCCESS',
                    paidAt: new Date(),
                },
            });

            await tx.bill.update({
                where: { id: Number(billId) },
                data: { status: 'PAID' },
            });

            return p;
        });

        // Trigger Notification
        await createNotification(
            userId,
            'Payment Successful ✅',
            `Thank you! Your payment of ₹${Number(amount).toFixed(2)} for Bill #${bill.billNumber || bill.id} has been received successfully.`
        );

        res.status(201).json({
            success: true,
            message: 'Payment processed successfully.',
            data: payment,
        });
    } catch (error) {
        console.error('processPayment Error:', error);
        res.status(500).json({ success: false, message: 'Server error during payment.' });
    }
};

// ─────────────────────────────────────────
// GET /api/payments/my  (Consumer - own history)
// ─────────────────────────────────────────
const getMyPayments = async (req, res) => {
    try {
        const consumer = await prisma.consumer.findUnique({ where: { userId: req.user.id } });
        if (!consumer) return res.status(404).json({ success: false, message: 'Consumer not found.' });

        const payments = await prisma.payment.findMany({
            where: { consumerId: consumer.id },
            include: { bill: { select: { billMonth: true, billNumber: true } } },
            orderBy: { paidAt: 'desc' },
        });

        res.status(200).json({ success: true, data: payments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

// ─────────────────────────────────────────
// GET /api/payments  (Admin)
// ─────────────────────────────────────────
const getAllPayments = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({
            include: {
                consumer: { include: { user: { select: { name: true } } } },
                bill: { select: { billNumber: true } },
            },
            orderBy: { paidAt: 'desc' },
        });

        const formatted = payments.map((p) => ({
            id: p.id,
            transactionId: p.transactionId,
            consumerName: p.consumer.user.name,
            amount: p.amount,
            mode: p.mode,
            status: p.status,
            paidAt: p.paidAt,
            billNumber: p.bill.billNumber,
        }));

        res.status(200).json({ success: true, data: formatted });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
};

module.exports = { processPayment, getMyPayments, getAllPayments };
