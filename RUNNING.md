# 本地运行说明

当前版本是微信小程序 MVP，只保留：

- 首页
- 四年级数学下册“小数加减法”练习生成
- 错题生成同类题
- 组家庭作业
- 组试卷
- 历史记录
- 隐私说明和关于页面

## 推荐 Node 版本

建议使用 Node.js LTS：

- 推荐：Node.js 20 LTS
- 也可：Node.js 22 LTS

当前电脑是 Node.js 24.15.0。虽然这次已能构建成功，但 Taro / webpack 生态通常优先支持 LTS 版本；如果后续遇到奇怪构建问题，优先切换到 Node 20 或 22。

## 1. 安装依赖

```bash
npm install
```

当前已固定关键版本：

- Taro：`4.2.0`
- webpack：`5.91.0`
- `@babel/preset-react`：`7.24.7`

## 2. 启动后端

```bash
npm run dev:server
```

后端默认地址：

```text
http://127.0.0.1:8787
```

没有配置 API Key 时，会自动使用 mock 数据。

如需接入真实 AI，在项目根目录创建 `.env`：

```bash
OPENAI_API_KEY=你的APIKey
OPENAI_MODEL=gpt-4o-mini
PORT=8787
```

## 3. 启动微信小程序构建

```bash
npm run dev:weapp
```

看到 `Watching...` 或 `Compiled successfully` 就说明构建已启动成功。

构建产物目录：

```text
D:\教学软件\miniapp\dist
```

如果微信开发者工具提示找不到 `dist/app.json`，说明还没有启动小程序构建。先在项目根目录运行：

```bash
npm run build:weapp
```

或保持运行：

```bash
npm run dev:weapp
```

成功后应存在：

```text
D:\教学软件\miniapp\dist\app.json
```

## 4. 微信开发者工具打开目录

请打开：

```text
D:\教学软件\miniapp
```

不要打开：

```text
D:\教学软件
D:\教学软件\miniapp\dist
```

原因：`miniapp` 目录里有 `project.config.json`，其中 `miniprogramRoot` 已指向 `dist/`。

## 5. 本地预览注意

本地开发时，小程序请求：

```text
http://127.0.0.1:8787
```

微信开发者工具里需要勾选“不校验合法域名”，否则本地接口可能无法请求。

## 6. 导出说明

- Word 导出：后端生成 `.doc` 文件，小程序端下载并打开。
- PDF 导出：体验版先保留按钮和提示，正式上线前再接完整 PDF 模板。
