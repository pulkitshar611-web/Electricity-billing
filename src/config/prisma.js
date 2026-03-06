const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

// Warm up the connection on startup so first request is fast
prisma.$connect()
    .then(() => console.log('✅ Database connected.'))
    .catch((err) => console.error('❌ Database connection failed:', err));

module.exports = prisma;
