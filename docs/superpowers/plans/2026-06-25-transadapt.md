# 译境 TransAdapt v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 `yijing.html` 静态原型升级为可用的场景化翻译 Web 应用，前端原生 JS + 后端 Express 代理智谱 GLM-4-Flash。

**Architecture:** 单端口 Express 同时托管静态 `yijing.html` 和 `/api/translate` 接口；前端用原生 JS 实现场景切换、方向切换、双语对照、高亮注释交互；后端构造 Prompt 调用智谱 GLM-4-Flash，返回结构化 JSON。

**Tech Stack:** Node.js, Express, dotenv, 智谱 GLM-4-Flash API, 原生 HTML/CSS/JS（无前端构建）

---

## File Structure

- `e:\chl\yijing\package.json` — 依赖与启动脚本
- `e:\chl\yijing\.env.example` — API Key 配置模板
- `e:\chl\yijing\.gitignore` — 忽略 node_modules / .env
- `e:\chl\yijing\server.js` — Express 后端 + LLM 代理（单文件）
- `e:\chl\yijing\yijing.html` — 前端（在现有原型上增强，加入交互 JS）

---

### Task 1: 项目初始化与依赖

**Files:**
- Create: `e:\chl\yijing\package.json`
- Create: `e:\chl\yijing\.env.example`
- Create: `e:\chl\yijing\.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "transadapt",
  "version": "1.0.0",
  "description": "译境 TransAdapt - 场景化智能翻译 Web 应用",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.19.2",
    "dotenv": "^16.4.5"
  }
}
```

- [ ] **Step 2: 创建 .env.example**

```
# 智谱 GLM API Key，前往 https://bigmodel.cn 注册获取（GLM-4-Flash 模型免费）
ZHIPU_API_KEY=your_key_here
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
.env
```

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: 生成 node_modules，无报错

- [ ] **Step 5: 提交**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: 初始化项目依赖与配置"
```

---

### Task 2: Express 后端 + 静态托管

**Files:**
- Create: `e:\chl\yijing\server.js`

- [ ] **Step 1: 创建 server.js，实现静态托管与启动检查**

```javascript
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// 启动检查 API Key
if (!process.env.ZHIPU_API_KEY) {
  console.warn('[警告] 未配置 ZHIPU_API_KEY，请在 .env 中设置（参考 .env.example）。翻译接口将返回 503。');
}

app.listen(PORT, () => {
  console.log(`译境 TransAdapt 已启动: http://localhost:${PORT}`);
});
```

- [ ] **Step 2: 启动验证静态托管**

Run: `npm start`
Expected: 控制台输出 `译境 TransAdapt 已启动: http://localhost:3000`
浏览器打开 `http://localhost:3000/yijing.html` 应能看到现有原型页面。

- [ ] **Step 3: 提交**

```bash
git add server.js
git commit -m "feat: Express 后端启动与静态托管"
```

---

### Task 3: /api/translate 接口与智谱 GLM 调用

**Files:**
- Modify: `e:\chl\yijing\server.js`

- [ ] **Step 1: 在 server.js 中加入 /api/translate 路由**

在 `app.listen` 之前插入：

```javascript
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4-flash';

const SCENE_LABELS = {
  formal: '正式商务',
  casual: '日常口语',
  academic: '学术论文',
};

function buildPrompt(text, scene, direction) {
  const sceneLabel = SCENE_LABELS[scene] || '正式商务';
  const dirLabel = direction === 'zh2en' ? '中文译为英文' : '英文译为中文';
  return `你是「译境」翻译引擎。请按场景【${sceneLabel}】、方向【${dirLabel}】翻译以下文本。

返回纯 JSON，不要使用 markdown 代码块包裹：
{
  "translation": "整段译文",
  "bilingual": [{"src":"原句","tgt":"译句","highlights":[{"phrase":"习语原文","note":"简短注释"}]}],
  "notes": [{"phrase":"习语或文化表达","explanation":"含义与文化背景","origin":"来源或语源"}]
}

