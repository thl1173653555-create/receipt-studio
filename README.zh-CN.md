# 🧾 小票生成器 · БЭЙ ХАЙ

一个可打印的**俄式餐厅/超市小票生成器**。从菜单点选、实时预览、打印或导出 PDF,
58mm / 80mm 版式对齐真实俄罗斯小票格式。

> 基于 [vinext](https://github.com/cloudflare/vinext)(Next.js 16 + Vite)构建,
> 可选 Cloudflare D1 / Drizzle 支持。

## 📸 效果预览

<p align="center">
  <img src="screenshots/preview.png" alt="小票生成器效果预览 — 餐厅 58mm 与 超市 80mm" width="640" />
</p>

## ✨ 功能特性

- **两种场景**:餐厅(主打 58mm)与超市(主打 80mm),版式对齐真实俄罗斯小票
- **二维码自动生成**:按订单实时生成,随修改联动
- **所见即所得**:所有字段绑定实时预览
- **两种纸型**:58mm 与 80mm,各自独立字号排版
- **打印与 PDF**:打印样式(`@media print`)输出真实纸宽的干净小票页
- **本机历史**:小票保存在浏览器本地(最多 50 张)
- **双语**:俄文小票内容 + 中文界面

## 🧰 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | [Next.js](https://nextjs.org/) 16(App Router、RSC) |
| UI | React 19、Tailwind CSS 4 |
| 构建 | [Vite](https://vite.dev/) 8 + vinext |
| 数据(可选) | [Drizzle ORM](https://orm.drizzle.team/) + Cloudflare D1 |
| 二维码 | `qrcode` |

## 🚀 快速开始

```bash
npm install
npm run dev      # 启动本地开发服务器
npm run build    # 验证构建输出
npm test         # 构建 + 渲染冒烟测试
```

需要 Node.js `>=22.13.0`。

## 🧾 使用方法

1. 选择场景(**餐厅** / **超市**)与纸型(**58mm** / **80mm**)。
2. 填写店铺与订单字段,或点击菜单项右侧 `+` 加入本单。
3. 在"本次点单"中修改数量与单价,预览实时更新。
4. 需要时调整二维码位置。
5. 点击 **打印小票**,在打印对话框中选择"另存为 PDF"即可导出。

## 📁 项目结构

```
app/                  # Next.js 应用(页面、样式)
data/                 # 菜单 JSON(餐厅 + 超市)
db/                   # 可选 Drizzle schema
tests/                # 渲染冒烟测试
drizzle.config.ts     # 迁移配置
```

## 🔒 许可证

[MIT](./LICENSE) © 2026 thl1173653555-create

---

### English version: [README](./README.md)
