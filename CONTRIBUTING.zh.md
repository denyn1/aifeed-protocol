# 为 AIFeed 做贡献

<p><a href="CONTRIBUTING.md">English</a> · <a href="CONTRIBUTING.id.md">Bahasa Indonesia</a> · <a href="CONTRIBUTING.zh.md">中文</a></p>

感谢你帮助 AIFeed 成为全球化、可信赖的标准。本仓库承载规范、参考实现、一致性向量与
WordPress 发布插件。

改动任何内容之前，请先阅读维护契约：
[`AGENTS.md`](AGENTS.md)（生成文件、版本位置、常见陷阱）、
[`docs/architecture.md`](docs/architecture.md)（模块地图、不变量）与
[`docs/release.md`](docs/release.md)（发布/升级步骤）。

## 参与方式

- **规范反馈** —— 提交 issue，说明问题、受影响的章节与具体建议。破坏性变更需要附上
  版本影响说明。
- **实现** —— 欢迎针对 `lib/`、`bin/`、`clients/python/`、`packages/`、`wp-plugin/`
  与工具的 pull request。
- **一致性向量** —— 新增正/反例是提升互操作性最快的方式。请附上预期的错误/警告码。
- **翻译** —— 规范以英文为正本；官方译文位于 `spec/<lang>/`。见下方语言政策。
- **集成报告** —— 试点结果、边缘（nginx/Caddy/Cloudflare）部署与性能数字都极具价值。
  可使用 `pilot/` 中的模板。

## 规范变更要求

1. 对任何事实主张标注证据标签（[F] 事实、[M] 可信、[E] 模型、[S] 实测模拟、
   [H] 法律审查）。
2. 运行唯一门禁并保持全绿：
   ```bash
   npm run verify
   ```
   它覆盖语法检查、版本/一致性检查、JS + Python 套件、全部向量检查、SDK 同步、
   论文检查与站点构建。完整契约（生成文件、版本位置、证据标签）见 `AGENTS.md`。
3. 同时更新各语言目录（`spec/en/` 正本、`spec/id/` 与 `spec/zh/` 译文），或在 PR
   描述中把译文标记为待补。
4. 对任何规范性行为变更，新增或更新一致性向量。
5. 对 PHP 改动，对改动文件运行 `php -l`，并运行
   `php tests/jcs-test.php && php tests/mako-test.php`。

## 代码准则

- 零运行时依赖（Node >= 20、PHP >= 7.2、纯 Python）是硬性规则。
- 解析器必须遵循严格/安全解析规则：拒绝重复键、要求 NFC、整数有界、仅安全 YAML
  子集、无 `__proto__` 污染。
- 测试与夹具中不得出现密钥；使用确定性种子。
- 错误码一旦发布就保持稳定；新码是增量式的。

## 翻译政策

`spec/en/` 中的英文文档为规范性文本。官方译文仅供参考；出现分歧时以英文为准。
优先语言：联合国六种官方语言，加印度尼西亚语、葡萄牙语、印地语与斯瓦希里语。
每种语言开一个 PR，并保持行结构与源文接近，便于审阅。

## 贡献许可

贡献采用 inbound=outbound，无 CLA：

- 代码（`lib/`、`bin/`、`clients/`、`packages/`、`integrations/`、`tools/`、插件）——
  MIT。
- 规范文本（`spec/`）—— CC BY 4.0。
- 一致性向量（`conformance/`）—— CC0。

提交 pull request 即表示你确认有权按上述条款提交该作品。反滥用模式清单或检测启发式的
贡献不通过公开 issue 或 pull request 接受（见 `GOVERNANCE.md` 的 "Licensing and
open-core policy"）。

## 治理与安全

见 `GOVERNANCE.md` 与 `SECURITY.md`。安全报告请勿开公开 issue。
