require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname));

// 智谱 GLM 配置
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const ZHIPU_MODEL = 'glm-4-flash';

const SCENE_LABELS = {
  formal: '正式商务',
  casual: '日常口语',
  academic: '学术论文',
};

// 构造翻译 Prompt，要求返回结构化 JSON
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

// 容错：去除可能的 markdown 包裹并解析 JSON
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  return JSON.parse(raw.slice(start, end + 1));
}

// 翻译接口：代理调用智谱 GLM-4-Flash
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

// 启动检查 API Key
if (!ZHIPU_API_KEY) {
  console.warn('[警告] 未配置 ZHIPU_API_KEY，请在 .env 中设置（参考 .env.example）。翻译接口将返回 503。');
}

app.listen(PORT, () => {
  console.log(`译境 TransAdapt 已启动: http://localhost:${PORT}`);
});
