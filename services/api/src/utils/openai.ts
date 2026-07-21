import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

import { logWarn } from './logger.js';

if (!apiKey) {
  logWarn('OPENAI_API_KEY is not set. AI Perspectives are unavailable outside the test environment.');
}

export const openai = apiKey ? new OpenAI({ apiKey }) : null;
