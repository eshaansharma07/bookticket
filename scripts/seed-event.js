import 'dotenv/config';
import { initEvent } from '../src/seatService.js';

const eventId = process.argv[2] || process.env.DEFAULT_EVENT_ID || 'concert-2026';
const totalSeats = Number(process.argv[3] || process.env.DEFAULT_TOTAL_SEATS || 100);

(async () => {
  const result = await initEvent(eventId, totalSeats);
  console.log('Event initialized:', result);
  process.exit(0);
})();
