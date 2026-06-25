# 译境 TransAdapt v1 设计文档

- 日期：2026-06-25
- 状态：已认可，待实现
- 形态：单页 Web 应用（方案 A）

## 1. 目标

将现有 `yijing.html` 静态原型升级为可用的场景化翻译 Web 应用，支持任意文本输入、场景切换、双语对照、文化注释，以及中译英反向翻译。翻译能力由智谱 GLM-4-Flash（免费模型）通过轻量 Express 后端代理提供。

## 2. 非目标（v1 不做）

- 浏览器插件化（content script / 划词翻译）
- 微信小程序端
- 实时双语字幕
- 网页排版保留式翻译
- 用户账号 / 历史记录持久化

## 3. 架构

```
浏览器 (yijing.html, 原生JS)
   │  POST /api/translate {text, scene, direction}
   ▼
Express 后端 (server.js, 单文件)
   │  构造 Prompt → 调用智谱 GLM-4-Flash
   ▼
返回结构化 JSON {translation, bilingual[], notes[]}
```

前后端同源部署，Express 同时托管 `yijing.html` 静态文件，单端口（默认 3000）。

## 4. 项目结构

```
e:\chl\yijing\
  yijing.html        前端（在现有原型上增强）
  server.js          Express 后端 + LLM 代理
  package.json
  .env.example       ZHIPU_API_KEY=xxx （配置模板）
  .gitignore         忽略 node_modules / .env
```

## 5. 前端组件（原生 JS，无框架）

- 场景栏：正式商务 / 日常口语 / 学术论文（可切换）
- 方向切换：英→中 / 中→英
- 原文输入区：可编辑 textarea（替换原静态展示）
- 翻译按钮：触发请求，带 loading 态
- 双语对照区：逐句 src↔tgt 并排，高亮词可点击
- 文化注释气泡区：自动列出习语解释；点击高亮词定位对应注释

## 6. 后端接口

`POST /api/translate`

- 入参：`{ text: string, scene: "formal"|"casual"|"academic", direction: "en2zh"|"zh2en" }`
- 出参：`{ translation, bilingual: [{src, tgt, highlights: [{phrase, note}]}], notes: [{phrase, explanation, origin}] }`
- 错误码：
  - 400 空输入
  - 503 缺 ZHIPU_API_KEY
  - 502 LLM 调用失败 / 超时
  - 500 JSON 解析失败

## 7. Prompt 设计

要求 GLM-4-Flash 严格返回 JSON（不带 markdown 包裹）：

```
你是「译境」翻译引擎。按场景{scene}、方向{direction}翻译以下文本。
返回纯 JSON，不要 markdown 包裹：
{
  "translation": "整段译文",
  "bilingual": [{"src":"原句","tgt":"译句","highlights":[{"phrase":"习语原文","note":"简短注释"}]}],
  "notes": [{"phrase":"习语","explanation":"含义与文化背景","origin":"来源"}]
}
仅对习语/俚语/文化隐喻生成 notes；无则返回空数组。
```

后端容错：若 LLM 返回带 markdown 包裹，提取首个 `{...}` 块解析。

## 8. 错误处理

- 启动时检查 `ZHIPU_API_KEY`，缺失则打印提示但仍启动（/api/translate 返回 503）
- LLM 超时 30s → 502 + "翻译服务暂不可用"
- JSON 解析失败 → 500 + "翻译结果解析失败，请重试"
- 前端空输入校验，按钮禁用

## 9. 测试方式

- 后端：`curl -X POST localhost:3000/api/translate -H "Content-Type: application/json" -d '{"text":"pick up the ball","scene":"formal","direction":"en2zh"}'`
- 前端：浏览器打开 `http://localhost:3000`，手动测各场景 + 方向 + 高亮点击

## 10. 依赖

- express（Web 框架 + 静态托管）
- dotenv（读取 .env）
- 无前端构建依赖
