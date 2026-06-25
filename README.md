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
# yijing
