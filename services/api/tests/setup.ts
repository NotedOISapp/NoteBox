import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(dirname, '.integration-state.json');
if (!fs.existsSync(statePath)) {
  throw new Error('Integration environment state is missing. Vitest globalSetup did not complete.');
}
const environment = JSON.parse(fs.readFileSync(statePath, 'utf8')) as Record<string, string>;
Object.assign(process.env, environment);

const { initStorage } = await import('../src/compliance/storage.js');
await initStorage();

const { setTestVerificationAdapters } = await import('../src/services/storekitVerification.js');
setTestVerificationAdapters({
  verifyTransactionJws: async (signedPayload: string) => {
    const decoded = jwt.decode(signedPayload);
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('STOREKIT_TRANSACTION_INVALID');
    }
    return decoded as any;
  },
  verifyNotificationJws: async (signedPayload: string) => {
    const decoded = jwt.decode(signedPayload) as any;
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('STOREKIT_NOTIFICATION_INVALID');
    }
    const nested = decoded.data?.signedTransactionInfo
      ? jwt.decode(decoded.data.signedTransactionInfo)
      : null;
    return {
      decodedNotification: decoded,
      decodedTransaction: nested && typeof nested === 'object' ? nested as any : null,
    };
  },
});
