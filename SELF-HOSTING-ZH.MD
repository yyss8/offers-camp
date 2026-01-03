# 🏕️ Offers Camp 自架服务器教程

[ENGLISH VERSION](SELF-HOSTING.MD)

本文档说明如何在您自己的机器或 VPS 上运行 **Offers Camp**。
自架服务器是一个一流的选项，让您完全控制自己的数据。

---

## 架构概述

```
Tampermonkey 收集器
        ↓
 Offers Camp API (Node / Express)
        ↓
      MySQL
        ↓
 Offers Camp 网页仪表板
```

您可以在本地运行所有内容进行开发，或将相同的设置部署到 VPS。

---

## 前置要求

- Node.js 20.0+
- MySQL 8.0+
- npm
- 安装了支持 Tampermonkey 的现代浏览器

---

### 环境变量

根据 `.env.example` 编辑 `.env` 文件：

```env
PORT=4000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=offerscamp
DB_PASSWORD=change-me
DB_NAME=offers_camp

SESSION_SECRET=change-me
FRONTEND_ORIGIN=http://localhost:5173
```

---

## 数据库设置（MySQL）

使用提供的Mysql schema文件创建数据库和表：

```bash
mysql -u root -p < backend/sql/schema.sql
```

### Schema说明

- `offers` 表存储去重后每个用户和卡片Offer信息
- 复合主键防止重复上传
- JSON 列用于类别和渠道
- 字符集为 `utf8mb4` 以支持完整的 Unicode

---

## 后端（API）设置

从代码仓库根目录：

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API 将在以下地址可用：

```
http://localhost:4000
```

---

## 前端（仪表板）设置

从代码仓库根目录：

```bash
cd frontend
npm install
npm run dev
```

网页 UI 将在以下地址可用：

```
http://localhost:5173
```

运行后，您可以登录并浏览从 Tampermonkey 脚本同步的Offer信息。

---

## 使用本地 Tampermonkey 脚本文件进行本地开发或实现最大隐私保护

1. 在 Tampermonkey 中打开已安装的 Offers Camp 用户脚本。
2. 用代码仓库根目录中的 `tampermonkey.dev.js` 替换其内容。
3. 确保 `@require` 的内容指向您的本地前端端点（例如 `http://localhost:5173`）。
4. 更新 Tampermonkey 脚本使用的配置文件 `frontend\public\tm\js\offers-config.js` 中的 API 链接。

---

## 生产部署说明

部署到 VPS 时：

- 确保 `frontend\public\tm\js\offers-config.js` 指向您的公共 API 域名。
- 确保 `FRONTEND_ORIGIN` 指向您的公共前端域名。

---
`
## 总结

自架 Offers Camp 服务器可以为您提供：
`
- 完全的数据所有权
- 移动端友好的Offer浏览
- 不依赖第三方插件服务器
- 收集和查看之间的清晰分离

云端是可选的。控制权不是。

---
