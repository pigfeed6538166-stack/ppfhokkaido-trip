# 北海道 × 猪猪饲料 · 旅行手账

手机端 H5 旅行手账：密码门禁 → 雪白首页 → 行程 / 地图 / 提醒 / 准备 / 记账。
支持微信分享、云端实时同步、每个打卡点上传图片。

## 进入方式
打开网页先看到锁屏，输入密码 lu123321 进入。
密码在 config.js 的 accessPassword 里改。

安全说明：这是「前端门禁」，能挡住随手点开链接的人；但网页源码里能看到密码。
要做到真正的私密，需要加登录（Supabase Auth），可以后续升级。

## 页面结构
- 锁屏：输入密码进入
- 首页：白色雪山背景 + 「六日，从雪里穿过」+ 一天一张的行程卡 + 顶部导航
- 行程：航班信息、日期切换、打卡点（可上传图片、可打卡、可跳地图）
- 地图：按天切换的 Google Map
- 提醒：购票 / 预约提醒
- 准备：分类清单，可自行增删
- 记账：日元 / 人民币双币种，自动汇总并折算

## 文件结构
- index.html        页面（含白色雪山背景 SVG）
- style.css         样式（白雪 + 冰雪蓝主题）
- config.js         配置（密码 / Supabase / 汇率 / 行程ID）
- data.js           默认行程与首页文案
- store.js          存储层（localStorage + Supabase 实时同步）
- app.js            界面与交互
- supabase/schema.sql  云端建表 SQL（只需执行一次）
- .github/workflows/deploy.yml  自动部署

## 一、本地试用（无需任何账号）
直接双击 index.html 打开即可（数据存在浏览器 localStorage）。
也可以：python -m http.server 8080 然后访问 http://localhost:8080

## 二、开启云端实时同步（对方实时看到）
1. 注册 https://supabase.com（免费）
2. 新建项目，进入 SQL Editor，粘贴执行 supabase/schema.sql
3. Project Settings → API → 复制 Project URL 和 anon public key
4. 填进 config.js 的 supabaseUrl / supabaseAnonKey
5. 部署后，把链接发给对方，双方编辑实时同步

## 三、部署到 GitHub（自动）
1. 在 GitHub 新建仓库（如 hokkaido-trip）
2. 把本目录所有文件 push 到 main 分支
3. 仓库 Settings → Pages → Build and deployment → Source 选 GitHub Actions
4. 以后每次 push 都会自动部署，网址形如：
   https://你的用户名.github.io/hokkaido-trip/

## 四、分享
打开页面点右上角「分享」，复制带 ?trip=猪猪饲料 的链接，微信里发给对方（对方也需要输入密码）。

## 说明
- 行程ID「猪猪饲料」在 config.js 的 tripId 里改
- 页面大标题「北海道 × 猪猪饲料」在 data.js 的 trip.title 里改
- 首页的诗句 / 统计 / 小标题 在 data.js 的 trip.hero 里改
- 打卡点图片会自动压缩到最长边 1100px 再保存，控制存储体积
- Google Map 在大陆可能打不开，届时用「在 Google Maps 中打开」按钮，到日本后正常
- 汇率默认 1 JPY = 0.048 CNY，可在「记账」页直接改

## 五、打不开 / 输密码没反应怎么办
1. 先强制刷新：电脑 Ctrl+F5（Mac Cmd+Shift+R），手机上关掉页面重新打开。
2. 确认 config.js、data.js、store.js、app.js 和 index.html 在同一个文件夹里。
3. 页面底部如果出现红色提示条，说明脚本没加载成功，按上面第 2 条检查。
4. 密码不区分大小写、会自动忽略首尾空格；正确密码是 lu123321。

> 历史问题记录：早期版本在 index.html 里同步加载了 Supabase CDN 脚本，
> 国内网络下该请求会一直卡住，导致后面的 js 全部不执行（锁屏能看到、按钮点了没反应）。
> 现在已改为：只有填了 supabaseUrl / supabaseAnonKey 才按需加载，并且 6 秒超时自动降级为本地模式。

## 六、v4 诊断说明（打不开时看这里）
页面加载后，锁屏底部右侧会出现一个灰字「✓ 脚本已加载 v4」：
- 看到这行灰字 = JavaScript 正常运行
- 看不到，且页面顶部出现红条「JavaScript 被关闭了」= 浏览器禁用了 JS，请在设置里开启
- 输入密码后，按钮下方出现「密码正确，但页面脚本没有启动」+ 一行「诊断：APP_CONFIG=… · Store=… · app.js=…」= 有 js 文件没加载成功，把那行诊断内容发我即可

应急入口（自己着急用、或验证脚本是否正常）：
在地址栏的文件路径后面加上  ?open=1  回车，例如
  .../hokkaido-trip/index.html?open=1
能直接进首页，说明脚本没问题，只是密码那一步的环境问题。

## 七、v5 更新（真实雪山 + 可爱导航 + 清单合并）
- 背景换成**真实的北海道雪山照片**（富良野雪场），做了浅白色蒙版处理，保证文字清楚。
  图片来源：Wikimedia Commons，文件 Furano_Snow_Resort_view2.JPG，作者 wakimasa，**公有领域（Public domain）**，可自由使用。
  想换图：把新图命名为 assets/hokkaido-snow.jpg 覆盖即可（建议宽 1600px）。
