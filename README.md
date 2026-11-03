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