要求：
1. bilingual 按句子切分，src 与 tgt 一一对应。
2. 仅对习语、俚语、文化隐喻、专业术语生成 highlights 与 notes；无则返回空数组。
3. notes 的 explanation 用中文，解释为什么这样译。
4. 严格返回 JSON，不要任何额外文字。

待翻译文本：
${text}`;
}

function extractJson(text) {
  // 容错：去除可能的 markdown 包裹
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  return JSON.parse(raw.slice(start, end + 1));
}

app.post('/api/translate', async (req, res) => {
  const { text, scene, direction } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: '原文不能为空' });
  }
  if (!ZHIPU_API_KEY) {
    return res.status(503).json({ error: '未配置 ZHIPU_API_KEY，请在 .env 中设置' });
  }
  const validScenes = ['formal', 'casual', 'academic'];
  const validDirs = ['en2zh', 'zh2en'];
  const safeScene = validScenes.includes(scene) ? scene : 'formal';
  const safeDir = validDirs.includes(direction) ? direction : 'en2zh';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch(ZHIPU_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
      },
      body: JSON.stringify({
        model: ZHIPU_MODEL,
        messages: [{ role: 'user', content: buildPrompt(text, safeScene, safeDir) }],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('GLM 调用失败:', resp.status, errText);
      return res.status(502).json({ error: '翻译服务暂不可用，请稍后重试' });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = extractJson(content);
    } catch (e) {
      console.error('JSON 解析失败:', content);
      return res.status(500).json({ error: '翻译结果解析失败，请重试' });
    }
    if (!parsed) {
      return res.status(500).json({ error: '翻译结果解析失败，请重试' });
    }
    res.json(parsed);
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      return res.status(502).json({ error: '翻译请求超时，请重试' });
    }
    console.error('翻译接口异常:', e);
    res.status(502).json({ error: '翻译服务暂不可用，请稍后重试' });
  }
});
```

- [ ] **Step 2: 用 curl 验证接口（需先在 .env 配置 Key）**

Run: `npm start`（另一终端）
Run: `curl -X POST http://localhost:3000/api/translate -H "Content-Type: application/json" -d "{\"text\":\"We need to pick up the ball on this project.\",\"scene\":\"formal\",\"direction\":\"en2zh\"}"`
Expected: 返回 JSON，含 translation / bilingual / notes 字段

- [ ] **Step 3: 验证缺 Key 时的 503**

临时清空 .env 的 Key，重启，再次 curl。
Expected: 返回 `{"error":"未配置 ZHIPU_API_KEY..."}`，状态码 503

- [ ] **Step 4: 提交**

```bash
git add server.js
git commit -m "feat: /api/translate 接口与智谱 GLM-4-Flash 集成"
```

---

### Task 4: 前端交互增强

**Files:**
- Modify: `e:\chl\yijing\yijing.html`

- [ ] **Step 1: 在现有 yijing.html 上改造为可交互应用**

完整替换 `<body>` 内容，并在 `<style>` 末尾追加交互样式。具体改动：

1. 在 `</style>` 前追加新样式：

