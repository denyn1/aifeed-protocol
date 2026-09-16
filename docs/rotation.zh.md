# 密钥轮换操作手册

<p><a href="rotation.md">English</a> · <a href="rotation.id.md">Bahasa Indonesia</a> · <a href="rotation.zh.md">中文</a></p>

AIFeed manifest 可以在不破坏验证的前提下替换其签名密钥，使用 `rotation` 指令
（规范：[`spec/en/aifeed-v0.2.md`](../spec/en/aifeed-v0.2.md) §14）。本手册涵盖常规流程、
紧急路径，以及客户端会看到什么。

## 开始之前

- manifest 必须是 `version: "0.2"`。v0.1 manifest 需先重新签名为 v0.2
  （`aifeed sign`）。
- 你控制该域名的 `_aifeed` DNS 记录。
- 永久撤销旧密钥需要治理签名（注册表 SLA）；请提前确认，或预先授权离线应急密钥。

## 常规轮换（两条命令）

1. 生成后继密钥并发布重叠期状态：

   ```bash
   aifeed rotate --dir ./my-site --window 72
   ```

   该命令写入重叠期 manifest（由**旧**密钥签名，携带
   `rotation.successor_fp`、`effective_at`、`grace_until`），把后继密钥保存为
   `aifeed-private.next.pem`，并打印 DNS 记录：

   ```
   _aifeed.example.com TXT "v=aifeed1; pk=<old>; pk2=<new>; effective_at=<ts>; manifest=https://example.com/.well-known/ai.json"
   ```

   `pk2` 是建议性交叉校验，不是必需项：缺失或错误时验证器会给出警告
   （`rotation_anchor_unverified`），但仍以签名指令作为锚点。仍然建议发布它。

2. 发布重叠期 manifest 与 DNS 记录。在 `effective_at` 之后：

   ```bash
   aifeed rotate --dir ./my-site
   ```

   该命令用后继密钥签署切换 manifest（更新 `identity.public_key`，
   `rotation.predecessor_fp` 绑定退役密钥），并打印新的 DNS 记录
   （`pk=<new>`，删除 `pk2`）。

3. 把旧指纹发布到撤销注册表（治理签名），然后从外部验证：

   ```bash
   aifeed validate example.com
   ```

## 紧急轮换（怀疑密钥泄露）

不要先撤销——即时撤销会打开中断窗口。压缩重叠期并立即切换：

```bash
aifeed rotate --dir ./my-site --accelerated   # 1 小时预告，6 小时窗口
# 在 effective_at 之后：
aifeed rotate --dir ./my-site
# 然后发布旧指纹
```

在压缩窗口内，可能已泄露密钥的签名仍会被接受，这是设计使然，最多持续窗口长度。
轮换保护的是密钥，不是源站：已经控制你内容与 DNS 的攻击者不在范围内。

## 在不改变任何东西的前提下检查状态

```bash
aifeed rotate --dir ./my-site --dry-run --json
```

阶段：`announced`（旧密钥完全有效）、`grace`（旧密钥有效并带 `grace_accepted` 警告）、
`complete`（后继密钥生效；旧密钥被拒绝）。

## 客户端会看到什么

| 情况 | 结果 |
|---|---|
| 重叠期 manifest，处于 grace 内 | `VERIFIED`，警告 `grace_accepted` |
| 过期旧密钥 manifest 已过 grace | `UNVERIFIED`，`rotation_denied` |
| 休眠固定记录遇到切换绑定 | `VERIFIED`，警告 `rotation_resync` |
| 密钥变更未经公布 | `UNVERIFIED`，`rotation_denied` |
| 旧密钥指纹出现在注册表 | `UNVERIFIED`，`key_revoked` |
