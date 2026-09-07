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

## 三、基建迁移:退役大陆阿里云(省$300/月)· 进行中
- **大陆 8.160.175.232(阿里云·key ~/.ssh/xinshen)**:217次请求**全是bot**(Let's Encrypt/Googlebot/IP扫描)·**零真实用户**·4个测试用户
- **它跑着**:mylumee.cn/wujing.mylumee.cn(转发HK)+ **彩镜caijing(/caijing静态40M)** + **YiYi(/yiyi-api→:8770 speech服务+/yiyi-ceping)**
- **HK已有**:Lumee/舞镜(:3006)/shenyuan/mylumee.cn块。**HK只缺彩镜+YiYi**
- **迁移剩余步骤**:①拷caijing+yiyi-ceping静态→HK /www/ ②yiyi_speech_service.py→HK起:8770 ③HK Caddy加/caijing、/yiyi-api、/yiyi-ceping + wujing.mylumee.cn ④DNS改.cn→HK(Namecheap/阿里云DNS·⚠️.cn指HK中国访问降级/ICP风险·但无真实用户可接受)⑤关阿里云实例
- 静态站已备份本地:`~/Desktop/大陆迁移HK-*/www/`(caijing40M/wujing24M)+ `~/Desktop/大陆服务器备份-*/xinshen-大陆.db`

## 🔴 红线/坑
- 别关HK 47.242.80.65(hub+所有项目)·只释放大陆8.160.175.232
- .cn指HK有ICP/中国墙风险(无真实用户可接受)
- 改HK Caddy前备份+`caddy validate`+reload后验证Lumee/flexpup-hub没断
- flexpup仓库**公开**·密钥只进Vercel env不进代码
- POD默认草稿(confirm:false)·Karen在Printful后台确认才印

## 下一步
- 完成HK迁移(彩镜+YiYi)→改DNS→关阿里云
- FlexPup:面相报告(视觉版)· POD前端接主app肖像结果页 · 缩略图补齐scenes.json同步
- 增长中台:走路A扩Lumee hub(先设计后建)
