import type { Request, Response } from 'express';
import { createApp } from '../src/serverApp';

let cachedApp: ReturnType<typeof createApp> | null = null;

export default function handler(req: Request, res: Response) {
  try {
    if (!cachedApp) {
      cachedApp = createApp();
    }
    return cachedApp(req, res);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Server initialization error',
    });
  }
}
