import { prisma } from "@/lib/prisma";
const result = await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
console.log(`Removed ${result.count} expired sessions.`);
await prisma.$disconnect();
