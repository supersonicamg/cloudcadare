/** Only paths inside the admin area, never an absolute URL or `//host` (open redirect). */
export const safeAdminNext = (v: unknown) =>
  typeof v === 'string' && /^\/admin(\/|$|\?)/.test(v) && !v.includes('//') ? v : '/admin'