```css
.toolbar { display: flex; gap: 8px; padding: 10px 22px; background: #fafbfc; border-bottom: 1px solid #f0f0f0; align-items: center; }
.dir-toggle { display: flex; background: #eef2ff; border-radius: 30px; padding: 2px; }
.dir-btn { padding: 5px 14px; border-radius: 30px; border: none; background: transparent; font-size: 12px; cursor: pointer; color: #4f46e5; }
.dir-btn.active { background: white; color: #1a1a2e; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.input-area { padding: 16px 22px 8px; }
.input-area textarea { width: 100%; min-height: 90px; border: 1px solid #e0e0e0; border-radius: 12px; padding: 12px 14px; font-size: 15px; line-height: 1.6; resize: vertical; font-family: inherit; }
.input-area textarea:focus { outline: none; border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,0.1); }
.action-bar { padding: 4px 22px 16px; display: flex; gap: 10px; align-items: center; }
.translate-btn { background: #1a1a2e; color: white; border: none; padding: 9px 22px; border-radius: 30px; font-size: 14px; cursor: pointer; font-weight: 500; transition: opacity 0.15s; }
.translate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.translate-btn.loading { background: #6b7280; }
.status { font-size: 12px; color: #888; }
.error-msg { color: #dc2626; }
.bilingual { margin-bottom: 12px; }
.bi-row { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px dashed #eee; }
.bi-row:last-child { border-bottom: none; }
.bi-src, .bi-tgt { flex: 1; font-size: 14px; line-height: 1.6; }
.bi-src { color: #555; }
.bi-tgt { color: #1e293b; }
.bi-tag { font-size: 10px; color: #999; margin-bottom: 2px; }
.highlight { background: #fef3c7; padding: 0 4px; border-radius: 4px; cursor: pointer; border-bottom: 2px dashed #f59e0b; }
.highlight:hover { background: #fde68a; }
.empty-state { text-align: center; color: #aaa; font-size: 13px; padding: 30px 0; }
```

2. 替换 `<body>` 内的 `.card` 整块为：

```html
<div class="card">
    <div class="header">
        <h1>🌐 译境</h1>
        <span>场景翻译 · v1.0</span>
    </div>
    <div class="scene-bar">
        <button class="scene-btn active" data-scene="formal">📄 正式商务</button>
        <button class="scene-btn" data-scene="casual">💬 日常口语</button>
        <button class="scene-btn" data-scene="academic">📘 学术论文</button>
    </div>
    <div class="toolbar">
        <div class="dir-toggle">
            <button class="dir-btn active" data-dir="en2zh">英 → 中</button>
            <button class="dir-btn" data-dir="zh2en">中 → 英</button>
        </div>
    </div>
    <div class="input-area">
        <textarea id="srcText" placeholder="在此粘贴要翻译的文本..."></textarea>
    </div>
    <div class="action-bar">
        <button class="translate-btn" id="translateBtn">译</button>
        <span class="status" id="status"></span>
    </div>
    <div class="main" id="resultArea">
        <div class="empty-state">输入文本后点击「译」按钮</div>
    </div>
</div>
```

3. 在 `</body>` 前加入脚本：

```html
<script>
const state = { scene: 'formal', direction: 'en2zh' };

document.querySelectorAll('.scene-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.scene-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.scene = btn.dataset.scene;
  });
});

document.querySelectorAll('.dir-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dir-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.direction = btn.dataset.dir;
  });
});

const btn = document.getElementById('translateBtn');
const statusEl = document.getElementById('status');
const resultArea = document.getElementById('resultArea');
const srcInput = document.getElementById('srcText');

btn.addEventListener('click', async () => {
  const text = srcInput.value.trim();
  if (!text) { statusEl.textContent = '请输入原文'; statusEl.className = 'status error-msg'; return; }
  btn.disabled = true; btn.classList.add('loading'); btn.textContent = '翻译中...';
  statusEl.className = 'status'; statusEl.textContent = '';
  try {
    const resp = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, scene: state.scene, direction: state.direction }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || '翻译失败');
    renderResult(data);
    statusEl.textContent = '✅ 已适配场景';
  } catch (e) {
    resultArea.innerHTML = `<div class="empty-state error-msg">${e.message}</div>`;
    statusEl.textContent = '';
  } finally {
    btn.disabled = false; btn.classList.remove('loading'); btn.textContent = '译';
  }
});

function renderResult(data) {
  const { translation, bilingual = [], notes = [] } = data;
  let html = '';
  if (bilingual.length) {
    html += '<div class="section-title">双语对照</div><div class="bilingual">';
    bilingual.forEach(row => {
      const tgt = highlightTgt(row.tgt, row.highlights || []);
      html += `<div class="bi-row"><div class="bi-src"><div class="bi-tag">原文</div>${escapeHtml(row.src)}</div><div class="bi-tgt"><div class="bi-tag">译文</div>${tgt}</div></div>`;
    });
    html += '</div>';
  } else {
    html += `<div class="section-title">译文</div><div class="translation-result"><div class="content">${escapeHtml(translation)}</div></div>`;
  }
  if (notes.length) {
    html += '<div class="section-title">文化注释</div>';
    notes.forEach(n => {
      html += `<div class="note-bubble"><div class="icon">💡</div><div class="text"><strong>${escapeHtml(n.phrase)}</strong>：${escapeHtml(n.explanation)}${n.origin ? `<br><span style="color:#a16207;">语源：${escapeHtml(n.origin)}</span>` : ''}</div></div>`;
    });
  }
  resultArea.innerHTML = html;
}

function highlightTgt(tgt, highlights) {
  let s = escapeHtml(tgt);
  highlights.forEach(h => {
    const phrase = escapeHtml(h.phrase);
    const note = escapeHtml(h.note).replace(/"/g, '&quot;');
    s = s.split(phrase).join(`<span class="highlight" title="${note}">${phrase}</span>`);
  });
  return s;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
</script>
```

