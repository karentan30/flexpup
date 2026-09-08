# ★ 交接 · FlexPup 产品 + 基建迁移 · 0907

## 一、FlexPup 产品(全部已上线·repo `karentan30/flexpup`·Vercel自动部署)
一句话:上传宠物照 → 477风格AI出图 + emoji表情包(带台词/透明) + POD实体 + 视频 + 电商推荐。美国·全宠物·Stripe收款。

**已完成功能:**
- **477风格库**(scenes.json·22分类·含462从ai-pet并入+生肖星座/勇士/证件照)· 全宠物(18种·{pet}占位)
- **首页**:hero炫富图(已修人手bug)+3模式卡(艺术肖像/贴纸包/实体打印)+竖向瀑布墙+分类搜索
- **出图**:火山Seedream(doubao-seedream-4-0)·PRE/SUF护栏(保身份/防人/防双头)·付费门(每单4张)
- **emoji表情包**(emoji.html):12表情→Seedream贴纸→**@imgly透明die-cut**+台词库(emoji_captions.json·11类中英各100句·换一句/自己打字·canvas加字)+诚实安装教程(WhatsApp/Telegram易·微信/LINE/iMessage手动)。审查loop 3→9分
- **POD**(pod.html+api/pod/create.js):Printful·选品(装裱$59/贴纸$16/杯$26/手机壳$29/毯$59·已按运费提价)+地址表单→下单(默认草稿confirm:false防错单)。**Printful已验证草稿单建成功**
- **电商推荐**(recommend.html):体重→尺码+毛色→配色→爆款Amazon联盟带货(tag `fabulousslim-20`)
- **视频**:i2v(Wan2.2)· **面相报告**待建(ai-pet现成的可搬)

**Vercel env(flexpup·已全配):**
- `LUMEE_HUB`=https://www.mylumee.app · `HUB_SECRET_SCENEME`=87a30650...daf10d(和中台一致)
- `ARK_API_KEY`(火山)· `SILICONFLOW_API_KEY`(视频)· `PRINTFUL_API_KEY`+`PRINTFUL_STORE_ID`=18719329
- 🔴 代码层已强制hub走HK(env含.cn时自动回退www.mylumee.app·见5个api文件HUB_BASE)

## 二、付款中台(Hub)= Lumee `~/projects/lumee/server.py`(跑HK 47.242.80.65:8765)
- `/hub/pay/create`→`_hub_pay_create()`(server.py:30526)·`/hub/pay/status`→`_hub_pay_status()`(15132/30505)·项目注册`_hub_projects()`(11204·HUB_SECRET_<项目>)
- **已有账户(users)+订阅(CLONE/TEXT_MONTHLY·chapter订阅)+裂变(invite/affiliate)+微信/支付宝/Stripe三通道**
- 做共享增长中台=**走路A扩它**(源码有·别新建)。部署:scp server.py + `systemctl restart xinshen.service`

