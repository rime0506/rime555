import { applyCors, handleOptions, normalizeAddress, parseJsonBody, requireAccess, serializeError } from '../lib/http.js';
import { sendLoopMessageText } from '../lib/loopmessage.js';
import { assertInboxConsumerLease } from '../lib/queue.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  applyCors(req, res);
  if (req.method !== 'POST') return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED', error: '只支持 POST' });
  if (!requireAccess(req, res)) return;

  try {
    const body = parseJsonBody(req);
    const recipient = normalizeAddress(body.recipient);
    const text = String(body.text || '').trim();
    const senderId = String(body.senderId || '').trim();
    const clientMessageId = String(body.clientMessageId || '').trim();
    const consumerId = String(body.consumerId || '').trim();

    if (!recipient) return res.status(400).json({ success: false, code: 'INVALID_RECIPIENT', error: '接收者必须是国际格式手机号或 Apple ID 邮箱' });
    if (!text) return res.status(400).json({ success: false, code: 'EMPTY_TEXT', error: '消息内容不能为空' });
    if (text.length > 2000) return res.status(400).json({ success: false, code: 'TEXT_TOO_LONG', error: '消息内容不能超过 2000 个字符' });
    if (senderId.length > 200) return res.status(400).json({ success: false, code: 'INVALID_SENDER', error: 'Sender ID 格式不正确' });
    if (clientMessageId.length > 200) return res.status(400).json({ success: false, code: 'INVALID_CLIENT_ID', error: 'clientMessageId 格式不正确' });
    if (consumerId) {
      const ownsInbox = await assertInboxConsumerLease(consumerId);
      if (!ownsInbox) {
        return res.status(409).json({ success: false, code: 'INBOX_LEASE_LOST', error: '这个页面已不再负责自动回复，已取消重复发送' });
      }
    }

    const result = await sendLoopMessageText({ senderId, recipient, text, clientMessageId });
    return res.status(200).json({ success: true, provider: 'loopmessage', ...result });
  } catch (error) {
    const parsed = serializeError(error);
    return res.status(error?.status >= 400 ? error.status : 502).json({ success: false, ...parsed });
  }
}
