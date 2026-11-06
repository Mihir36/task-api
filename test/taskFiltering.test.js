import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, beforeEach, mock, test } from 'node:test';
import express from 'express';
import prisma from '../src/config/db.js';
import taskRoutes from '../src/routes/taskRoutes.js';

const tasks = [
  { id: 1, title: 'Completed task', completed: true },
  { id: 2, title: 'Incomplete task', completed: false },
  { id: 3, title: 'Legacy task', completed: null },
];
const originalFindMany = prisma.task.findMany;
const findMany = mock.fn(async ({ where }) =>
  where.completed === undefined
    ? tasks
    : tasks.filter((task) => task.completed === where.completed),
);
prisma.task.findMany = findMany;

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use('/tasks', taskRoutes);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => findMany.mock.resetCalls());

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  prisma.task.findMany = originalFindMany;
  await prisma.$disconnect();
});

test('GET /tasks returns every task without a completed filter', async () => {
  const response = await fetch(`${baseUrl}/tasks`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), tasks);
  assert.deepEqual(findMany.mock.calls[0].arguments, [{ where: {} }]);
});

for (const completed of [true, false]) {
  test(`GET /tasks?completed=${completed} filters using a boolean`, async () => {
    const response = await fetch(`${baseUrl}/tasks?completed=${completed}`);
    assert.equal(response.status, 200);
    assert.deepEqual(
      await response.json(),
      tasks.filter((task) => task.completed === completed),
    );
    assert.deepEqual(findMany.mock.calls[0].arguments, [{ where: { completed } }]);
  });
}

for (const query of [
  'completed=invalid',
  'completed=',
  'completed=1',
  'completed=0',
  'completed=TRUE',
  'completed=null',
  'completed=true&completed=false',
]) {
  test(`GET /tasks?${query} rejects invalid input before querying the database`, async () => {
    const response = await fetch(`${baseUrl}/tasks?${query}`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: 'Validation failed',
      details: ['completed must be true or false'],
    });
    assert.equal(findMany.mock.callCount(), 0);
  });
}