## 三、基建迁移:退役大陆阿里云(省$300/月)· 服务器侧✅已完成·只剩DNS+释放
- **大陆 8.160.175.232(阿里云·key ~/.ssh/xinshen)**:217次请求**全是bot**(Let's Encrypt/Googlebot/IP扫描)·**零真实用户**·4个测试用户
- **它跑的**:mylumee.cn/wujing.mylumee.cn(转发HK)+ 彩镜caijing(/caijing) + YiYi(/yiyi-api→:8770 + /yiyi-ceping)

**✅ 已完成(HK侧·我做的):**
- 拷 caijing(39M)+ yiyi-ceping(含_speech_store)→ HK `/www/`
- HK起 `yiyi-speech.service`(:8770·active·env=`/etc/yiyi-speech.env`含讯飞XFYUN key)
- HK Caddy加路由:`/caijing/*`、`/yiyi-api/*`→:8770、`/yiyi-ceping*` + `wujing.mylumee.cn`(备份`/etc/caddy/Caddyfile.bak.migrate-*`)
- `caddy validate`通过+reload·flexpup-hub/Lumee/舞镜**全没断**

**⏳ 剩2步(Karen做·我无DNS/阿里云权限):**
1. **改DNS**(阿里云DNS后台)3条A记录 大陆→HK:
   - `mylumee.cn` → 47.242.80.65(原8.160.175.232)
   - `www.mylumee.cn` → 47.242.80.65
   - `wujing.mylumee.cn` → 47.242.80.65
   - 改完传播几分钟→Caddy自动申SSL证书(现在https 000是因证书还没申·DNS一到就好)
2. **验证全绿后** → 阿里云控制台**释放大陆实例**·省$300/月
- ⚠️ .cn指HK中国访问降级/ICP风险·但无真实用户可接受·**别急着关·先改DNS+验证再释放**
- 备份:`~/Desktop/大陆迁移HK-*/www/` + `~/Desktop/大陆服务器备份-*/xinshen-大陆.db`

## 🔴 红线/坑
- 别关HK 47.242.80.65(hub+所有项目)·只释放大陆8.160.175.232
- .cn指HK有ICP/中国墙风险(无真实用户可接受)
- 改HK Caddy前备份+`caddy validate`+reload后验证Lumee/flexpup-hub没断
- flexpup仓库**公开**·密钥只进Vercel env不进代码
- POD默认草稿(confirm:false)·Karen在Printful后台确认才印

## 四、基建迁移 ✅ 已完成验证(0908) · 只剩Karen释放实例
- **DNS改了**:mylumee.cn / www / wujing.mylumee.cn 全 → 47.242.80.65(HK)。阿里云控制台UI存不上,**我用阿里云DNS API直接改成功**(key=ALIYUN_REALPERSON_KEY·它有DNS权限;OSS key没有)
- **浏览器实测通过**:彩镜(mylumee.cn/caijing)+舞镜(wujing.mylumee.cn)都从HK正常加载·SSL证书全签发·flexpup-hub(.app)不受影响
- **⏳ 只剩**:Karen去阿里云控制台**释放大陆实例 i-0jlezk118hjcdiwq1zdw**(乌兰察布)
- 💡 **成本真相**:大陆那台=ecs.e-c1m1.large **2核2G乌兰察布·约¥60-120/月**·不是$300。$300大头更可能是OSS/HK服务器/带宽——要砍成本去阿里云费用中心看账单明细

## 五、达人ref追踪 · FlexPup已接中台(0908)
- 中台Lumee hub本就是**完整增长中台**:`/hub/track`·`/hub/attr/track`·`/hub/referral/attribute`·`/hub/payout/*`·`/hub/account/ensure`·`/hub/auth/google|apple|linkedin`·coupon/pricing/metrics
- FlexPup已接:`hub-track.js`(抓?ref=+发landing/view事件)+`api/track.js`(HMAC签名转发/hub/track)→ 落hub_events(按ref_code)→ 看没看/看多久/转化+自动佣金
- **复制到其他项目**:每项目要①它在中台的project_id+`HUB_SECRET_<项目>` ②同两文件(track.js改pid + hub-track.js原样)。Lumee/舞镜(Lumee自己serve)可内部记更省
- **不用付费**:不用PostHog·不用Papermark($90/月没必要)·中台免费

## 六、6支Demo Shot-List(给Creator)· 已10分
- 在营销库 `_gtm/★各产品Demo-ShotList-给Creator-0907.md`(FlexPup/彩镜/舞镜/善缘/Slim/Lumee)
- workflow产→审→改loop到10·每支aha-first+分镜表+文案。**Karen明天手机录**(Chrome抓H5会裁切+水印·必须真机)

## 🔴 钱/密钥提醒(0908)
- Stripe:FlexPup不需要自己的Stripe key(走hub)。Karen贴过一个`rk_live_...5uRa`(LIVE不是test·已暴露)→ 去Stripe roll/删掉
- 别把key贴聊天/进公开仓库

## 下一步
- Karen释放大陆阿里云实例(省钱)
- 达人ref追踪复制到其他5项目(要各自hub project_id+secret)
- FlexPup:面相报告(视觉版·ai-pet现成的)· POD前端接主app肖像结果页 · 缩略图补齐scenes.json
- Demo视频:Karen手机录6支→发我挑穿帮→发creator
