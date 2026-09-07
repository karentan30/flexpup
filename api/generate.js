/**
 * POST /api/generate   body: { scene, image, orderNo }
 *   scene = whitelist id; image = "data:image/jpeg;base64,..."(用户宠物照); orderNo = 已付款订单号
 * 必须验证 orderNo 已付款(向中台核实)才出图 → 生成=付费,同时堵死烧钱漏洞。
 * 每个付款订单可出 GENS_PER_ORDER 张(默认4)。
 *
 * Env(Karen 在 Vercel 设):
 *   ARK_API_KEY        — 火山方舟 key(付费·勿入 git)
 *   LUMEE_HUB          — 中台地址 https://mylumee.cn
 *   HUB_SECRET_SCENEME — 中台签名密钥(同付款那套)
 *   GENS_PER_ORDER     — 每单出图数(默认4)
 */
'use strict';

const { createHmac } = require('crypto');

const ARK_KEY = process.env.ARK_API_KEY || '';
const HUB_BASE = (process.env.LUMEE_HUB || '').replace(/\/$/, '');
const HUB_SECRET = process.env.HUB_SECRET_SCENEME || '';
const PROJECT_ID = 'sceneme';
const GENS_PER_ORDER = parseInt(process.env.GENS_PER_ORDER || '4', 10);
const MODEL = 'doubao-seedream-4-0-250828';

const PRE = '真实手机抓拍照片,保持输入照片里这只宠物完全相同的样子毛色和脸(同一只宠物);';
const SUF = '。真实照片质感自然光有真实阴影,炫富贵气松弛感。不要卡通不要3D不要塑料感不要过曝不要文字不要人不要真实名人或品牌logo。';
const SCENES = {
  jet:'它坐在豪华私人飞机米色真皮座椅上戴迷你墨镜,旁边香槟杯,舷窗外蓝天云海阳光',
  yacht:'它戴迷你墨镜坐豪华游艇船头甲板,深蓝大海海风吹动毛发,阳光明媚',
  michelin:'它围着小餐巾坐米其林餐厅餐桌前,面前白瓷盘精致龙虾大餐,烛光红酒',
  redcarpet:'它戴迷你黑色领结站颁奖典礼红毯上,背景红毯与闪光灯氛围虚化',
  ski:'它戴迷你滑雪镜和小围巾坐雪山滑雪场雪道,蓝天雪峰阳光',
  money:'它戴迷你墨镜坐豪华沙发,周围漫天飘落风格化绿色钞票(非1:1仿真真钞),金色奢华客厅',
  podium:'它戴金牌站冠军领奖台最高处昂首,背景观众席虚化(不出现五环或奥运字样)',
  tennis:'它叼迷你网球拍站红土网球场,阳光运动明星感',
};

function hubSign(secret, payload) {
  return createHmac('sha256', secret).update(Buffer.from(payload, 'utf-8')).digest('hex');
}

// 每个订单已用出图数(单实例内存·MVP级)
if (!global.__fpOrderGens) global.__fpOrderGens = new Map();
const orderGens = global.__fpOrderGens;

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve) => {
    let raw=''; req.on('data',c=>raw+=c);
    req.on('end',()=>{ try{resolve(JSON.parse(raw||'{}'))}catch{resolve({})} });
    req.on('error',()=>resolve({}));
  });
}

async function isOrderPaid(orderNo) {
  if (!HUB_BASE || !HUB_SECRET) return false;
  const payload = `project_id=${PROJECT_ID}&order_no=${orderNo}`;
  const sign = hubSign(HUB_SECRET, payload);
  try {
    const r = await fetch(`${HUB_BASE}/hub/pay/status?project_id=${PROJECT_ID}&order_no=${encodeURIComponent(orderNo)}`,
      { headers: { 'X-Project-Id': PROJECT_ID, 'X-Sign': sign }, cache: 'no-store' });
    const j = await r.json();
    return (j?.status === 'paid');
  } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!ARK_KEY) return res.status(503).json({ error: 'Image engine not configured.' });

  const body = await readBody(req);
  const scene = SCENES[body.scene] ? body.scene : null;
  const image = typeof body.image === 'string' && body.image.startsWith('data:') ? body.image : null;
  const orderNo = (body.orderNo || '').toString();
  if (!scene || !image) return res.status(400).json({ error: 'Missing scene or image.' });

  // 🔒 付费门:必须已付款订单 + 未超本单额度(堵烧钱)
  if (!orderNo.startsWith('SM')) return res.status(402).json({ error: 'Payment required.', code: 'PAY' });
  const paid = await isOrderPaid(orderNo);
  if (!paid) return res.status(402).json({ error: 'Payment not confirmed yet.', code: 'PAY' });
  const usedThisOrder = orderGens.get(orderNo) || 0;
  if (usedThisOrder >= GENS_PER_ORDER) {
    return res.status(402).json({ error: 'This order is used up. Buy more to keep flexing.', code: 'QUOTA' });
  }

  const prompt = PRE + SCENES[scene] + SUF;
  let arkRes, arkJson;
  try {
    arkRes = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + ARK_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt, image, size: '1536x2048', response_format: 'url', watermark: false }),
    });
    arkJson = await arkRes.json();
  } catch (e) {
    console.error('[generate] ARK unreachable', e);
    return res.status(502).json({ error: 'Image service temporarily unavailable.' });
  }

  const url = arkJson?.data?.[0]?.url;
  if (!arkRes.ok || !url) {
    console.error('[generate] ARK error', arkRes.status, JSON.stringify(arkJson).slice(0, 300));
    return res.status(502).json({ error: 'Generation failed, please try again.' });
  }

  orderGens.set(orderNo, usedThisOrder + 1);
  return res.status(200).json({ url, remaining: Math.max(0, GENS_PER_ORDER - usedThisOrder - 1) });
};
