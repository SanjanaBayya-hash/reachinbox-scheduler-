import { prisma } from '../../db/prisma';

export async function listActiveSenders() {
  return prisma.sender.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, hourlyLimit: true },
    orderBy: { name: 'asc' },
  });
}
