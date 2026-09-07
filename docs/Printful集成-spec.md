# Printful POD 集成 Spec · FlexPup

## 一句话
用户在结果页点"Order prints"→选产品(装裱画/手机壳/马克杯/毯子/贴纸纸)→填地址付款→我们把生成的高清图+产品SKU+地址发给Printful API→Printful代印代发→我们赚差价。

## 第一步:账号(Karen做·10分钟)
1. printful.com 注册免费账号
2. Settings → Stores → 建一个 "API" store(不用Shopify)
3. Settings → API → 生成 **Private token**(存Vercel env `PRINTFUL_API_KEY`·勿入git)
4. Billing 加张卡(Printful下单时扣批发价·你从用户收零售价)

## 第二步:选品+定价(Karen定)
浏览 Printful Catalog,记下每个产品的 variant_id + 批发价,定零售价:
| 产品 | Printful产品 | 批发价 | 零售价 | 赚 |
|---|---|---|---|---|
| 装裱海报 | Framed poster | ~$18-25 | $39 | ~$16 |
| 手机壳 | Phone case | ~$10-13 | $29 | ~$17 |
| 马克杯 | Mug 11oz | ~$8 | $22 | ~$14 |
| 贴纸纸 | Kiss-cut sticker sheet | ~$3-5 | $12 | ~$8 |
| 毯子 | Fleece blanket | ~$22-30 | $59 | ~$30 |

## 第三步:后端(写代码·2个endpoint)
### `POST /api/pod/create` (Node·Vercel function)
输入:{ imageUrl(生成的高清图), variant_id, orderNo(已付款), shipping{name,address1,city,state,country,zip} }
1. 校验 orderNo 已付款(同 generate.js 的 HMAC/hub 验签)
2. 调 Printful 建单:
   POST https://api.printful.com/orders
   Authorization: Bearer PRINTFUL_API_KEY
   body: {
     recipient: shipping,
     items: [{ variant_id, quantity:1, files:[{ url: imageUrl }] }]
   }
   (可先 confirm:false 建草稿→前端确认→PUT /orders/{id}/confirm 下印)
3. 存订单号,返回 {ok, printful_order_id, estimated}

### 生产图要求
- Printful 要**高清印刷图**(300 DPI·大尺寸)。当前 generate 出的是 1024/1536,够贴纸/杯子;大装裱画建议出图时 size 调大(Seedream 支持 2048)或用 Printful 的 mockup 检查 DPI 警告。
- files.url 必须是**公网可访问的图片URL**(生成图存 OSS/Vercel Blob·别用 base64)

### 结算/退款
- Printful 自动扣你卡的批发价;你的零售价通过 Stripe 已收
- 退货走 Printful 政策(印刷品一般不退·质量问题重印)

## 第四步:MVP 更快的路(不写代码先跑)
- 用 Printful 的 **Shopify/Etsy 集成**:建个 Shopify 店→Printful 连上→把生成图当产品图手动/半自动上架→FlexPup 结果页"Order prints"跳到 Shopify 商品页。跑通验证需求后再上 API 自动化。

## 🔴 红线
- files.url 用公网URL不用base64;PRINTFUL_API_KEY 只在服务端;印刷图版权=用户自己宠物照(已授权门);别印真人名人/品牌logo
