import 'dotenv/config';
import { authenticate } from './scripts/office-biotime-sync.js';

(async () => {
  try {
    const token = await authenticate();
    console.log('token', token);
  } catch (err) {
    console.error('auth error', err);
  }
})();