- [ ] **Step 2: 启动并手动验证**

Run: `npm start`
浏览器打开 `http://localhost:3000/yijing.html`
测试：
1. 默认英→中、正式商务，输入 `We need to pick up the ball on this project.`，点「译」
2. 切换场景为日常口语，重新翻译，观察译文变化
3. 切换方向为中→英，输入中文，验证反向翻译
4. 点击译文中的高亮词，查看 title 提示

Expected: 各场景与方向均能返回结构化结果，高亮可悬停看注释

- [ ] **Step 3: 提交**

```bash
git add yijing.html
git commit -m "feat: 前端交互增强 - 场景/方向切换/双语对照/文化注释"
```

---

### Task 5: 端到端验证与 README

**Files:**
- Create: `e:\chl\yijing\README.md`

- [ ] **Step 1: 创建 README.md**

```markdown
# 译境 TransAdapt

语境感知的智能翻译与跨文化沟通助手。

## 快速开始

1. 安装依赖
   ```bash
   npm install
   ```
2. 配置 API Key
   - 复制 `.env.example` 为 `.env`
   - 前往 https://bigmodel.cn 注册获取 API Key（GLM-4-Flash 模型免费）
   - 填入 `ZHIPU_API_KEY=你的key`
3. 启动
   ```bash
   npm start
   ```
4. 打开浏览器访问 http://localhost:3000/yijing.html

## 功能

- 场景化翻译：正式商务 / 日常口语 / 学术论文
- 双语对照：逐句原文与译文并排
- 文化注释：自动识别习语/俚语/文化隐喻并解释
- 双向翻译：英→中 / 中→英

## 技术栈

- 前端：原生 HTML/CSS/JS（无构建）
- 后端：Node.js + Express
- LLM：智谱 GLM-4-Flash
```

- [ ] **Step 2: 端到端冒烟测试**

Run: `npm start`
完整走查：英→中正式、英→中口语、英→中学术、中→英正式，各至少一次。
Expected: 全部正常返回，无 500/502 错误

- [ ] **Step 3: 提交**

```bash
git add README.md
git commit -m "docs: 添加 README 与使用说明"
```

---

## Self-Review

- **Spec coverage**: 场景化翻译 ✓ (Task 3+4), 文化注释 ✓ (Task 3 Prompt + Task 4 渲染), 双语对照+高亮 ✓ (Task 4), 中译英反向 ✓ (Task 4 方向切换), LLM+轻量后端 ✓ (Task 2+3), 错误处理 ✓ (Task 3 全部错误码), 测试方式 ✓ (Task 3 curl + Task 5 冒烟)
- **Placeholder scan**: 无 TBD/TODO，所有步骤含完整代码
- **Type consistency**: `scene` (formal/casual/academic)、`direction` (en2zh/zh2en)、返回结构 `{translation, bilingual[], notes[]}` 在前后端一致