- 底部导航改成手绘风格图标 + 悬浮胶囊条，当前页有小弹跳动画。
- 「提醒」和「准备」合并成「清单」一栏：提醒在上，准备在下。

## 八、国内网络说明（重要）
Supabase 的域名 *.supabase.co 在中国大陆被封锁（TCP 能连，但 TLS 握手被重置；手机流量同样不行）。
所以本应用是「双模式」：

| 场景 | 表现 |
|---|---|
| 国内（无 VPN） | 自动用浏览器本地存储，右上角显示「本地」，打开秒开 |
| 日本 / 开 VPN | 自动连上云端，右上角显示「☁ 实时同步」，双方改动实时可见 |

国内两个人怎么同步？用首页底部的「导出备份 / 导入备份」：
1. A 点「导出备份」，得到一个 json 文件
2. A 用微信把文件发给 B
3. B 打开网站，首页点「导入备份」，选中那个文件，确认覆盖

这种方式任何网络都能用，也不需要再注册任何服务。

## 九、v6 文件变化
- 背景图和 Supabase SDK 已放到根目录：hokkaido-snow.jpg、supabase.min.js
  这样用 GitHub 网页上传时，全选文件拖上去就行，不用再处理子文件夹。
- 只用根目录文件即可；supabase/ 和 .github/ 只跟数据库、自动部署有关，用「分支部署」时可以不管。
## 十、LeanCloud 实时同步（v7，国内可用且免费）

### 价格结论
- LeanCloud 国内版（leancloud.cn）：**不免费**。开发版已不再提供，商用版最低 30 元/天。
- LeanCloud 国际版（leancloud.app）：**有免费开发版**。额度：每天 3 万次 API 请求、1GB 存储、
  LiveQuery 每天 100 次订阅 / 5000 条消息。两个人记录旅行完全够用。
  国际版 API 域名（*.api.lncldglobal.com）在国内可以直连（已验证 TLS 可握手）。

### 一次性配置步骤
1. 打开 https://www.leancloud.app 注册并登录（邮箱即可，国际版不需要实名）
2. 控制台创建应用（选「开发版」），名字随便写，例如 hokkaido
3. 应用 → 设置 → 应用凭证（App Keys），复制三样东西：
   - AppID
   - AppKey
   - 服务器地址 / Server URL（形如 https://abcd1234.api.lncldglobal.com）
4. 存储 → 数据 → 创建 Class，名字必须是 Trip（不用加字段）
   然后把这个 Class 的权限改成「所有用户可读写」（两人协作必需）
5. 应用 → 设置 → 实时通信 / LiveQuery，打开 LiveQuery 开关
6. 打开 config.js，把三个值填进 leancloud 段：
   appId / appKey / serverURL
7. 把整个文件夹重新上传到 GitHub，等 1 分钟刷新页面

### 怎么判断成功
- 右上角徽标从「本地」变成「☁ 实时同步」
- 两台设备同时打开，A 改一个打卡点，B 那边 1-2 秒内自动变化
- 如果还是「本地」：说明 LeanCloud 没连上，把浏览器控制台（F12 → Console）的红色报错发出来

### 三层降级顺序
1. LeanCloud（填了 appId 且连得上）
2. Supabase（国内被墙，到日本或开 VPN 时生效）
3. 浏览器本地（以上都不可用时，功能照常，数据存本机）

## 十一、GitHub 仓库同步（v8，当前方案，国内免费可用）

### 原理
把整份行程数据作为一个 JSON 文件提交到你的 GitHub 仓库（trip-data.json），
两台设备通过 api.github.com 每 8 秒拉一次，有改动就推上去。
实测：api.github.com 国内可直连（200）；只有 raw.githubusercontent.com 被墙，我们没有用它。

### 只需要一个 GitHub 令牌（不用注册任何新服务）
1. 打开 https://github.com/settings/tokens → Generate new token (classic)
2. Note 随便写（如 trip），Expiration 选 No expiration 或 90 days
3. 勾选 repo（至少 public_repo）→ 底部 Generate token
4. 复制 ghp_ 开头的那串（只显示一次）
5. 打开网站 → 首页底部「开启云端同步 →」→ 粘贴令牌 → 保存
6. 另一个人在她手机上同样操作，粘贴同一个令牌

### 验证
- 右上角徽标变成「☁ 实时同步」
- A 改一个打卡点，B 那边 8 秒内自动更新

### 注意
- 令牌只保存在各自的浏览器本地，不会写进网页源码；泄露了随时在 GitHub 上 Revoke
- 每次改动会在仓库里产生一条 commit（这是正常的）
- 照片目前只存各自设备，不参与同步（要同步照片可以再加）
- 数据文件在仓库根目录：trip-data.json

## 十二、v9 文案修改
- 锁屏副标题：猪猪饲料的旅行手账 · 山川为证，风雪为期
- 进入按钮：翻开冬日序章
- 首页那句长描述：见 data.js 的 trip.hero.sectionSub

注意：标题、首页文案、起止日期现在**以 data.js 为准**（normalize 会覆盖旧缓存里的这些字段），
所以以后改文字只要改 data.js 再上传即可，不会被旧数据盖住。汇率、更新时间仍保留各自的设置。
