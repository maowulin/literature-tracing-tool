# Trae 项目规则与上下文

目标：帮助 Trae 快速理解并执行本仓库的开发任务，保持一致的工程风格与高效协作。

## 项目概览

- 类型：Next.js 14 文献溯源工具（TypeScript + shadcn/ui）
- 功能：按句拆分输入文本，检索并展示相关学术文献信息（两组接口结果，当前为模拟数据）

## 技术栈

- Framework：Next.js 14（App Router）
- Styling：Tailwind CSS v4，CSS 变量主题
- UI：Radix UI + 自定义 shadcn/ui 组件
- 字体：Geist Sans / Geist Mono
- 状态：React hooks（useState）
- 图标：Lucide React
- 分析：Vercel Analytics

## 目录结构

- app/
  - layout.tsx：根布局（字体、Analytics 注入）
  - page.tsx：首页，挂载 LiteratureTracer
  - globals.css：全局样式与 Tailwind 引入
- components/
  - literature-tracer.tsx：核心业务组件
  - theme-provider.tsx：主题切换
  - ui/：shadcn/ui 组件库（button、card、input 等）
- lib/utils.ts：工具函数（cn 合并类名）
- hooks/：use-mobile、use-toast
- public/：静态资源
- 配置：next.config.mjs、postcss.config.mjs、tsconfig.json、package.json

## 常用命令

- 开发：pnpm run dev
- 构建：pnpm run build
- 生产：pnpm run start
- Lint：pnpm run lint

## 关键组件与职责

- LiteratureTracer（components/literature-tracer.tsx）
  - 处理文本输入与句子切分（中英文标点）
  - 模拟检索与延迟（约 1.5s）
  - 按句展示两组结果、复制标题/DOI/摘要/引用等
- UI 组件：基于 Radix 封装的 shadcn/ui，统一“new-york”风格

## 核心数据类型（TypeScript）

```ts
interface Literature {
  id: number
  title: string
  authors: string[]
  journal: string
  year: number
  doi: string
  verified: boolean
  supportingPages?: number
  abstract?: string
  impactFactor?: number
  citationCount?: number
}

interface SentenceResult {
  sentence: string
  sentenceIndex: number
  literature: Literature[]
}
```

## 配置要点

- TypeScript：严格模式、路径别名 `@/*`
- Next.js：开发阶段忽略 TS/ESLint 构建错误（提升迭代效率）
- Tailwind：CSS 变量驱动主题，结合 shadcn/ui 风格
- PostCSS：Tailwind 插件

## 开发约定

- 语言：对用户输出用中文，代码注释与日志使用英文
- 类型：禁止使用 `any` 类型
- 样式：保持 shadcn/ui 语义与 Tailwind 原子化一致
- UI 改动：变更需本地预览并自查视觉一致性
- 安全：不提交任何密钥/令牌，敏感信息使用环境变量

## 任务指引（给 Trae）

- 优先遵循现有组件/工具函数，复用已存在模式与命名
- 涉及 UI 的改动，完成后启动本地预览检查
- 新功能尽量拆分为独立组件或模块，保持可维护性
- 若需创建接口或服务，先定义明确的类型与数据流
- 修改文件时遵循最小变更原则，并保证可立即运行
