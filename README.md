# 小学 AI 出题助手

微信小程序 MVP 上线准备版。

当前只保留：

- 首页
- 四年级数学下册“小数加减法”练习生成
- 错题生成同类题
- 历史记录
- 隐私说明
- 关于页面
- AI 内容审核提示

暂不包含：

- 全年级
- 全科目
- 复杂试卷生成
- OCR
- 登录
- 支付
- 班级系统
- 老师后台
- 抖音小程序适配

## 项目结构

```text
miniapp/   Taro + React 微信小程序前端
server/    Node.js + Express 后端
content/   四年级数学小数加减法内容配置
```

## 快速运行

```bash
npm install
npm run dev:server
npm run dev:weapp
```

微信开发者工具打开：

```text
D:\教学软件\miniapp
```

更详细步骤见 [RUNNING.md](./RUNNING.md)。
