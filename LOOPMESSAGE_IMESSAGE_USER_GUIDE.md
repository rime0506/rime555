# LoopMessage iMessage 完整配置教程

这份教程面向第一次配置的普通用户。完成后，网站里的 AI 角色可以通过真实 iMessage 给你发消息；你在 iMessage 中回复后，网站也可以读取回复并继续调用 AI。

> 最适合第一次测试的组合：**LoopMessage Sandbox + Vercel 连接器 + Upstash Redis + 一个角色**。先把这一套跑通，再考虑共享 Sender 或“一角色一个号码”的专用 Sender。

## 一、先弄清楚四个部分分别做什么

整条消息链路如下：

```text
你的 iPhone / Mac
        ⇅ iMessage
LoopMessage
        ⇅ Webhook 和发送 API
你部署在 Vercel 的连接器
        ⇅ 暂存入站消息
你自己的 Upstash Redis
        ⇅ 网站轮询
网站里的 AI 角色
```

- **LoopMessage**：负责真正发送和接收 iMessage。
- **Vercel 连接器**：是一个很小的后端。它安全保存 LoopMessage API Key，并在 LoopMessage、Upstash 和网站之间转发消息。
- **Upstash Redis**：临时保存用户刚发来的入站消息，让网站能读取并回复。
- **网站**：读取角色人设、用户人设、世界书、长期记忆和独立 iMessage 记录，再调用你已经配置好的 AI API 生成回复。

LoopMessage API Key 和 Upstash Token 都不应直接放进网页。它们只放在你自己的 Vercel 环境变量里。

## 二、开始前需要准备什么

请准备以下账号：

