import { applyCors, handleOptions, requireAccess, serializeError } from '../lib/http.js';
import { testLoopMessageCredentials } from '../lib/loopmessage.js';
import { isInboxConfigured, pingInbox } from '../lib/queue.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);
  if (req.method !== 'GET') return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: '只支持 GET' });
  if (!requireAccess(req, res)) return;

  try {
    const result = await testLoopMessageCredentials();
    const inboxConfigured = isInboxConfigured();
    let inboxConnected = false;
    let inboxError = '';
    if (inboxConfigured) {
      try {
        inboxConnected = await pingInbox();
      } catch (error) {
        inboxError = String(error?.message || '队列连接失败').slice(0, 200);
      }
    }
    return res.status(200).json({
      success: true,
      provider: 'loopmessage',
      loopMessageConnected: true,
      senderCount: result.senderCount,
      inboxConfigured,
      inboxConnected,
      inboxError,
      version: '2.1.0'
    });
  } catch (error) {
    const parsed = serializeError(error);
    return res.status(error?.status >= 400 ? error.status : 502).json({ success: false, loopMessageConnected: false, ...parsed });
  }
}
