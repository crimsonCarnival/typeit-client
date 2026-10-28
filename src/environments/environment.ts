// App-wide configuration.
// During `ng serve`, requests to /api are proxied to localhost:3000 via proxy.conf.json.
// During `ng build`, set NG_APP_API_BASE in .env to point at the real backend URL.
// Live races use a WebSocket. Vercel rewrites can't proxy WebSockets, so in
// production set NG_APP_WS_URL to the backend directly
// (e.g. wss://typeit-server.onrender.com/ws/race). Unset, it uses the current
// host, which `ng serve` proxies to localhost:3000.
export const environment = {
  apiUrl: (import.meta.env?.['NG_APP_API_BASE'] as string | undefined) || '/api',
  wsUrl: (import.meta.env?.['NG_APP_WS_URL'] as string | undefined) || null,
};
