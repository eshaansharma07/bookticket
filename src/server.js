import 'dotenv/config';
import { initEvent } from './seatService.js';
import { createApp } from './app.js';

const app = createApp();
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_EVENT_ID = process.env.DEFAULT_EVENT_ID || 'concert-2026';
const DEFAULT_TOTAL_SEATS = Number(process.env.DEFAULT_TOTAL_SEATS || 100);

app.listen(PORT, async () => {
  await initEvent(DEFAULT_EVENT_ID, DEFAULT_TOTAL_SEATS);
  console.log(`booking system running on port ${PORT}`);
  console.log(`default event: ${DEFAULT_EVENT_ID} (${DEFAULT_TOTAL_SEATS} seats)`);
});
