# AI 穿搭搭配工具 - OUTFIT PREVIEW

基于 Vibe Coding 开发的简易 AI 穿搭搭配工具，用于面试演示。

## 线上 Demo

- **GitHub Pages（正式链接）**：<https://54jxh.github.io/ai-outfit-styler/>
- **源码仓库**：<https://github.com/54jxh/ai-outfit-styler>
- 备用隧道链接（带本地代理，支持虚拟试衣）：运行 `tools/start_pinggy.ps1` 或 `tools/start_demo.ps1` 后查看临时 URL；首次访问隧道提示页需点击进入。

## 三大功能区

1. **单品库区（左侧）**：25 件预设单品（上衣 / 下装 / 外套 / 连衣裙 / 鞋 / 配饰 / 包），支持类别、季节、场合筛选，支持按名称、颜色、备注搜索；可添加、编辑衣服，导入 / 导出 JSON 备份。
2. **拖拽搭配区（中间）**：拖拽或点击加入单品，支持随机搭配、清空、风格预设（休闲 / 正式 / 街头 / 优雅 / 极简）、保存套装、套装载入。
3. **穿搭成果展示区（右侧）**：对接 AI 图像生成接口（Pollinations.ai 免费文生图，无需 API Key），自动生成穿搭效果图，支持下载与重新生成；本地代理模式下还可使用 IDM-VTON 虚拟试衣，保持模特脸部不变。

## 本地运行

方式一（推荐，支持虚拟试衣）：

```bash
python server.py
# 访问 http://localhost:8899
```

方式二（纯静态，直连 AI 生图）：

```bash
python -m http.server 8099 -d .
# 访问 http://localhost:8099
```

## 技术栈

- 前端：HTML5 + CSS3 + 原生 JavaScript（零构建依赖）
- AI 接口：Pollinations.ai 文生图、IDM-VTON 虚拟试衣
- 存储：LocalStorage 本地持久化
- 部署：GitHub Pages（静态直连模式）

## 演示视频

操作演示视频见 `demo/` 目录：`AI穿搭搭配工具_操作演示.mp4`。

## 自动化脚本（tools/）

- `demo_run.py`：Playwright + Edge 自动化操作并录屏
- `start_static.py`：启动纯静态服务器
- `start_pinggy.ps1`：启动 Pinggy 隧道（备用在线链接）
- `start_demo.ps1`：启动本地服务 + localhost.run 隧道
- `deploy.py`：GitHub 仓库与 Pages 配置
