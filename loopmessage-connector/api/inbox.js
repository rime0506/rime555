import { applyCors, handleOptions, parseJsonBody, requireAccess } from '../lib/http.js';
import { acknowledgeInboundEvents, listInboundEvents } from '../lib/queue.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);
  if (!requireAccess(req, res)) return;

  try {
    if (req.method === 'GET') {
      const result = await listInboundEvents(req.query?.limit, req.query?.consumerId);
      return res.status(200).json({ success: true, ...result });
    }
    if (req.method === 'POST') {
      const body = parseJsonBody(req);
      const webhookIds = Array.isArray(body.webhookIds) ? body.webhookIds : [];
      const acknowledged = await acknowledgeInboundEvents(webhookIds);
      return res.status(200).json({ success: true, acknowledged });
    }
    return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: '只支持 GET 或 POST' });
  } catch (error) {
    return res.status(error?.status >= 400 ? error.status : 503).json({
      success: false,
      code: error?.code || 'INBOX_FAILED',
      error: String(error?.message || '入站消息队列暂时不可用').slice(0, 300)
    });
  }
}
