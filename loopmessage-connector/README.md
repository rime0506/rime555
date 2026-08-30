# LoopMessage iMessage Connector

这是给网站用户自行部署的 LoopMessage iMessage 连接器。每位用户使用自己的 LoopMessage、GitHub 和 Vercel 账号；网站前端不会接触 LoopMessage Organization API Key。

第一次配置请先阅读仓库根目录的 [LoopMessage iMessage 完整配置教程](../LOOPMESSAGE_IMESSAGE_USER_GUIDE.md)。

## 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frime0506%2F0506&root-directory=loopmessage-connector&project-name=loopmessage-connector&repository-name=loopmessage-connector&env=LOOPMESSAGE_API_KEY%2CCONNECTOR_ACCESS_KEY%2CALLOWED_ORIGIN%2CUPSTASH_REDIS_REST_URL%2CUPSTASH_REDIS_REST_TOKEN&envDescription=%E5%A1%AB%E5%86%99%20LoopMessage%20API%20Key%E3%80%81%E8%BF%9E%E6%8E%A5%E5%99%A8%E8%AE%BF%E9%97%AE%E5%AF%86%E9%92%A5%E3%80%81%E7%BD%91%E7%AB%99%E6%9D%A5%E6%BA%90%E4%BB%A5%E5%8F%8A%20Upstash%20Redis%20REST%20%E5%9C%B0%E5%9D%80%E5%92%8C%20Token%E3%80%82&envLink=https%3A%2F%2Fgithub.com%2Frime0506%2F0506%2Ftree%2Fmain%2Floopmessage-connector)

任何用户都可以点击按钮部署，不需要是原 GitHub 仓库的作者。Vercel 会复制公开仓库，并把 Root Directory 设置为 `loopmessage-connector`。

## 环境变量

- `LOOPMESSAGE_API_KEY`：LoopMessage Dashboard → Organization → API → Settings 中的 Organization API Key。只填原始 Key，不加 `Bearer`。
- `CONNECTOR_ACCESS_KEY`：网站设置页点击“生成并复制”获得；Vercel 与网站必须填写同一个值。
- `ALLOWED_ORIGIN`：允许调用连接器的网站来源，例如 `https://example.com`。多个来源用英文逗号分隔；仅本地测试可临时设为 `*`。
- `UPSTASH_REDIS_REST_URL`：Upstash Redis 数据库详情页的 REST URL，用于暂存入站消息。
- `UPSTASH_REDIS_REST_TOKEN`：同一数据库的 REST Token。只放在 Vercel 环境变量，不要填进网页。

只使用单向发送时可以暂时不填 Upstash 两项；要使用“用户回复后角色自动回复”，必须配置。已有 Vercel 项目无需重新创建：添加环境变量后重新部署当前项目即可。

部署完成后复制 `https://你的项目.vercel.app`，粘贴进网站的“连接器地址”，再点击“测试连接”。

## 发送模式

- Sandbox：免费测试，最多添加少量联系人。联系人必须与 iPhone/Mac“发起新对话时使用”的手机号或邮箱完全一致，并先给 Sandbox 发一条 iMessage；收到入站消息后会开启 24 小时发送窗口。网站里的 Sender ID 可留空。
- 共享 Sender：接收者先完成共享号码的 opt-in 并建立会话。已建立会话时 Sender ID 可留空。
- 专用 Sender：适合“一角色一个固定号码”。在每个角色设置里填入该角色对应的 LoopMessage Sender ID。

## 配置入站 Webhook

1. 在 LoopMessage Dashboard → Organization → API → Webhooks 新建 Webhook。
2. 只勾选 `message_inbound` 事件。
3. URL 填 `https://你的连接器.vercel.app/api/webhook`。
4. 添加请求头 `Authorization`，值填 `Bearer 你的CONNECTOR_ACCESS_KEY`。
5. 网站角色设置中开启“收到 iMessage 后自动回复”，并设置 1～60 秒防抖时间。

当前自动回复使用网站已有的角色人设、聊天记录和 AI API 配置，因此网页需要保持打开。连续入站文字会按角色设置的防抖秒数合并；AI 生成期间如果又收到新消息，会合并后重新生成。入站事件按 `webhook_id` 去重，成功回发后才从队列确认删除。

连接器 2.1 起会在 Upstash 建立唯一监听租约。同一个网站即使同时打开多个标签页、PWA 或设备，也只有一个页面能读取并发送自动回复，避免防抖被重复执行。旧部署必须在 Vercel 重新部署最新版；关闭当前监听页面后，其他页面最多约 90 秒自动接管。

入站文字会暂存在用户自己的 Upstash Redis 中，成功回复后立即删除；未处理消息和去重记录最长保留 7 天。不要与他人共享 Redis REST Token。

## 接口

- `GET /api/health`：验证网站访问密钥和 LoopMessage API Key。
- `POST /api/send`：发送一条 iMessage 文字消息；接收 `recipient`、`text`、可选 `senderId`、`clientMessageId` 和自动回复监听身份 `consumerId`。
- `POST /api/webhook`：接收 LoopMessage 的 `message_inbound` Webhook。
- `GET /api/inbox`：网站携带 `consumerId` 读取尚未回复的入站消息；同一时间仅一个监听页面可取得队列。
- `POST /api/inbox`：网站在成功回复后确认一组 `webhookIds`。
