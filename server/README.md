# 共享排行榜服务

Cloudflare Worker + D1。源代码与前端已完成本地联调；**尚未部署到云端**。默认前端 `m2/config.js` 的 `apiBase` 为空，仍显示示例榜单，不会把模拟成绩当成共享成绩。

玩家只填昵称。浏览器在首次提交前保存随机身份，服务端只保存身份哈希。每个昵称对应一个浏览器身份，其他身份不能覆盖；最高分不会因提交低分而下降。换设备或清除浏览器数据后需使用新昵称。积分来自客户端，适合朋友试玩，未实现防作弊。

## 本地检查

使用 Node.js 24 或更新版本，无须安装测试依赖：

```powershell
node --test test/api.test.mjs
```

检查使用实际 SQLite 数据库，覆盖最高分、昵称隔离、并列顺序、重新打开数据库、输入与来源限制，以及连续写入限制。本地浏览器联调另外验证了两个隔离浏览器共享、刷新后保留身份和网络失败重试；这些检查不等于 Cloudflare 线上运行已经验证。

## 部署步骤

需要项目所有者的 Cloudflare 免费账号，玩家不需要 Cloudflare 或 GitHub 账号。使用 Free 计划，不开通付费订阅。

1. 在本目录运行 `npx wrangler@latest login`，由账号所有者在官方授权页登录。
2. 运行 `npx wrangler@latest d1 create dragon-merge-leaderboard`。将实际 `database_id` 填入 `wrangler.jsonc`，数据库绑定名保持 `DB`。
3. 运行 `npx wrangler@latest d1 migrations apply dragon-merge-leaderboard --remote`，创建表和索引。
4. 运行 `npx wrangler@latest deploy`，取得实际 HTTPS 服务地址；检查 `/health` 和 `/api/leaderboard`。
5. 将前端 `m2/config.js` 的 `apiBase` 设为服务地址。这个地址是公开接口，不包含管理令牌。
6. 推送前端并验证两个浏览器真实提交、刷新读取、原主链接和失败反馈。只有完成这一步才能称共享排行榜上线。

## 数据与接口

- `GET /api/leaderboard`：前 50 名及当前玩家位置。
- `POST /api/scores`：昵称、积分、模式 `free-v2`；匿名身份使用浏览器生成的随机 Bearer 凭据。
- `GET /health`：数据库连接检查。

数据库保存昵称、随机玩家 ID、凭据哈希、最高分与时间，不保存邮件或 GitHub 凭据。CORS 写入来源限制为 `https://guanzigong-agent.github.io`。仅做基本输入与写入频率校验，不将跨域限制称为防作弊。

## 官方文档

- [D1 创建和部署](https://developers.cloudflare.com/d1/get-started/)
- [数据库迁移](https://developers.cloudflare.com/d1/reference/migrations/)
- [Workers 免费额度](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1 免费额度与超限行为](https://developers.cloudflare.com/d1/platform/pricing/)
