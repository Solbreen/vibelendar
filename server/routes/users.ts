import type { FastifyInstance } from 'fastify';
import { createSaveDaysSchema, userIdParamsSchema } from '../../shared/schemas.js';
import { ApiError, userNotFound, versionConflict } from '../errors.js';
import { parseOrThrow } from '../validate.js';
import { getUser, saveDays } from '../repo.js';
import type { AppDeps } from '../app.js';
import { currentUserId } from '../auth.js';
import { fixedUsers } from '../accounts.js';
import { overlapIssues } from '../vacation-rules.js';
import { vacationIssues } from '../../shared/vacation-rules.js';
import { z } from 'zod';

export function registerUserRoutes(app: FastifyInstance, { db, config }: AppDeps): void {
  app.post('/api/users/:id/days/clear', async (request) => {
    const owner = currentUserId(db, request);
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    if (owner !== id) throw new ApiError(403, 'FORBIDDEN', 'Можно изменять только свои дни отпуска');
    const { version } = parseOrThrow(z.object({ version: z.number().int().min(0) }), request.body);
    const result = saveDays(db, id, [], version);
    if (result.status === 'not_found') throw userNotFound();
    if (result.status === 'conflict') throw versionConflict(result.user);
    return { user: result.user };
  });
  app.get('/api/users/:id', async (request) => {
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    const user = fixedUsers(db).find((user) => user.id === id);
    if (!user) throw userNotFound();
    return { user };
  });
  app.put('/api/users/:id/days', async (request) => {
    const owner = currentUserId(db, request);
    const { id } = parseOrThrow(userIdParamsSchema, request.params);
    if (owner !== id) throw new ApiError(403, 'FORBIDDEN', 'Можно изменять только свои дни отпуска');
    const body = parseOrThrow(createSaveDaysSchema(config.vacationYear), request.body, [['dates', 'INVALID_DATE']]);
    const dates = [...new Set(body.dates)].sort();
    return db.transaction(() => {
      const current = getUser(db, id)!;
      if (current.version !== body.version) throw versionConflict(current);
      const issues = [...vacationIssues(dates), ...overlapIssues(id, dates, fixedUsers(db))];
      if (issues.length) throw new ApiError(400, 'VACATION_RULES', issues.join('\n'));
      const result = saveDays(db, id, dates, body.version);
      if (result.status === 'not_found') throw userNotFound();
      if (result.status === 'conflict') throw versionConflict(result.user);
      return { user: result.user };
    })();
  });
}
