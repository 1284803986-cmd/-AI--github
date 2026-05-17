# 上线准备说明

## 1. 后端部署

小程序前端不能直接调用大模型 API，必须先部署后端服务。

后端需要提供 HTTPS 地址，例如：

```text
https://api.example.com
```

部署后，在服务器环境变量中配置：

```bash
OPENAI_API_KEY=你的APIKey
OPENAI_MODEL=gpt-4o-mini
PORT=8787
```

## 2. 小程序接口地址

上线前需要把 `miniapp/src/utils/api.js` 里的：

```js
const API_BASE = "http://127.0.0.1:8787";
```

改成你的 HTTPS 后端域名。

## 3. 微信小程序后台配置

在微信公众平台配置 request 合法域名：

```text
https://api.example.com
```

上线版不能依赖本地 `127.0.0.1`。

## 4. 体验版测试

1. 运行 `npm run build:weapp`
2. 用微信开发者工具打开 `D:\教学软件\miniapp`
3. 确认页面、生成题目、错题同类题、历史记录正常
4. 上传体验版
5. 用真机测试接口、页面显示和错误提示

## 5. 审核注意

- 页面已提示：AI 内容仅供辅助，建议家长或老师审核
- 不提供登录、支付、OCR、班级系统
- 不采集学生真实姓名、手机号、身份证等敏感信息
- 需要确保隐私说明页面可访问
