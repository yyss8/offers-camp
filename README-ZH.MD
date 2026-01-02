# Offers Camp

[![Offers Camp logo](https://offers.camp/images/logo-sm.png)](https://offers.camp)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Tampermonkey](https://img.shields.io/badge/UserScript-Tampermonkey-red)](https://www.tampermonkey.net/)

[ENGLISH README](README.md)

**Offers Camp** 是一个可自托管、隐私优先的信用卡Offer收集平台。它通过浏览器用户脚本收集数据并同步到网页仪表板，让您能够在一个平台搜索、筛选和跟踪多家银行的Offer信息。

## ✨ 功能特性

- **统一平台**：同时查看 Amex、Chase 和 Citi 的Offer。
- **智能解析**：使用智能拦截技术即时获取Offer，不会拖慢页面速度。
- **灵活的同步控制**：在全自动同步和通过页面小部件手动控制之间自由选择。
- **注重隐私**：在您的浏览器本地运行并由您来控制数据发送并存储到哪。

---

## 🏦 支持的银行

- ✅ American Express
- ✅ Chase
- ✅ Citi
- ➕ 更多银行即将推出

每家银行都作为独立的Provider实现，因此可以在不影响核心系统的情况下添加新银行。

---

## 🚀 安装（用户脚本）

要开始收集Offer信息，您需要通过`Tampermonkey`安装 **Offers Camp Collector** 脚本。

1. 安装 **[Tampermonkey](https://www.tampermonkey.net/)** 浏览器扩展（支持 Chrome、Firefox、Edge）。
2. 打开`Offers Camp`安装页面：[https://tm.offers.camp/](https://tm.offers.camp/)
3. 点击 **"Install Offers Camp Collector"**（安装 Offers Camp Collector）并在 Tampermonkey 中确认安装。
4. 访问您银行的Offer页面（例如 Amex Offers）以触发同步。

安装完成后，脚本会在支持的银行门户网站上的Offer页面自动运行。

---

## 📝 工作原理

1. Tampermonkey 脚本检测支持的银行的Offer页面。
2. 通过官方 API 提取Offer信息。
3. 所有Offer的数据都被统一标准化。
4. 数据安全地发送到后端。
5. 通过`Offers Camp`提供的前端平台，您可以：
    - 搜索从所有银行采集到的Offer
    - 按银行或卡片筛选Offer
    - 在移动端或桌面端查看Offer

## 发送模式和配置

Offers Camp 支持自动和手动发送，可根据用户需求配置以适应您的工作流程。

### 🔄 自动发送

当启用**自动发送**时：

* **自动触发**：Offer会在以下情况后自动发送到后端：
    * 页面刷新
    * 切换信用卡
    * Offer列表重新加载
* **零摩擦**：无需用户交互。
* **最适合**：希望 Offers Camp *"在后台自动运行"* 并快速同步所有卡片而无需操心的用户。

### 👆 手动发送

手动控制始终可通过页面弹出小部件使用。

#### **立即发送**
* 仅发送从**当前卡片**收集的Offer。

#### **全部发送**
* 发送当前银行网站上显示的所有卡片的**所有Offer**。

**在以下情况下很有用：**
* 您希望完全控制数据传输的时间。
* 您正在测试或调试收集器。
* 您更喜欢批量上传而不是实时同步。

---

### 🎛 银行设置

从 Offers Camp 设置面板，您可以完全自定义收集器的行为：

#### 银行启用管理
* **单独切换**：启用或禁用特定银行：
    * Amex
    * Chase
    * Citi

#### 后端连接
* **本地后端**：如果您出于隐私目希望使用自架平台，请使用此选项。
* **云端后端**（默认）：同步到`Offers Camp`所提供的公共云端平台。 (需要注册一个免费账户)

> **注意**：银行设置存储在本地 Tampermonkey 设置中，并对所有银行生效。

## 🛠 自托管/本地开发

参见 [SELF-HOSTING.MD](SELF-HOSTING.MD)

## ⚖️ 许可证

根据 MIT 许可证分发。更多信息请参见 `LICENSE` 文件。

## ⚠️ 免责声明

Offers Camp 是一个开源工具，与 American Express、Chase、Citi 或任何其他金融机构无关联、未获背书或关联。请负责任地使用，并遵守您银行的服务条款。