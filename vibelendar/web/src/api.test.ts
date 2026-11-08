import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([['/vibelendar/', '/vibelendar/api'], ['/', '/api']])('uses base %s for API requests', async (base, expected) => {
  vi.stubEnv('BASE_URL', base);
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
  vi.stubGlobal('fetch', fetchMock);
  await api.getCalendar();
  await api.login('test');
  expect(fetchMock.mock.calls[0]![0]).toBe(`${expected}/calendar`);
  expect(fetchMock.mock.calls[1]![0]).toBe(`${expected}/login`);
  expect(fetchMock.mock.calls[1]![1].method).toBe('POST');
});
