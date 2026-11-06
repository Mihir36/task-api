import prisma from '../config/db.js';

export async function findAll(completed) {
  return prisma.task.findMany({
    where: completed === undefined ? {} : { completed },
  });
}

// Create a new task
export async function create(data) {
  return prisma.task.create({
    data,
  });
}
