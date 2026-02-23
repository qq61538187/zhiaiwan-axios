# 贡献指南

感谢你对 @zhiaiwan/axios 的关注！以下是参与贡献的流程。

## 开发环境

```bash
# 确保 Node.js >= 20（推荐使用 nvm）
nvm use

# 安装依赖
pnpm install

# 开发模式（监听文件变化并重新构建）
pnpm run dev
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 监听模式构建 |
| `pnpm run build` | 生产构建 |
| `pnpm run test` | 交互式测试 |
| `pnpm run test:run` | 单次测试 |
| `pnpm run test:coverage` | 测试覆盖率 |
| `pnpm run lint` | 代码检查（只读） |
| `pnpm run fix` | 代码检查 + 自动修复 |
| `pnpm run typecheck` | TypeScript 类型检查 |

## 提交规范

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范，由 commitlint 自动校验。

常用前缀：

- `feat:` 新功能
- `fix:` Bug 修复
- `refactor:` 重构（不改变外部行为）
- `docs:` 文档变更
- `test:` 测试补充或修改
- `chore:` 构建、CI、依赖等杂项

示例：

```
feat: add request timeout configuration
fix: correct retry backoff calculation
docs: update cache usage examples
```

## 提交 PR 流程

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feat/my-feature`
3. 编写代码和测试
4. 确保通过所有检查：`pnpm run lint && pnpm run typecheck && pnpm run test:run`
5. 提交代码（commit message 需符合规范）
6. 推送并创建 Pull Request

## 项目结构

```
src/
├── core.ts          # ZhiAxios 主类
├── types.ts         # 所有类型定义
├── interceptors.ts  # 拦截器（cancel/auth/transform/errorHook）
├── retry.ts         # 自动重试
├── tracker.ts       # 请求跟踪
├── cancel.ts        # 去重取消管理
├── cache.ts         # 响应缓存
├── throttle.ts      # 并发限流
├── logger.ts        # 调试日志
├── errors.ts        # 错误分类
└── index.ts         # 入口导出
tests/               # 测试文件（与 src 同级）
├── core.test.ts
├── integration.test.ts
└── ...
examples/            # 使用示例（pnpm examples 运行）
├── server.js        # 根服务器（自动路由子目录）
├── basic/           # GET / POST 基础用法
├── auth-refresh/    # Token + 401 自动刷新
├── retry/           # 自动重试
├── cancel/          # 请求取消（去重/分组/ID）
├── cache/           # 响应缓存
├── upload/          # 文件上传 + 进度
├── error-handling/  # 错误分类 + onError 钩子
├── tracker/         # 请求队列 + loading + 慢请求
├── throttle/        # 并发限制
└── interceptors/    # 自定义拦截器
```
