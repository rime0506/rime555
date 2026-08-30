const INBOX_KEY = 'loopmessage:inbox:v1';
const EVENT_PREFIX = 'loopmessage:event:v1:';
const DEDUPE_PREFIX = 'loopmessage:dedupe:v1:';
const INBOX_CONSUMER_LEASE_KEY = 'loopmessage:inbox:consumer:v1';
const EVENT_TTL_SECONDS = 7 * 24 * 60 * 60;
const CONSUMER_LEASE_TTL_SECONDS = 90;
const MAX_INBOX_ITEMS = 500;

function getRedisConfig() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) {
    throw Object.assign(new Error('缺少 UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN'), {
      code: 'INBOX_NOT_CONFIGURED',
      status: 503
    });
  }
  return { url, token };
}

async function redisRequest(path, body) {
  const { url, token } = getRedisConfig();
  const response = await fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  let payload = null;
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) {
    throw Object.assign(new Error(payload?.error || `Upstash Redis HTTP ${response.status}`), {
      code: 'INBOX_STORAGE_FAILED',
      status: 503
    });
  }
  if (Array.isArray(payload)) {
    const failed = payload.find(item => item?.error);
    if (failed) throw Object.assign(new Error(failed.error), { code: 'INBOX_STORAGE_FAILED', status: 503 });
  } else if (payload?.error) {
    throw Object.assign(new Error(payload.error), { code: 'INBOX_STORAGE_FAILED', status: 503 });
  }
  return payload;
}

async function redisCommand(command) {
  const payload = await redisRequest('', command);
  return payload?.result;
}

async function redisPipeline(commands) {
  const payload = await redisRequest('/pipeline', commands);
  return payload.map(item => item?.result);
}

function eventKey(webhookId) {
  return `${EVENT_PREFIX}${webhookId}`;
}

function dedupeKey(webhookId) {
  return `${DEDUPE_PREFIX}${webhookId}`;
}

export function isInboxConfigured() {
  return !!String(process.env.UPSTASH_REDIS_REST_URL || '').trim()
    && !!String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
}

export async function pingInbox() {
  return (await redisCommand(['PING'])) === 'PONG';
}

export async function enqueueInboundEvent(event) {
  const webhookId = String(event.webhookId || '');
  if (!webhookId) throw Object.assign(new Error('Webhook 缺少 webhook_id'), { code: 'INVALID_WEBHOOK', status: 400 });
  const script = `
    if redis.call('SET', KEYS[1], '1', 'EX', ARGV[1], 'NX') then
      redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[1])
      redis.call('ZADD', KEYS[3], ARGV[3], ARGV[4])
      redis.call('ZREMRANGEBYRANK', KEYS[3], 0, -${MAX_INBOX_ITEMS + 1})
      redis.call('EXPIRE', KEYS[3], ARGV[1])
      return 1
    end
    return 0
  `;
  const result = await redisCommand([
    'EVAL', script, '3',
    dedupeKey(webhookId), eventKey(webhookId), INBOX_KEY,
    String(EVENT_TTL_SECONDS), JSON.stringify(event), String(event.receivedAt || Date.now()), webhookId
  ]);
  return Number(result) === 1;
}

export async function assertInboxConsumerLease(consumerId) {
  const owner = String(consumerId || '').trim();
  if (!owner || owner.length > 200) {
    throw Object.assign(new Error('读取入站队列需要有效的 consumerId，请刷新到最新版网站'), {
      code: 'INVALID_CONSUMER_ID',
      status: 400
    });
  }
  const script = `
    local current = redis.call('GET', KEYS[1])
    if not current then
      if redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2], 'NX') then
        return 1
      end
      current = redis.call('GET', KEYS[1])
    end
    if current == ARGV[1] then
      redis.call('EXPIRE', KEYS[1], ARGV[2])
      return 1
    end
    return 0
  `;
  const result = await redisCommand([
    'EVAL', script, '1', INBOX_CONSUMER_LEASE_KEY,
    owner, String(CONSUMER_LEASE_TTL_SECONDS)
  ]);
  return Number(result) === 1;
}

export async function listInboundEvents(limit = 100, consumerId = '') {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  const leaseAcquired = await assertInboxConsumerLease(consumerId);
  if (!leaseAcquired) {
    return { events: [], leaseAcquired: false, leaseTtlSeconds: CONSUMER_LEASE_TTL_SECONDS };
  }
  const ids = await redisCommand(['ZRANGE', INBOX_KEY, '0', String(safeLimit - 1)]);
  if (!Array.isArray(ids) || ids.length === 0) {
    return { events: [], leaseAcquired: true, leaseTtlSeconds: CONSUMER_LEASE_TTL_SECONDS };
  }
  const values = await redisPipeline(ids.map(id => ['GET', eventKey(id)]));
  const events = [];
  const staleIds = [];
  values.forEach((raw, index) => {
    if (!raw) {
      staleIds.push(ids[index]);
      return;
    }
    try {
      const event = JSON.parse(raw);
      if (event?.webhookId) events.push(event);
    } catch (_) {
      staleIds.push(ids[index]);
    }
  });
  if (staleIds.length) {
    await redisCommand(['ZREM', INBOX_KEY, ...staleIds]).catch(() => {});
  }
  return { events, leaseAcquired: true, leaseTtlSeconds: CONSUMER_LEASE_TTL_SECONDS };
}

export async function acknowledgeInboundEvents(webhookIds) {
  const ids = [...new Set((webhookIds || []).map(value => String(value || '').trim()).filter(Boolean))].slice(0, 100);
  if (!ids.length) return 0;
  const results = await redisPipeline([
    ['ZREM', INBOX_KEY, ...ids],
    ['DEL', ...ids.map(eventKey)]
  ]);
  return Number(results[0]) || 0;
}
