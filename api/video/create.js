/**
 * POST /api/video/create   body: { scene, image, orderNo }
 *   图生视频(i2v):把已生成的场景图(用户传 data:image/... base64)动起来,出一条 ~5s 竖屏静默动图。
 *   必须验证 orderNo 已付款(同 generate.js 那套 HMAC 验签)→ 提交 SiliconFlow Wan i2v → 返回 { requestId }。
 *   成本控制:每个付款订单最多出 VIDS_PER_ORDER 条(默认2),用 global Map 计数(同 generate.js 的 orderGens 模式)。
 *   ⚠️ i2v 约 90s,Vercel serverless 有超时 → 本接口只提交拿 requestId,前端轮询 /api/video/status。
 *
 * Env(Karen 在 Vercel 设):
 *   SILICONFLOW_API_KEY — SiliconFlow key(付费·勿入 git)
 *   LUMEE_HUB           — 中台地址 https://mylumee.cn
 *   HUB_SECRET_SCENEME  — 中台签名密钥(同付款那套)
 *   VIDS_PER_ORDER      — 每单出视频数(默认2)
 */
'use strict';

const { createHmac } = require('crypto');

const SF_KEY = process.env.SILICONFLOW_API_KEY || '';
const HUB_BASE = (process.env.LUMEE_HUB || '').replace(/\/$/, '');
const HUB_SECRET = process.env.HUB_SECRET_SCENEME || '';
const PROJECT_ID = 'sceneme';
const VIDS_PER_ORDER = parseInt(process.env.VIDS_PER_ORDER || '2', 10);
const SF_MODEL = 'Wan-AI/Wan2.2-I2V-A14B';

const NEG = ',镜头轻柔缓慢,画面稳定,宠物身份和毛色始终一致不变形不糊,自然真实';
const SCENES = {
  jet: '这只宠物坐在私人飞机米色真皮座椅上轻轻眨眼微微歪头,舷窗外云朵缓缓飘动,阳光洒进,镜头极缓推近',
  yacht: '这只宠物站在游艇甲板上,海风轻轻吹动它的毛发,身后深蓝海面波光粼粼缓缓起伏,镜头缓缓横移',
  michelin: '这只宠物坐在米其林餐厅餐桌前轻轻眨眼,烛光微微摇曳,红酒杯反光闪动,镜头极缓推近',
  redcarpet: '这只宠物站在红毯上微微转头,背景闪光灯星星点点闪烁,镜头缓缓推近聚焦',
  ski: '这只宠物坐在雪山滑雪道上轻轻眨眼,细雪缓缓飘落,身后雪峰在阳光下发亮,镜头缓缓上移',
  money: '这只宠物坐在豪华沙发上微微歪头,周围风格化的钞票缓缓飘落旋转,金色灯光柔和,镜头极缓推近',
  podium: '这只宠物站在冠军领奖台上昂首,金牌轻轻晃动反光,背景观众席虚化,镜头缓缓上摇',
  tennis: '这只宠物站在红土网球场上叼着迷你网球拍轻轻眨眼,阳光下微风吹动毛发,镜头缓缓推近',
};

// scene → TikTok 文案(不接 LLM·预写模板·省钱)
const CAPTIONS = {
  jet:       { caption: "POV: your dog grew up rich ✈️",         tags: "#dogsoftiktok #richdog #petsoftiktok #fyp #doglife" },
  yacht:     { caption: "my pet said we're taking the yacht ⛵",   tags: "#dogsoftiktok #yachtlife #richpets #fyp #petlife" },
  michelin:  { caption: "table for one, my pup only eats Michelin 🍷", tags: "#dogsoftiktok #foodie #richdog #fyp #petsoftiktok" },
  redcarpet: { caption: "and the award goes to… my pet 🏆✨",       tags: "#dogsoftiktok #redcarpet #petsoftiktok #fyp #famous" },
  ski:       { caption: "gone skiing, don't wait up ⛷️",          tags: "#dogsoftiktok #skiseason #richdog #fyp #petlife" },
  money:     { caption: "make it rain 💸 my pet is loaded",        tags: "#dogsoftiktok #richdog #moneymoves #fyp #petsoftiktok" },
  podium:    { caption: "gold medal energy 🥇 nobody can tell my pet nothing", tags: "#dogsoftiktok #champion #petsoftiktok #fyp #winning" },
  tennis:    { caption: "new tennis pro just dropped 🎾",           tags: "#dogsoftiktok #tennis #richdog #fyp #petsoftiktok" },
};

function hubSign(secret, payload) {
  return createHmac('sha256', secret).update(Buffer.from(payload, 'utf-8')).digest('hex');
}

// 每个订单已用出视频数(单实例内存·MVP级)
if (!global.__fpOrderVids) global.__fpOrderVids = new Map();
const orderVids = global.__fpOrderVids;

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
  if (!SF_KEY) return res.status(503).json({ error: 'Video engine not configured.' });

  const body = await readBody(req);
  const scene = SCENES[body.scene] ? body.scene : null;
  const image = typeof body.image === 'string' && body.image.startsWith('data:') ? body.image : null;
  const orderNo = (body.orderNo || '').toString();
  if (!scene || !image) return res.status(400).json({ error: 'Missing scene or image.' });

  // 🔒 付费门:必须已付款订单 + 未超本单视频额度(堵烧钱)
  if (!orderNo.startsWith('SM')) return res.status(402).json({ error: 'Payment required.', code: 'PAY' });
  const paid = await isOrderPaid(orderNo);
  if (!paid) return res.status(402).json({ error: 'Payment not confirmed yet.', code: 'PAY' });
  const usedThisOrder = orderVids.get(orderNo) || 0;
  if (usedThisOrder >= VIDS_PER_ORDER) {
    return res.status(402).json({ error: 'Video limit reached for this order.', code: 'QUOTA' });
  }

  const prompt = SCENES[scene] + NEG;
  let sfRes, sfJson;
  try {
    sfRes = await fetch('https://api.siliconflow.cn/v1/video/submit', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + SF_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: SF_MODEL, prompt, image, image_size: '720x1280' }),
    });
    sfJson = await sfRes.json();
  } catch (e) {
    console.error('[video/create] SiliconFlow unreachable', e);
    return res.status(502).json({ error: 'Video service temporarily unavailable.' });
  }

  const requestId = sfJson?.requestId;
  if (!sfRes.ok || !requestId) {
    console.error('[video/create] SF error', sfRes.status, JSON.stringify(sfJson).slice(0, 300));
    return res.status(502).json({ error: 'Video generation failed to start, please try again.' });
  }

  // 提交成功才计数(占用本单一个额度)
  orderVids.set(orderNo, usedThisOrder + 1);
  const cap = CAPTIONS[scene] || { caption: '', tags: '' };
  return res.status(200).json({
    requestId,
    caption: cap.caption,
    tags: cap.tags,
    remaining: Math.max(0, VIDS_PER_ORDER - usedThisOrder - 1),
  });
};
