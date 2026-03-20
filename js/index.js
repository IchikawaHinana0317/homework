const STORAGE_KEYS = {
  theme: "LINGXI_THEME",
  apiKey: "LINGXI_API_KEY",
};

const ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const TEXT_MODEL = "qwen-plus";
const VISION_MODEL = "qwen-vl-plus-latest";

const elements = {
  body: document.body,
  hero: document.getElementById("hero"),
  chatList: document.getElementById("chatList"),
  quickGrid: document.getElementById("quickGrid"),
  messageInput: document.getElementById("messageInput"),
  sendButton: document.getElementById("sendButton"),
  imageInput: document.getElementById("imageInput"),
  imagePreviewList: document.getElementById("imagePreviewList"),
  themeToggle: document.getElementById("themeToggle"),
  configToggle: document.getElementById("configToggle"),
  clearChat: document.getElementById("clearChat"),
  stopResponse: document.getElementById("stopResponse"),
  saveApiKey: document.getElementById("saveApiKey"),
  configModal: document.getElementById("configModal"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  saveApiKeyModal: document.getElementById("saveApiKeyModal"),
};

const state = {
  messages: [],
  pendingImages: [],
  controller: null,
  isStreaming: false,
};

marked.setOptions({
  breaks: true,
  gfm: true,
  highlight(code, language) {
    if (language && hljs.getLanguage(language)) {
      return hljs.highlight(code, { language }).value;
    }
    return hljs.highlightAuto(code).value;
  },
});

boot();

function boot() {
  applyTheme(localStorage.getItem(STORAGE_KEYS.theme) || "light");
  elements.apiKeyInput.value = localStorage.getItem(STORAGE_KEYS.apiKey) || "";
  bindEvents();
  updateComposer();
  renderImagePreviews();
  renderConversation();
}

function bindEvents() {
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.configToggle.addEventListener("click", () => elements.configModal.showModal());
  elements.saveApiKey.addEventListener("click", handleSaveApiKey);
  elements.saveApiKeyModal.addEventListener("click", handleSaveApiKey);
  elements.clearChat.addEventListener("click", clearConversation);
  elements.stopResponse.addEventListener("click", stopStreaming);
  elements.sendButton.addEventListener("click", submitMessage);
  elements.imageInput.addEventListener("change", handleImageSelect);
  elements.messageInput.addEventListener("input", () => {
    autoResizeTextarea();
    updateComposer();
  });
  elements.messageInput.addEventListener("keydown", handleTextareaKeydown);

  elements.quickGrid.addEventListener("click", (event) => {
    const card = event.target.closest(".quick-card");
    if (!card) {
      return;
    }
    elements.messageInput.value = card.dataset.prompt || "";
    autoResizeTextarea();
    updateComposer();
    submitMessage();
  });

  elements.chatList.addEventListener("click", async (event) => {
    const button = event.target.closest(".code-copy");
    if (!button) {
      return;
    }
    const code = button.parentElement?.querySelector("code");
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code.innerText);
      button.textContent = "已复制";
      window.setTimeout(() => {
        button.textContent = "复制";
      }, 1200);
    } catch (error) {
      button.textContent = "复制失败";
    }
  });
}

function toggleTheme() {
  applyTheme(elements.body.dataset.theme === "dark" ? "light" : "dark");
}

