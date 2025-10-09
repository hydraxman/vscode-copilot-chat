# Copilot Chat Web 客户端

一个独立的Web客户端，用于通过浏览器访问GitHub Copilot Chat，实现远程"Vibe Coding"。

## 功能特性

- 💬 **实时聊天**: 使用Server-Sent Events (SSE)流式接收Copilot响应
- 📁 **工作区浏览器**: 浏览VS Code工作区的文件和文件夹
- 👁️ **文件查看器**: 直接在浏览器中查看文件内容
- 📋 **活动文件**: 查看VS Code中当前打开的文件
- 🎨 **VS Code主题**: 熟悉的VS Code Dark+主题
- 🔄 **实时更新**: 与VS Code工作区实时同步

## 快速开始

### 1. 启动代理服务器

确保VS Code扩展的代理服务器正在运行（端口3899）：

```bash
# 在VS Code中，扩展会自动启动代理服务器
# 或者设置环境变量
export COPILOT_CHAT_PROXY_PORT=3899
```

### 2. 安装依赖

```bash
cd copilot-chat-client
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器将自动打开 `http://localhost:5173`

## 技术架构

### 前端技术栈

- **React 18** - UI框架
- **Vite** - 构建工具和开发服务器
- **Lucide React** - 图标库
- **React Markdown** - Markdown渲染（支持代码高亮）
- **Server-Sent Events** - 实时流式传输

### 项目结构

```
copilot-chat-client/
├── src/
│   ├── main.jsx                    # React入口
│   ├── App.jsx                     # 根组件
│   ├── components/
│   │   ├── ChatInterface.jsx       # 聊天界面
│   │   ├── ChatMessage.jsx         # 消息显示
│   │   ├── Sidebar.jsx             # 侧边栏（文件浏览）
│   │   └── StatusBar.jsx           # 状态栏
│   └── services/
│       └── apiService.js           # API服务（与代理服务器通信）
├── index.html                      # HTML入口
├── package.json                    # 依赖配置
└── vite.config.js                  # Vite配置
```

## API集成

客户端通过以下端点与代理服务器通信：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/chat` | POST | 发送聊天消息（SSE流） |
| `/api/model/info` | GET | 获取当前AI模型信息 |
| `/api/workspace/structure` | GET | 获取工作区文件树 |
| `/api/workspace/file` | GET | 获取文件内容 |
| `/api/workspace/active-files` | GET | 获取当前打开的文件 |
| `/api/edit/accept` | POST | 接受编辑建议 |
| `/api/edit/decline` | POST | 拒绝编辑建议 |

详细API文档请参考：[Proxy Server API文档](../docs/proxy-server-api.md)

## 使用示例

### 基本对话

1. 在输入框中输入问题
2. 按Enter发送（Shift+Enter换行）
3. Copilot会流式返回响应

### 示例提示词

- "解释一下JavaScript中async/await的工作原理"
- "当前打开了哪些文件？"
- "显示工作区结构"
- "帮我重构这个函数"
- "找出代码中的bug"

### 文件浏览

1. 在左侧边栏查看工作区文件树
2. 点击文件夹展开/折叠
3. 点击文件预览内容
4. 查看"活动文件"标签页看当前在VS Code中打开的文件

## 开发指南

### 开发模式

```bash
npm run dev
```

- 启动Vite开发服务器
- 支持热模块替换（HMR）
- 自动代理API请求到localhost:3899

### 生产构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录

### 预览生产构建

```bash
npm run preview
```

## 配置选项

### 环境变量

创建 `.env` 文件自定义配置：

```env
# 代理服务器API基础URL
VITE_API_BASE=http://localhost:3899
```

### Vite配置

`vite.config.js` 中的代理配置：

```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3899',
    changeOrigin: true,
  }
}
```

## 故障排除

### 连接问题

如果状态栏显示"连接错误"：

1. 检查代理服务器是否在3899端口运行
2. 验证服务器可访问：`curl http://localhost:3899/health`
3. 查看浏览器控制台错误信息
4. 确保防火墙没有阻止连接

### 构建错误

如果遇到构建错误：

1. 删除 `node_modules/` 并重新安装：`npm install`
2. 清除Vite缓存：`rm -rf node_modules/.vite`
3. 检查Node.js版本：`node --version`（需要18+）

### CORS问题

开发服务器已配置代理以避免CORS问题。如果仍遇到CORS错误：

1. 确保通过 `localhost:5173` 访问，而不是其他主机名
2. 检查 `vite.config.js` 中的代理配置
3. 验证代理服务器允许来自客户端源的请求

## 架构设计

### 组件层次

```
App
├── Sidebar (文件浏览器)
│   └── FileTree (递归文件树)
├── ChatInterface (主聊天界面)
│   └── ChatMessage[] (消息列表)
└── StatusBar (状态栏)
```

### 状态管理

- 使用React Hooks（useState, useEffect, useRef）
- 没有使用Redux等状态管理库（保持简单）
- API状态通过apiService集中管理

### SSE流处理

```javascript
// apiService.js中的流处理
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  // 解析SSE数据
  // 调用onChunk回调更新UI
}
```

## 功能路线图

### 已实现 ✅

- 基本聊天界面
- SSE流式响应
- 工作区文件浏览
- 文件内容查看
- 活动文件显示
- 模型信息显示
- VS Code主题

### 计划中 🚧

- [ ] 代码语法高亮（集成Prism.js或Highlight.js）
- [ ] 编辑建议的接受/拒绝功能
- [ ] 对话历史持久化（LocalStorage）
- [ ] 多标签页支持
- [ ] 深色/浅色主题切换
- [ ] 移动端响应式布局
- [ ] 快捷键支持
- [ ] 文件搜索功能
- [ ] 代码片段收藏
- [ ] 导出对话记录

## 贡献

此客户端是vscode-copilot-chat扩展项目的一部分。遵循主项目的贡献指南。

## 许可证

参见项目根目录的LICENSE.txt文件。

---

**远程Vibe Coding，随时随地！** 🚀
