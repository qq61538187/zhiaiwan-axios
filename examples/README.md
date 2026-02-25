# @zhiaiwan/axios examples

运行示例：

```bash
pnpm build
pnpm examples
```

然后打开 [http://localhost:3000](http://localhost:3000)

> 所有示例页面统一使用中文文案。

## 示例列表

| 示例 | 功能 |
|---|---|
| [basic](./basic/) | CRUD 全方法（GET/POST/PUT/PATCH/DELETE）+ `request(config)` + params、headers、responseTransform |
| [interceptors](./interceptors/) | 自定义请求 / 响应拦截器（含 `onRequest`/`onResponse` 动态注册与移除） |
| [auth-refresh](./auth-refresh/) | Token 注入 + 401 自动刷新 |
| [retry](./retry/) | 请求失败自动重试（指数退避） |
| [cancel](./cancel/) | 请求取消（单个、分组、全部 + 重复去重 + `cancel.key` 策略） |
| [cache](./cache/) | GET 响应缓存（TTL、`cacheKey`、`cache:false`、`invalidateCache`、手动清除） |
| [throttle](./throttle/) | 并发限流，可视化队列 |
| [tracker](./tracker/) | 请求队列追踪、loading 状态 |
| [upload](./upload/) | 文件上传（FormData / Object 自动转换 + 进度条） |
| [download](./download/) | 文件下载（Blob + 进度条 + 自动保存） |
| [loading](./loading/) | Loading 状态监听（Element Plus 全屏/局部 Loading + 并发追踪） |
| [error-handling](./error-handling/) | 全局 onError 钩子、错误类型分类、降级数据 |
| [classify-error](./classify-error/) | `classifyError` + `ZhiAxiosError` 显式分类与排查 |
| [debug](./debug/) | Debug 日志输出（请求/响应/耗时） |
| [slow-request](./slow-request/) | 慢请求检测（slowThreshold + onSlowRequest + Toast 提示） |
| [per-request-override](./per-request-override/) | 单请求覆盖全局配置（successCode / retry / responseTransform） |
| [multi-instance](./multi-instance/) | 多实例隔离（业务 API vs 第三方 API，独立配置互不影响） |
| [combo](./combo/) | 真实项目完整配置（auth + retry + cache + cancel + throttle + loading + error + debug + `destroy()`） |

## API 场景覆盖映射

| API/能力 | 覆盖示例 |
|---|---|
| `createAxios` / `version` | 全部示例均通过 `createAxios` 创建实例 |
| `get/post/put/patch/delete` | [basic](./basic/) |
| `request(config)` | [basic](./basic/) |
| `upload` / `download` | [upload](./upload/) / [download](./download/) |
| `onRequest` / `onResponse`（动态） | [interceptors](./interceptors/) |
| `cancelById` / `cancelGroup` / `cancelAll` | [cancel](./cancel/) |
| `clearCache` / `invalidateCache` | [cache](./cache/) |
| `cancel.key` | [cancel](./cancel/) |
| per-request `cache` / `cacheKey` | [cache](./cache/) |
| per-request `successCode` / `retry` / `responseTransform` | [per-request-override](./per-request-override/) |
| `destroy()` | [combo](./combo/) |
| 错误分类 `ErrorType` / `classifyError` / `ZhiAxiosError` | [error-handling](./error-handling/) / [classify-error](./classify-error/) |