function applyTheme(theme) {
  elements.body.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function handleSaveApiKey() {
  const apiKey = elements.apiKeyInput.value.trim();
  if (!apiKey) {
    window.alert("请输入有效的 API Key。");
    return;
  }
  localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
  elements.configModal.close();
  window.alert("API Key 已保存到本地浏览器。");
}

function handleTextareaKeydown(event) {
  if (event.key !== "Enter") {
    return;
  }
  if (event.shiftKey) {
    return;
  }
  event.preventDefault();
  submitMessage();
}

function autoResizeTextarea() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 200)}px`;
}

async function handleImageSelect(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  const images = await Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: crypto.randomUUID(),
              name: file.name,
              mime: file.type || "image/png",
              url: reader.result,
            });
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }),
    ),
  );

  state.pendingImages.push(...images);
  elements.imageInput.value = "";
  renderImagePreviews();
  updateComposer();
}

function renderImagePreviews() {
  elements.imagePreviewList.innerHTML = state.pendingImages
    .map(
      (image) => `
        <div class="preview-card">
          <img src="${image.url}" alt="${escapeHtml(image.name)}">
          <button class="preview-remove" type="button" data-image-id="${image.id}">×</button>
        </div>
      `,
    )
    .join("");

  elements.imagePreviewList.querySelectorAll(".preview-remove").forEach((button) => {
    button.addEventListener("click", () => {
      state.pendingImages = state.pendingImages.filter((image) => image.id !== button.dataset.imageId);
      renderImagePreviews();
      updateComposer();
    });
  });
}

function updateComposer() {
  const hasText = elements.messageInput.value.trim().length > 0;
  const hasImages = state.pendingImages.length > 0;
  elements.sendButton.classList.toggle("hidden", !hasText && !hasImages);
  elements.stopResponse.classList.toggle("hidden", !state.isStreaming);
}

function clearConversation() {
  stopStreaming();
  state.messages = [];
  state.pendingImages = [];
  elements.messageInput.value = "";
  autoResizeTextarea();
  renderImagePreviews();
  renderConversation();
  updateComposer();
}

function renderConversation() {
  elements.hero.classList.toggle("hidden", state.messages.length > 0);
  elements.chatList.innerHTML = state.messages.map(renderMessage).join("");
  elements.chatList.querySelectorAll("pre").forEach((pre) => {
    if (!pre.querySelector(".code-copy")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy";
      button.textContent = "复制";
      pre.appendChild(button);
    }
  });
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  });
}

function renderMessage(message) {
  const images = (message.images || [])
    .map((image) => `<img src="${image.url}" alt="${escapeHtml(image.name || "上传图片")}">`)
    .join("");

  const imageHtml = images ? `<div class="message-images">${images}</div>` : "";
  const assistantAvatar = message.role === "assistant"
    ? `<div class="assistant-avatar"><img src="./assets/avatar.svg" alt="AI 头像"></div>`
    : "";
  const bubbleClass = message.typing ? "bubble typing" : "bubble";

  return `
    <article class="message-row ${message.role}">
      ${assistantAvatar}
      <div class="${bubbleClass}">
        ${imageHtml}
        ${message.role === "assistant" ? message.html : `<p>${escapeHtml(message.text).replace(/\n/g, "<br>")}</p>`}
      </div>
    </article>
  `;
}

async function submitMessage() {
  if (state.isStreaming) {
    return;
  }

  const apiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  if (!apiKey) {
    elements.configModal.showModal();
    return;
  }

  const text = elements.messageInput.value.trim();
  const images = [...state.pendingImages];
  if (!text && images.length === 0) {
    return;
  }

  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    text: text || "请结合图片内容进行分析。",
    images,
  };

  const assistantMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    text: "",
    html: "<p>正在思考...</p>",
    typing: true,
  };

  state.messages.push(userMessage, assistantMessage);
  state.pendingImages = [];
  elements.messageInput.value = "";
  autoResizeTextarea();
  renderImagePreviews();
  setStreaming(true);
  renderConversation();

  try {
    state.controller = new AbortController();
    await streamChatCompletion(apiKey, assistantMessage);
  } catch (error) {
    assistantMessage.typing = false;
    if (error.name === "AbortError") {
      if (!assistantMessage.text.trim()) {
        assistantMessage.text = "已停止生成。";
      }
      assistantMessage.html = markdownToHtml(assistantMessage.text);
      renderConversation();
    } else {
      assistantMessage.text = `请求失败：${error.message || "未知错误"}`;
      assistantMessage.html = `<p>${escapeHtml(assistantMessage.text)}</p>`;
      renderConversation();
    }
  } finally {
    setStreaming(false);
    state.controller = null;
    updateComposer();
  }
}

function setStreaming(isStreaming) {
  state.isStreaming = isStreaming;
  updateComposer();
}

function stopStreaming() {
  if (state.controller) {
    state.controller.abort();
  }
}

async function streamChatCompletion(apiKey, assistantMessage) {
  const hasImage = state.messages.some((message) => message.role === "user" && (message.images || []).length > 0);
  const payload = {
    model: hasImage ? VISION_MODEL : TEXT_MODEL,
    stream: true,
    messages: buildApiMessages(),
  };

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: state.controller.signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let streamedText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.replace(/^data:\s*/, "").trim())
        .filter(Boolean);

      for (const line of lines) {
        if (line === "[DONE]") {
          assistantMessage.typing = false;
          assistantMessage.text = streamedText.trim();
          assistantMessage.html = markdownToHtml(streamedText);
          renderConversation();
          return;
        }

        const json = JSON.parse(line);
        const delta = json.choices?.[0]?.delta?.content;
        const deltaText = extractDeltaText(delta);
        if (!deltaText) {
          continue;
        }

        streamedText += deltaText;
        assistantMessage.text = streamedText;
        assistantMessage.html = markdownToHtml(streamedText);
        renderConversation();
      }
    }
  }

  assistantMessage.typing = false;
  assistantMessage.text = streamedText.trim();
  assistantMessage.html = markdownToHtml(streamedText);
  renderConversation();
}

function buildApiMessages() {
  const systemPrompt = {
    role: "system",
    content: "你是灵犀风格的高质量中文 AI 助手。回答要清晰、准确、结构化，适合在前端聊天界面中展示。若适合，请使用 Markdown。",
  };

  return [
    systemPrompt,
    ...state.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => {
        if (message.role === "assistant") {
          return {
            role: "assistant",
            content: message.text,
          };
        }

        if (message.images?.length) {
          const content = [];
          if (message.text) {
            content.push({ type: "text", text: message.text });
          }
          message.images.forEach((image) => {
            content.push({
              type: "image_url",
              image_url: {
                url: image.url,
              },
            });
          });
          return {
            role: "user",
            content,
          };
        }

        return {
          role: "user",
          content: message.text,
        };
      }),
  ];
}

function extractDeltaText(delta) {
  if (!delta) {
    return "";
  }
  if (typeof delta === "string") {
    return delta;
  }
  if (Array.isArray(delta)) {
    return delta
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item?.type === "text") {
          return item.text || "";
        }
        return "";
      })
      .join("");
  }
  if (typeof delta === "object" && typeof delta.text === "string") {
    return delta.text;
  }
  return "";
}

function markdownToHtml(markdown) {
  const rawHtml = marked.parse(markdown || "");
  const template = document.createElement("template");
  template.innerHTML = rawHtml;
  template.content.querySelectorAll("pre code").forEach((block) => hljs.highlightElement(block));
  return template.innerHTML || "<p>...</p>";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
