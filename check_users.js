const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const users = await prisma.user.findMany({
        select: { email: true, role: true }
    });
    console.log('Current Users in DB:', JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}

check();
