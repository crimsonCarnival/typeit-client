// App-wide configuration.
// During `ng serve`, requests to /api are proxied to localhost:3000 via proxy.conf.json.
// During `ng build`, set NG_APP_API_BASE in .env to point at the real backend URL.
export const environment = {
  apiUrl: (import.meta.env?.['NG_APP_API_BASE'] as string | undefined) || '/api',
};
