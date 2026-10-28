// Development defaults (`ng serve`). In production builds this file is
// replaced by environment.production.ts (see fileReplacements in angular.json).
//
// `ng serve` proxies /api and /ws to localhost:3000 via proxy.conf.json, so
// the race socket needs no explicit URL here.
export const environment = {
  apiUrl: '/api',
  wsUrl: null as string | null,
};
