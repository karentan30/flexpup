/**
 * POST /api/pod/create   body: { product, model?, imageUrl, orderNo, shipping:{name,address1,city,state_code,country_code,zip} }
 *   把生成图印成实体(Printful POD)。必须已付款订单(向中台核实)才下单。
 *   默认建「草稿单」(confirm:false)——不自动印,Karen 在 Printful 后台确认后才生产(防错单烧钱)。
 *
 * Env(Vercel 设·勿入 git):
 *   PRINTFUL_API_KEY   — Printful 私有 token
 *   PRINTFUL_STORE_ID  — Printful 店铺 id(默认 18719329 = flexpup's Store)
 *   PRINTFUL_CONFIRM   — 设为 '1' 则自动确认下印(默认草稿)
 *   LUMEE_HUB / HUB_SECRET_SCENEME — 中台付款验签(同 generate.js)
 */
'use strict';
const { createHmac } = require('crypto');
const PRODUCTS = require('../../pod_products.json');

const PF_KEY   = (process.env.PRINTFUL_API_KEY || '').trim();
const PF_STORE = (process.env.PRINTFUL_STORE_ID || '18719329').trim();
const PF_CONFIRM = process.env.PRINTFUL_CONFIRM === '1';
// hub base: force Hong Kong (www.mylumee.app) when env is empty or still the decommissioned mainland .cn
const HUB_BASE = (function(){var h=(process.env.LUMEE_HUB||'').replace(/\/$/,'');return (!h||/mylumee\.cn/.test(h))?'https://www.mylumee.app':h;})();
const HUB_SECRET = process.env.HUB_SECRET_SCENEME || '';
const PROJECT_ID = 'sceneme';

function hubSign(secret, payload) { return createHmac('sha256', secret).update(Buffer.from(payload, 'utf-8')).digest('hex'); }
function readBody(req) {
  return new Promise(resolve => { let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'))}catch{resolve({})}}); req.on('error',()=>resolve({})); });
}
async function isOrderPaid(orderNo) {
  if (!HUB_BASE || !HUB_SECRET) return false;
  const sign = hubSign(HUB_SECRET, `project_id=${PROJECT_ID}&order_no=${orderNo}`);
  try {
    const r = await fetch(`${HUB_BASE}/hub/pay/status?project_id=${PROJECT_ID}&order_no=${encodeURIComponent(orderNo)}`,
      { headers: { 'X-Project-Id': PROJECT_ID, 'X-Sign': sign }, cache: 'no-store' });
    const j = await r.json(); return j?.status === 'paid';
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!PF_KEY) return res.status(503).json({ error: 'Print service not configured.' });

  const b = await readBody(req);
  const prod = PRODUCTS[b.product];
  if (!prod) return res.status(400).json({ error: 'Unknown product.' });

  // variant: phone case needs a model → variant map; else the product's default variant
  let variantId = prod.printful_variant_id;
  if (prod.needsModel) {
    if (!b.model || !prod.models || !prod.models[b.model]) return res.status(400).json({ error: 'Pick a phone model.' });
    variantId = prod.models[b.model];
  }

  const img = typeof b.imageUrl === 'string' && /^https:\/\//.test(b.imageUrl) ? b.imageUrl : null;
  if (!img) return res.status(400).json({ error: 'A public image URL is required.' });

  const sh = b.shipping || {};
  for (const f of ['name','address1','city','country_code','zip']) {
    if (!sh[f] || !String(sh[f]).trim()) return res.status(400).json({ error: `Missing shipping ${f}.` });
  }

  // 🔒 付费门:必须已付款订单(POD 单独收费,orderNo = 该实体单的已付款单号)
  const orderNo = (b.orderNo || '').toString();
  if (!orderNo || !(await isOrderPaid(orderNo))) return res.status(402).json({ error: 'Payment not confirmed.', code: 'PAY' });

  const order = {
    recipient: {
      name: sh.name, address1: sh.address1, address2: sh.address2 || '',
      city: sh.city, state_code: sh.state_code || '', country_code: sh.country_code, zip: sh.zip,
    },
    items: [{ variant_id: variantId, quantity: 1, files: [{ url: img }] }],
  };

  try {
    const url = 'https://api.printful.com/orders' + (PF_CONFIRM ? '?confirm=1' : '');
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + PF_KEY, 'X-PF-Store-Id': PF_STORE, 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    const j = await r.json();
    if (r.status >= 200 && r.status < 300 && j?.result?.id) {
      return res.status(200).json({ ok: true, printful_order_id: j.result.id, status: j.result.status, confirmed: PF_CONFIRM });
    }
    console.error('[pod] printful error', r.status, JSON.stringify(j).slice(0, 400));
    return res.status(502).json({ error: (j && (j.error?.message || j.result)) || 'Print order failed.' });
  } catch (e) {
    console.error('[pod] exception', e);
    return res.status(502).json({ error: 'Print service temporarily unavailable.' });
  }
};
