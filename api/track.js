/**
 * POST /api/track   body: { event, ref_code?, distinct_id?, props? }
 *   前端埋点转发到 Lumee 增长中台 /hub/track(HMAC 签名·密钥只在服务端)。
 *   中台把事件落 hub_events(project_id, event, ref_code, distinct_id, props)——
 *   于是"哪个达人码带来多少 landing/view/转化"统一进中台,可跨项目切片 + 自动算佣金。
 * Env: LUMEE_HUB, HUB_SECRET_SCENEME(同 pay/generate)
 */
'use strict';
const { createHmac } = require('crypto');
// hub base: 强制香港(env空或仍是大陆.cn时回退)
const HUB_BASE = (function(){var h=(process.env.LUMEE_HUB||'').replace(/\/$/,'');return (!h||/mylumee\.cn/.test(h))?'https://www.mylumee.app':h;})();
const HUB_SECRET = process.env.HUB_SECRET_SCENEME || '';
const PROJECT_ID = 'sceneme';

function hubSign(secret, payload) { return createHmac('sha256', secret).update(Buffer.from(payload, 'utf-8')).digest('hex'); }
function readBody(req) {
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve => { let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'))}catch{resolve({})}}); req.on('error',()=>resolve({})); });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!HUB_BASE || !HUB_SECRET) return res.status(200).json({ ok: false, skipped: 'hub not configured' }); // 埋点失败不影响用户

  const b = await readBody(req);
  const event = (b.event || '').toString().slice(0, 80);
  if (!event) return res.status(400).json({ error: 'missing event' });
  const payload = {
    event,
    ref_code:    (b.ref_code || '').toString().slice(0, 64),
    distinct_id: (b.distinct_id || '').toString().slice(0, 120),
    customer_key:(b.customer_key || '').toString().slice(0, 120),
    props:       b.props && typeof b.props === 'object' ? b.props : {},
  };
  const raw = JSON.stringify(payload);
  const sign = hubSign(HUB_SECRET, raw);
  try {
    const r = await fetch(`${HUB_BASE}/hub/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Project-Id': PROJECT_ID, 'X-Sign': sign },
      body: raw,
    });
    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    return res.status(200).json({ ok: false }); // 埋点静默失败,不打扰用户
  }
};
