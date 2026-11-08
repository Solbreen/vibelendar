import type { FastifyInstance } from 'fastify';
import { listCalendarUsers } from '../repo.js';
import type { AppDeps } from '../app.js';
import { fixedUsers } from '../accounts.js';

export function registerCalendarRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/calendar', async () => ({
    year: deps.config.vacationYear,
    users: listCalendarUsers(deps.db).filter((user) => {
      const ids = fixedUsers(deps.db).map((fixed) => fixed.id);
      return ids.includes(user.id);
    }),
  }));
}
