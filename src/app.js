import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cancelLock,
  confirmSeat,
  getEventStatus,
  getSeatMap,
  initEvent,
  lockSeat,
  oneStepBook
} from './seatService.js';

const DEFAULT_EVENT_ID = process.env.DEFAULT_EVENT_ID || 'concert-2026';
const DEFAULT_TOTAL_SEATS = Number(process.env.DEFAULT_TOTAL_SEATS || 100);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(morgan('dev'));
  app.use(express.static(publicDir));

  app.get('/api', async (_, res) => {
    const status = await getEventStatus(DEFAULT_EVENT_ID);
    res.json({ service: 'concurrent-ticket-booking-system', event: status });
  });

  app.post('/api/events/:eventId/init', async (req, res) => {
    try {
      const totalSeats = Number(req.body.totalSeats || DEFAULT_TOTAL_SEATS);
      const result = await initEvent(req.params.eventId, totalSeats);
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/events/:eventId/status', async (req, res) => {
    try {
      const result = await getEventStatus(req.params.eventId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/events/:eventId/seats', async (req, res) => {
    try {
      const result = await getSeatMap(req.params.eventId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/lock', async (req, res) => {
    try {
      const { eventId = DEFAULT_EVENT_ID, seatId, userId } = req.body;
      if (!seatId || !userId) {
        return res.status(400).json({ success: false, error: 'seatId and userId are required' });
      }

      const result = await lockSeat({ eventId, seatId, userId });
      const success = result.status === 'LOCK_ACQUIRED';

      return res.status(success ? 200 : 409).json({ success, ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/confirm', async (req, res) => {
    try {
      const { eventId = DEFAULT_EVENT_ID, seatId, userId } = req.body;
      if (!seatId || !userId) {
        return res.status(400).json({ success: false, error: 'seatId and userId are required' });
      }

      const result = await confirmSeat({ eventId, seatId, userId });
      const success = result.status === 'BOOKED_OK';

      return res.status(success ? 200 : 409).json({ success, ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/cancel', async (req, res) => {
    try {
      const { eventId = DEFAULT_EVENT_ID, seatId, userId } = req.body;
      if (!seatId || !userId) {
        return res.status(400).json({ success: false, error: 'seatId and userId are required' });
      }

      const result = await cancelLock({ eventId, seatId, userId });
      const success = result.status === 'LOCK_RELEASED';

      return res.status(success ? 200 : 409).json({ success, ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/book', async (req, res) => {
    try {
      const eventId = req.body.eventId || DEFAULT_EVENT_ID;
      const result = await oneStepBook(eventId);

      if (!result.success) {
        return res.status(409).json(result);
      }

      return res.status(200).json(result);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return app;
}
