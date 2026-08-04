# AI 真人换装搭配工具 - OUTFIT PREVIEW

基于 Vibe Coding 开发的简易 AI 穿搭搭配工具，用于线上面试演示。

## 核心设计：真人照片 + AI 只贴衣服

**不使用 AI 生成虚拟人物。** 用户上传自己的真实照片（或使用内置真人示例照），
AI 换装引擎只负责把单品库中的衣服贴合到真人身上，保留真人长相、发型和身材。

## 线上 Demo

- **GitHub Pages（正式链接）**：https://54jxh.github.io/ai-outfit-styler/
- **源码仓库**：https://github.com/54jxh/ai-outfit-styler

## 三大功能区

1. **单品库区（左侧）**：25 件预设单品（上衣 / 下装 / 外套 / 连衣裙 / 鞋 / 配饰 / 包），
   支持类别、季节、场合筛选，支持按名称、颜色、备注搜索；可添加、编辑衣服，导入 / 导出 JSON 备份。
2. **拖拽搭配区（中间）**：拖拽或点击加入单品，支持随机搭配、清空、风格预设（休闲 / 正式 / 街头 / 优雅 / 极简）、保存套装。
3. **穿搭成果展示区（右侧）**：展示真人照片，点击"AI 真人换装"后调用在线换装接口，
   将选中的衣服贴合到真人照片上，支持下载与重新生成。

## AI 换装原理

- 人像来源：用户上传的真实照片（仅保存在本地浏览器 localStorage，不上传服务器）
- 衣服来源：单品库中的真实服装图片
- 换装引擎：Kwai-Kolors Virtual Try-On（Gradio 在线接口，浏览器直连，无需 API Key）
- 隐私说明：AI 不会生成虚拟人物，只做衣服贴合

## 本地运行

方式一（推荐，支持本地代理）：

```bash
python server.py
# 访问 http://localhost:8899
```

方式二（纯静态）：

```bash
python -m http.server 8099 -d .
# 访问 http://localhost:8099
```

> 注意：在线换装接口对 GitHub Pages 域名开放了跨域访问；本地 localhost 直连会被接口拒绝，
> 建议直接使用线上 Demo 体验完整换装流程。

## 技术栈

- 前端：HTML5 + CSS3 + 原生 JavaScript（零构建依赖）
- AI 接口：Kwai-Kolors Virtual Try-On（真人照片换装）
- 存储：localStorage 本地持久化
- 部署：GitHub Pages（静态直连模式）

## 演示视频

操作演示视频见 `demo/` 目录：`AI穿搭搭配工具_操作演示.mp4`。

## 自动化脚本（tools/）

- `demo_run.py`：Playwright + Edge 自动化操作并录屏
- `deploy.py`：GitHub 仓库 + Pages 配置
- `smoke_test_app.py`：端到端冒烟测试
