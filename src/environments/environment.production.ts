// Production build values. These are public URLs, not secrets.
//
// API calls go through Vercel's /api rewrite (vercel.json). Vercel cannot
// proxy WebSockets, so the race socket connects straight to the backend.
export const environment = {
  apiUrl: '/api',
  wsUrl: 'wss://typeit-server.onrender.com/ws/race' as string | null,
};
