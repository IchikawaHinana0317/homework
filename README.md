# 灵犀 AI 对话助手

## 项目基本信息

- 姓名：待填写
- 学校：待填写
- 学号：待填写

## 开发任务索引

- 仿 WPS 灵犀风格首页，包含欢迎标题、副标题与 4 张快捷建议卡片
- 支持点击快捷卡片直接发起提问
- 接入阿里云百炼 OpenAI 兼容接口，支持真实 AI 问答
- 用户消息右侧展示，AI 回复左侧展示并带头像
- 支持流式输出与打字机式逐步呈现
- 支持 Markdown 渲染，包括标题、列表、表格、引用、代码块
- 支持代码高亮与代码块复制按钮
- 支持浅色 / 深色主题切换，并持久化保存
- 输入框固定在底部，内容为空时隐藏发送按钮
- 支持图片上传、预览、删除，并在请求时将图片一并发送给视觉模型
- 支持 `Enter` 发送、`Shift + Enter` 换行
- 支持停止生成
- 支持清空全部对话并回到首页状态
- API Key 使用本地配置文件配合 `localStorage` 存储，固定键名为 `LINGXI_API_KEY`

## 核心技术实现

### 1. 百炼接口接入

项目使用阿里云百炼 OpenAI 兼容接口：

- Endpoint：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`
- 文本对话模型：`qwen-plus`
- 图片问答模型：`qwen-vl-plus-latest`

前端通过 `fetch` 发起 POST 请求，Header 中使用 `Authorization: Bearer ${API_KEY}`。当用户只输入文本时走文本模型；当消息中带有图片时，自动切换到视觉模型，并按照 OpenAI 兼容格式构造 `content` 数组。API Key 通过本地 `js/local-config.js` 手动写入，页面启动时再自动同步到 `localStorage` 的 `LINGXI_API_KEY`。

### 2. 流式响应

请求体中设置 `stream: true`，前端通过 `ReadableStream` 持续读取返回内容，按 SSE 数据块拆分每一段 `data:`。每次拿到增量内容后，就更新当前 AI 消息气泡，从而实现“边生成边显示”的效果。

### 3. Markdown 渲染与代码高亮

项目使用本地引入的 `marked.min.js` 完成 Markdown 转 HTML，再用 `highlight.js` 处理代码块语法高亮。渲染完成后，会为每个代码块动态插入“复制”按钮，方便用户复制示例代码。

### 4. 主题切换与本地持久化

主题通过 `data-theme` 配合 CSS 变量实现，切换时同步写入 `localStorage`。页面刷新后会优先读取本地主题配置，保证主题状态持久化。

### 5. 图片上传与预览

图片上传基于 `FileReader` 转为 Base64 Data URL，并在发送前显示本地预览卡片。用户可以在发送前删除任意图片。真正请求模型时，将图片按 `image_url` 格式和文本一起传给百炼兼容接口。

### 6. 首页与对话态切换

初始状态展示欢迎区和快捷卡片。只要会话列表里出现消息，就隐藏首页内容；当用户点击“清空对话”后，消息列表重置，页面回到初始欢迎态。

## 项目结构

```text
lingxi/
├── index.html
├── README.md
├── assets/
│   ├── avatar.svg
│   └── logo.svg
├── css/
│   ├── highlight.css
│   └── index.css
└── js/
    ├── index.js
    └── vendor/
        ├── highlight.min.js
        └── marked.min.js
```

## 运行方式

1. 复制 `js/local-config.example.js` 为 `js/local-config.js`
2. 在 `js/local-config.js` 中填入你的阿里云百炼 API Key
3. 使用 VS Code 的 Live Server 打开 `index.html`
4. 刷新页面后开始对话

## 说明

- 真实 API Key 放在 `js/local-config.js` 中，该文件已加入 `.gitignore`
- 页面不会显式提供 API Key 输入框，而是在加载时自动把本地配置同步到浏览器 `localStorage`
- 这是作业式本地方案，若部署到公开网站，前端仍无法真正隐藏密钥，生产环境应改为后端代理
- 作业要求中的 `姓名_学号_灵犀.mp4` 需自行录制后放到项目根目录