1. 一个 [LoopMessage](https://app.loopmessage.com/) 账号。
2. 一个 GitHub 账号。
3. 一个 [Vercel](https://vercel.com/) 账号，并用 GitHub 登录或连接 GitHub。
4. 一个 [Upstash](https://console.upstash.com/redis) 账号。
5. 网站中已经可以正常调用的 AI API。
6. 一台已经启用 iMessage 的 iPhone、iPad 或 Mac。

Sandbox 可用于免费测试。Vercel、Upstash 和 LoopMessage 的免费额度、商业限制及付费规则可能调整，实际以它们各自页面显示为准。

## 三、先在网站中准备角色

1. 打开网站并进入要使用的角色。
2. 确认这个角色的人设已经填写完整。
3. 如果需要，先配置用户人设、角色世界书、用户世界书、全局世界书和长期记忆。
4. 确认网站中的 AI API 已经能够正常生成普通聊天回复。
5. 在该角色的 WeChat 设置中设好“回复消息条数范围”。真实 iMessage 会沿用这里的最少条数和最多条数，并逐条发送。

例如 WeChat 中设为 2～4 条，角色一次生成的 iMessage 回复也会尽量在 2～4 条之间，而不是永远只发一条。

## 四、配置 LoopMessage Sandbox

第一次建议先用 Sandbox。不要一开始就购买或配置专用 Sender。

### 4.1 找到 Organization API Key

1. 登录 [LoopMessage Dashboard](https://app.loopmessage.com/)。
2. 选择你要使用的 Organization。
3. 进入 **API → Settings**。
4. 找到 **Organization API Key** 并复制。

这个值稍后填入 Vercel 的 `LOOPMESSAGE_API_KEY`。

注意：

- 只复制原始 API Key，前面不要加 `Bearer`。
- 不要把它填到网站页面。
- 不要发给别人，也不要在截图中露出。

### 4.2 添加 Sandbox 联系人

1. 在 LoopMessage 当前 Organization 中进入 **Sandbox**。
2. 添加你自己的 iMessage 手机号或 Apple ID 邮箱。
3. 手机号建议使用国际格式，例如 `+8613800000000`，不要在 `+86` 后加空格。
4. 添加的号码或邮箱必须与 Apple“发起新对话时使用”的地址一致。

在较新的 iOS 中，可以在 **设置 → App → 信息 → 发送与接收 → 发起新对话时使用** 查看；旧版 iOS 的入口名称可能略有不同。

### 4.3 先从手机发一条消息

按照 LoopMessage Sandbox 页面给出的号码或二维码建立对话，然后从自己的 iMessage 主动发一条测试消息，例如“你好”。

Sandbox 有几个重要限制：

- 联系人需要先给 Sandbox 发消息，才能开启发送窗口。
- 每次收到入站消息后，测试发送窗口通常会重新开启 24 小时。
- 官方当前说明中，Sandbox 最多添加 5 个联系人，并只适用于默认的第一个 Organization；规则以后可能变化，以 LoopMessage 页面为准。
- Sandbox 只适合测试，不等于正式的固定角色号码。

如果网站发不出去，先回到 Sandbox 页面确认联系人已经添加，并重新从手机发一条消息。

## 五、在网站生成连接器访问密钥

1. 打开网站中的角色详情页。
2. 找到 **LoopMessage iMessage** 区域。
3. 暂时不用急着开启总开关。
4. 在“连接器访问密钥”右侧点击 **生成并复制**。
5. 把复制的值暂时保存在安全位置，下一步部署 Vercel 时要用。

这个值叫 `CONNECTOR_ACCESS_KEY`，它不是 LoopMessage API Key。它用于防止别人调用你的连接器。

连接器地址、连接器访问密钥和连接状态都只属于当前角色。角色 A 与角色 B 可以部署和填写完全不同的连接器；在角色 B 清空配置不会影响角色 A。如果多个角色确实要共用同一个 Vercel 连接器，也需要在每个角色页面分别填写相同的地址和密钥。

如果你在配置完成前刷新了网页，密钥输入框变空，也不需要重新创建 Vercel 项目。重新生成一个密钥，然后：

1. 在现有 Vercel 项目中更新 `CONNECTOR_ACCESS_KEY`。
2. 重新部署该 Vercel 项目。
3. 把同一个新密钥重新填回网站。

Vercel 和网站中的值必须一模一样。

## 六、创建 Upstash Redis

如果只想从网站单向发消息，可以暂时不使用 Upstash；如果要让用户在 iMessage 回复后 AI 自动回复，就必须配置。

1. 打开 [Upstash Redis 控制台](https://console.upstash.com/redis)。
2. 点击创建 Redis 数据库。
3. 名称可以自行填写，例如 `imessage-inbox`。
4. 地区选择离你或 Vercel 较近的可用地区即可。
5. 创建完成后进入数据库详情。
6. 在 **REST API** 或 **Connect → REST** 区域找到并复制：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

这里要使用可读写的标准 REST Token，不要使用只读 Token，因为连接器需要写入和删除已经处理的消息。

两个值都只填到 Vercel，不要填进网站，也不要公开。

## 七、一键部署 Vercel 连接器

点击下面的按钮：

[一键部署 LoopMessage 连接器到 Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frime0506%2F0506&root-directory=loopmessage-connector&project-name=loopmessage-connector&repository-name=loopmessage-connector&env=LOOPMESSAGE_API_KEY%2CCONNECTOR_ACCESS_KEY%2CALLOWED_ORIGIN%2CUPSTASH_REDIS_REST_URL%2CUPSTASH_REDIS_REST_TOKEN&envDescription=%E5%A1%AB%E5%86%99%20LoopMessage%20API%20Key%E3%80%81%E8%BF%9E%E6%8E%A5%E5%99%A8%E8%AE%BF%E9%97%AE%E5%AF%86%E9%92%A5%E3%80%81%E7%BD%91%E7%AB%99%E6%9D%A5%E6%BA%90%E4%BB%A5%E5%8F%8A%20Upstash%20Redis%20REST%20%E5%9C%B0%E5%9D%80%E5%92%8C%20Token%E3%80%82&envLink=https%3A%2F%2Fgithub.com%2Frime0506%2F0506%2Ftree%2Fmain%2Floopmessage-connector)

任何用户都可以用自己的账号部署，不需要是原 GitHub 仓库作者。Vercel 会把公开项目复制到用户自己的 GitHub，并在用户自己的 Vercel 账号中部署。

### 7.1 填写五个环境变量

部署页面会要求填写以下五项：

1. `LOOPMESSAGE_API_KEY`
   - 填第 4.1 节复制的 LoopMessage Organization API Key。
   - 只填原始 Key，不加 `Bearer`。

2. `CONNECTOR_ACCESS_KEY`
   - 填第 5 节在网站点击“生成并复制”得到的值。
   - 网站与 Vercel 必须填写同一个值。

3. `ALLOWED_ORIGIN`
   - 填网站的“来源”，不是完整页面地址。
   - GitHub Pages 示例：`https://rime0506.github.io`
   - 普通域名示例：`https://example.com`
   - 不要填写 `/0506/`、`/index.html`，末尾也不要额外加页面路径。
   - 多个来源可用英文逗号分隔，例如 `https://example.com,https://www.example.com`。
   - 用 `file://` 本地打开时浏览器来源可能是 `null`。仅临时本地测试可以填 `*`，正式使用建议通过 GitHub Pages 或其他 HTTPS 网站访问，并改回准确来源。

4. `UPSTASH_REDIS_REST_URL`
   - 填第 6 节复制的 Upstash REST URL。

5. `UPSTASH_REDIS_REST_TOKEN`
   - 填第 6 节复制的 Upstash 标准 REST Token。

确认五项没有多余空格后开始部署。

### 7.2 找到连接器地址

部署完成后，Vercel 会给出一个生产域名，例如：

```text
https://loopmessage-connector-abc123.vercel.app
```

也可能有一个更短的自定义项目域名，例如：

```text
https://loopmessage-connector.vercel.app
```

只要该域名能正常打开并对应当前项目，就可以使用。

网站中的“连接器地址”只填根地址：

```text
https://你的项目.vercel.app
```

这里**不要**加 `/api/webhook`，也不要加 `/api/send`。

### 7.3 修改环境变量后必须重新部署

以后如果发现变量填错：

1. 打开 Vercel 项目。
2. 进入 **Settings → Environment Variables**。
3. 修改对应变量。
4. 进入 **Deployments**。
5. 对最新部署执行 **Redeploy**。

环境变量的修改只会应用到新部署。一般不需要删除项目，也不需要重新走一遍“一键部署”。

## 八、把连接器填回网站

回到角色详情页的 **LoopMessage iMessage** 区域：

1. “连接器地址”填 Vercel 根地址，例如 `https://loopmessage-connector.vercel.app`。
2. “连接器访问密钥”填与 Vercel 中完全相同的 `CONNECTOR_ACCESS_KEY`。
3. 点击 **测试连接**。

测试通过后再继续。如果失败，请直接看本文“十六、常见报错”。

以上内容只保存到当前角色。切换到另一个角色后会显示那个角色自己的连接器、Sender ID、接收者和自动回复设置。

## 九、选择发送方式

网站提供三种模式。

### 9.1 Sandbox 免费测试

第一次测试选它。

- “LoopMessage Sender ID”留空。
- “接收者 iMessage”填已经加入 Sandbox 的手机号或 Apple ID 邮箱。
- 手机号使用 `+国家码手机号`，例如 `+8613800000000`，中间不加空格。
- 联系人要先从 iMessage 给 Sandbox 发过消息。

### 9.2 共享 Sender

适合已通过共享 Sender 建立会话的情况。用户通常要先完成 opt-in，并先发消息建立会话。已经建立会话后 Sender ID 通常可以留空。

共享 Sender 来自号码池，不适合把某个共享号码永久当作某个角色的固定号码。LoopMessage 对共享 Sender 的回复时间窗口和使用规则可能调整，请以它的控制台及官方说明为准。

### 9.3 专用 Sender（一角色一号码）

适合正式实现“一角色一个固定号码”。

- 每个角色选择自己的专用 Sender。
- 在角色设置中填写该 Sender 的 `Sender ID`。
- 专用 Sender 通常涉及付费、开通或预热时间，实际以 LoopMessage 账号页面为准。

如果报“Sender ID 不可用”或“Sender ID 必填”，先确认当前选择的模式与 Sender 类型一致，并从 LoopMessage 控制台重新复制正确的 Sender ID。

## 十、填写接收者并测试单向发送

1. 在“接收者 iMessage”中填自己的测试手机号或 Apple ID 邮箱。
2. 点击角色详情右上角的保存图标，保存当前角色设置。
3. 点击 **发送测试文字**。
4. 等待手机收到测试消息。
5. 再点击 **AI生成并发送**，确认角色可以根据网站配置生成真实 iMessage。

如果 LoopMessage 接口返回成功，只代表消息已经被接受并进入队列，不一定代表手机已经成功送达。最终状态可以在 LoopMessage 的消息记录中查看。

## 十一、配置 LoopMessage 入站 Webhook

这是让“你回复后 AI 继续回复”的关键步骤。

1. 回到 [LoopMessage Dashboard](https://app.loopmessage.com/)。
2. 选择与 API Key 相同的 Organization。
3. 进入 **API → Webhooks** 或对应的 Webhook 设置页面。
4. 创建或编辑 Webhook。
5. 只启用 `message_inbound` 入站消息事件。

### 11.1 Webhook URL 怎么填

这里必须填写连接器根地址加 `/api/webhook`：

```text
https://你的项目.vercel.app/api/webhook
```

例如连接器地址是：

```text
https://loopmessage-connector.vercel.app
```

那么 Webhook URL 必须是：

```text
https://loopmessage-connector.vercel.app/api/webhook
```

请特别注意两个位置的区别：

- 网站“连接器地址”：只填 `https://你的项目.vercel.app`
- LoopMessage “Webhook URL”：填 `https://你的项目.vercel.app/api/webhook`

Webhook History 一直没有任何记录时，最常见原因就是 URL 少了 `/api/webhook`、Webhook 没保存，或者没有启用 `message_inbound`。

### 11.2 Webhook 验证头怎么填

如果 LoopMessage 页面只有一个 **Webhook header** 输入框，填写：

```text
Bearer 你的CONNECTOR_ACCESS_KEY
```

例如网站生成的密钥是 `imsg_xxxxxxxxx`，就填：

```text
Bearer imsg_xxxxxxxxx
```

`Bearer` 后面必须有一个英文空格。

如果页面把请求头拆成“名称”和“值”两个输入框：

- 名称填 `Authorization`
- 值填 `Bearer 你的CONNECTOR_ACCESS_KEY`

保存 Webhook。网站角色详情页下方的“怎么获得连接器地址？”折叠说明中，也可以直接复制 Webhook 地址和验证头内容。

## 十二、开启“收到 iMessage 后自动回复”

> 重要：防止多个网页重复调用 AI 的修复需要 **连接器 2.1 或更高版本**。如果你以前已经部署过连接器，请先进入 Vercel 对当前项目执行一次 **Redeploy**，再测试自动回复。仅刷新网站不会更新你自己的连接器副本。

回到网站角色详情页：

1. 开启最上方的 **LoopMessage iMessage** 总开关。
2. 开启 **收到 iMessage 后自动回复**。
3. 设置防抖秒数，范围是 1～60 秒，建议先用 6 秒。
4. 点击右上角保存图标。
5. 保持网站页面打开。

防抖的作用是判断用户是否已经暂时说完。例如设为 6 秒：用户连续发三条消息，只要相邻消息之间没有超过 6 秒，网站会把三条合并，只调用一次 AI。最后一条消息后安静 6 秒，才开始生成回复。

AI 生成期间如果又收到新消息，网站会把新消息加入本轮内容并重新处理，尽量避免漏回或答非所问。

同一个连接器即使在多个标签页、PWA 或设备中同时打开，也只会由一个页面监听和发送回复。其他页面会显示“另一个页面正在监听”。关闭当前监听页面后，其他页面最多约 90 秒自动接管。

## 十三、完整收发测试

建议严格按下面顺序测试：

1. 确认网站“测试连接”通过。
2. 确认 Sandbox 联系人已添加，而且手机刚给 Sandbox 发过消息。
3. 点击网站的“发送测试文字”，确认手机收到。
4. 在 LoopMessage 中确认 Webhook 已保存，并启用 `message_inbound`。
5. 从手机回复一条新的 iMessage，例如“你在干嘛”。
6. 打开 LoopMessage 的 **Webhook History**，确认出现 `message_inbound` 请求。
7. 回到网站角色详情，观察自动回复状态。
8. 如果没有立即处理，点击 **立即检查**。
9. 等待防抖时间和 AI 生成时间，查看手机是否收到角色回复。

运行状态可能依次显示“监听中”“收到消息，等待防抖”“正在生成”“正在发送”等。显示“没有待处理消息”表示连接器当前队列里没有可供该角色读取的新消息，并不代表 LoopMessage 的 Sandbox 消息列表为空。

## 十四、自动回复会读取哪些内容

真实 iMessage 自动回复会使用：

- 当前角色的完整人设。
- 当前对话用户的人设。
- 当前角色绑定的角色世界书。
- 当前用户绑定的用户世界书。
- 已启用的全局世界书。
- 该角色已有的长期总结记忆。
- 当前角色最近的 WeChat 聊天和其中的系统事件，例如拉黑、登录账号及解除拉黑。
- 当前角色独立保存的最近 iMessage 聊天记录。
- 用户这一次在防抖时间内连续发来的全部消息。

最近 WeChat 与 iMessage 会按时间合并，并分别标记渠道。`[已发生事件]` 只作为 AI 的隐藏上下文，不会作为短信发送到手机。

iMessage 的回复条数沿用角色在网站 WeChat 中设置的最少和最多回复条数。模型生成多段内容后，网站会逐条发成多条 iMessage。

系统控制指令会在发送前被过滤，不会作为普通短信原样发到手机。

## 十五、聊天记录、删除与清空

真实 iMessage 记录与网站 WeChat 的聊天记录是分开的。

在角色详情中点击 **iMessage 聊天记录 → 查看记录**，可以进入独立页面：

- 预览这个角色的真实 iMessage 对话记录。
- 删除某一条消息。
- 点击“全部清除”清空这个角色的 iMessage 上下文。

只在 iPhone“信息”App 或 LoopMessage 后台删除消息，网站不会收到“某条记录被删除”的通知，所以网站本地仍可能把它作为上下文。要让 AI 忘记某一条，必须在网站的 iMessage 聊天记录页删除；要全部忘记，则使用“全部清除”。

## 十六、常见报错与处理办法

### 16.1 “Failed to fetch”或 CORS 错误

常见控制台提示包括：

```text
No 'Access-Control-Allow-Origin' header
origin 'null'
origin 与允许来源不一致
```

处理方法：

1. 检查 Vercel 的 `ALLOWED_ORIGIN`。
2. GitHub Pages 只填来源，例如 `https://rime0506.github.io`，不要填仓库路径和 `index.html`。
3. 修改后重新部署 Vercel。
4. 不建议直接双击 `index.html` 用 `file://` 长期运行；改用 GitHub Pages 或本地 HTTP 服务。
5. 仅排查本地问题时可临时用 `*`，测试完成后改回准确来源。

### 16.2 网站测试连接失败，提示未设置服务器地址

- 网站“连接器地址”应为 `https://你的项目.vercel.app`。
- 不要填 GitHub 仓库地址。
- 不要填 Vercel 项目的控制台页面地址。
- 不要在网站连接器地址后加 `/api/webhook`。
- 确认 Vercel 部署状态为 Ready。

### 16.3 返回 401 或 403

通常是 `CONNECTOR_ACCESS_KEY` 不一致。

1. 在网站重新生成并复制一个新密钥。
2. 更新 Vercel 的 `CONNECTOR_ACCESS_KEY`。
3. 重新部署。
4. 把同一个密钥填回网站。
5. LoopMessage Webhook header 也更新为 `Bearer 同一个密钥`。

### 16.4 返回 400，提示 Sender ID 不可用或必填

- Sandbox：Sender ID 留空。
- 已建立会话的共享 Sender：一般可留空。
- 专用 Sender：必须填写该角色对应的 Sender ID。
- 不要把手机号、API Key 或项目名称误填成 Sender ID。

### 16.5 Sandbox 能看到手机消息，但 Webhook History 为空

依次检查：

1. Webhook URL 是否完整包含 `/api/webhook`。
2. Webhook 是否真的点击 Save 保存。
3. 是否启用了 `message_inbound`。
4. Webhook 是否建立在与 API Key 相同的 Organization。
5. 保存后重新从手机发送一条新消息；旧消息不会自动补发成新 Webhook。
6. Sandbox 联系人的手机号或邮箱是否与当前 iMessage 发件地址完全一致。

### 16.6 Webhook History 有记录，但状态是 401

验证头错误。应为：

```text
Authorization: Bearer 你的CONNECTOR_ACCESS_KEY
```

如果页面只有一个输入框，只填值 `Bearer 你的CONNECTOR_ACCESS_KEY`。

### 16.7 Webhook 返回 503，或网站始终没有待处理消息

通常是 Upstash 未配置或配置错误。

1. 检查 `UPSTASH_REDIS_REST_URL`。
2. 检查 `UPSTASH_REDIS_REST_TOKEN` 是否为同一个数据库的标准可读写 Token。
3. 确认没有复制多余引号、空格或变量名本身。
4. 修改后重新部署 Vercel。
5. 再从手机发送一条全新的消息。

### 16.8 Upstash 提示 WRONGPASS、Unauthorized 或 Token 无效

- URL 和 Token 可能不是同一个数据库的。
- 可能误用了只读 Token。
- Token 可能被重置。
- 重新从数据库 REST API 区域复制标准 REST URL 和标准 REST Token，更新 Vercel 后重新部署。

### 16.9 网站显示“监听中”或“没有待处理”，一直不回复

按顺序确认：

1. 网站页面保持打开，电脑或手机浏览器没有冻结后台页面。
2. 角色的 iMessage 总开关和自动回复开关都已开启并保存。
3. 连接器测试通过。
4. Webhook History 中能看到刚才的入站消息。
5. Webhook 返回 200，而不是 401、404 或 503。
6. Upstash 两项环境变量正确。
7. “接收者 iMessage”与入站消息的联系人一致。
8. 点击“立即检查”观察详细状态。
9. 检查网站 AI API 是否仍能正常生成。

连接器和 Upstash 可以在网页关闭时继续接收并暂存入站消息，但当前版本的 AI 生成运行在网站页面中，所以网页关闭时不会立即生成回复。重新打开网站后可点击“立即检查”。

### 16.10 只回复一条，而不是多条

1. 检查角色 WeChat 设置中的“回复消息条数范围”。
2. 保存角色设置。
3. 再测试一轮新的入站消息。

网站会要求 AI 按该范围生成，并用多次发送请求逐条发送；模型偶尔仍可能不完全遵守条数要求。

### 16.11 发送接口成功，但手机没收到

LoopMessage 接受请求不等于 iMessage 已经最终送达。请检查：

- LoopMessage 消息记录中的投递状态。
- Sandbox 24 小时发送窗口是否已过期。
- 接收者是否仍在 Sandbox 联系人列表中。
- 手机号或 Apple ID 邮箱是否正确。
- iMessage 是否可用，发起新对话地址是否匹配。
- 专用或共享 Sender 当前是否可用。

### 16.12 多个角色抢着回复同一个人

Sandbox 或共享模式下，同一个接收者建议只开启一个角色的自动回复。否则多个角色可能同时读取同一个人的入站消息，造成路由冲突。

想稳定实现“一角色一个号码”，应给每个角色使用不同的专用 Sender，并在角色设置中填写各自的 Sender ID。

## 十七、拉黑角色后的真实 iMessage

当网站中的角色被拉黑后，如果该角色的 **LoopMessage iMessage** 总开关已经开启并保存，角色的主动短信流程会改为发送真实 iMessage。

- 开启真实 iMessage：通过该角色配置的 LoopMessage 连接器发送。
- 未开启真实 iMessage：继续使用网站原来的模拟短信。
- 连接器配置错误：会提示真实发送失败，不会偷偷改发模拟短信。

当前这一行为主要用于“拉黑后的角色主动联系”。删除角色后的好友申请流程仍是网站原有逻辑，不要把两者混为一谈。

## 十八、安全与隐私

请务必遵守以下规则：

1. `LOOPMESSAGE_API_KEY` 只放在 Vercel 环境变量。
2. `UPSTASH_REDIS_REST_TOKEN` 只放在 Vercel 环境变量。
3. `CONNECTOR_ACCESS_KEY` 只在你自己的网站、Vercel 和 Webhook 验证头之间使用。
4. 不要把任何密钥发进公开聊天、Issue、截图或前端代码。
5. 只向已经同意接收消息的人发送 iMessage，不要用于垃圾信息或骚扰。

如果 LoopMessage API Key 已经在截图或聊天中完整暴露：

1. 在 LoopMessage API Settings 点击 **Reset API key**。
2. 把新 Key 更新到 Vercel 的 `LOOPMESSAGE_API_KEY`。
3. 重新部署 Vercel。

如果 `CONNECTOR_ACCESS_KEY` 暴露：重新生成，更新 Vercel、网站和 LoopMessage Webhook header，然后重新部署。

如果 Upstash Token 暴露：在 Upstash 重置凭据，再更新 Vercel 并重新部署。

## 十九、换密钥、换域名或升级连接器

### 19.1 换环境变量不需要重建项目

直接在 Vercel 项目的 Environment Variables 中更新，然后 Redeploy 即可。

### 19.2 换网站域名

更新 `ALLOWED_ORIGIN` 为新网站来源并重新部署。如果新旧域名都要使用，可以用英文逗号同时填写两个来源。

### 19.3 原项目更新后，用户的副本不会自动同步

一键部署会在用户自己的 GitHub/Vercel 下创建副本。原项目以后发布修复时，用户的副本一般不会自动获得更新。

需要升级时，可以重新点击最新的一键部署按钮创建一个新项目，或者在熟悉 Git 的情况下手动同步代码。新项目部署完成后，再把网站连接器地址改成新域名。

## 二十、最终检查清单

如果仍然不工作，请逐项核对：

- [ ] LoopMessage Organization API Key 已填入 Vercel，且没有 `Bearer`。
- [ ] 网站和 Vercel 的 `CONNECTOR_ACCESS_KEY` 完全一致。
- [ ] `ALLOWED_ORIGIN` 只包含协议和域名，没有仓库路径或 `index.html`。
- [ ] Upstash REST URL 与标准 REST Token 来自同一个数据库。
- [ ] 修改任何 Vercel 环境变量后已经重新部署。
- [ ] 网站连接器地址只填 Vercel 根地址。
- [ ] LoopMessage Webhook URL 以 `/api/webhook` 结尾。
- [ ] Webhook header 是 `Bearer CONNECTOR_ACCESS_KEY`。
- [ ] Webhook 已保存并启用 `message_inbound`。
- [ ] Sandbox 联系人与 iMessage 当前发件手机号或邮箱完全一致。
- [ ] Sandbox 联系人刚主动发过消息，24 小时窗口仍有效。
- [ ] Sandbox 模式没有填写 Sender ID。
- [ ] 角色 iMessage 总开关和自动回复开关已开启并保存。
- [ ] 网站页面保持打开，AI API 能正常工作。
- [ ] 同一个 Sandbox 接收者没有同时开启多个角色。

## 官方参考资料

- [LoopMessage API Credentials](https://loopmessage.com/apidocs/credentials/)
- [LoopMessage Sandbox Environment](https://loopmessage.com/helpdesk/sandbox-environment)
- [LoopMessage Sending Messages API](https://loopmessage.com/apidocs/send-message/)
- [LoopMessage Conversation API Webhooks](https://loopmessage.com/apidocs/conversation-api-webhooks)
- [LoopMessage Webhook History](https://loopmessage.com/apidocs/webhook-history)
- [LoopMessage Dedicated 与 Shared Sender](https://loopmessage.com/helpdesk/dedicated-vs-shared-sender-names)
- [Vercel Deploy Button](https://vercel.com/docs/deploy-button)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi)
- [Upstash 与 Vercel 集成](https://upstash.com/docs/redis/howto/vercelintegration)
