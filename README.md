# Buddy Watch

Buddy Watch 是一个浏览器本地视频压缩工具。它基于 Vite、React、TypeScript、shadcn/ui 和 Mediabunny 构建，使用 WebCodecs 在本机浏览器内完成视频解码、转码和 MP4 封装，不需要把视频上传到服务器。

## 功能

- 本地选择 MP4/MOV 视频文件并读取容器、视频轨、音频轨和时长信息
- 自动检测当前浏览器的 WebCodecs、VideoDecoder、VideoEncoder、WebGPU 和 H.264 编码能力
- 提供高、中、低、自定义四种质量档位
- 支持 4K、1080p、720p、480p 和自定义分辨率
- 支持 60fps、30fps、24fps 和自定义帧率
- 支持自定义视频码率和音频码率
- 在 Web Worker 中执行转码，展示进度、速度、已处理时长和预计剩余时间
- 输出 H.264 + AAC 的 MP4 文件，并展示输出大小、压缩率和处理耗时
- 支持取消任务，并在离开页面或切换文件时提示正在运行的任务会中断

## 浏览器要求

推荐使用最新版桌面 Chrome 或 Edge。

压缩能力取决于浏览器和系统是否支持对应的 WebCodecs 解码/编码路径。应用会在页面内显示能力检测结果：

- `A`：具备视频解码、编码和 WebGPU 能力
- `B`：具备视频解码和编码能力
- `C`：能力有限，可能只能解码或走降级路径
- `D`：缺少本地压缩所需能力，通常无法执行压缩

当前输出编码固定为 H.264 MP4。若浏览器无法编码 1080p60，会建议回退到 1080p30；若 H.264 编码不可用，需要更换浏览器或降低输出参数后重试。

## 输入与输出

输入建议：

- 容器：MP4 或 MOV
- 视频轨：H.264 或 HEVC
- 音频轨：AAC

输出固定为：

- 容器：MP4
- 视频：H.264
- 音频：AAC
- 文件名：`原文件名-1080p-帧率fps.mp4`

注意事项：

- HDR 素材可以被检测到，但输出色彩可能不符合预期
- HEVC、HDR、部分 MOV 或非常规音频轨是否可用取决于浏览器解码能力
- 大文件和高分辨率素材会占用较多内存，失败时可尝试降低分辨率、帧率或码率
- 所有处理都发生在当前浏览器内；刷新、关闭页面或终止 Worker 后任务无法恢复

## 快速开始

本项目使用 Bun 管理依赖和脚本。

```bash
bun install
bun run dev
```

启动后打开终端输出的本地地址，通常是：

```text
http://localhost:5173
```

## 常用命令

```bash
# 启动开发服务器
bun run dev

# 类型检查
bun run typecheck

# 代码检查
bun run lint

# 生产构建
bun run build

# 预览生产构建
bun run preview
```

## 项目结构

```text
src/
  App.tsx                    主界面、参数配置、任务流程和下载入口
  hooks/
    useVideoJob.ts           管理转码 Worker、进度、结果和错误状态
    usePreventJobNavigation.ts
                               任务运行期间的离开/切换确认
  lib/
    capabilities.ts          浏览器能力检测
    mediaProbe.ts            输入媒体元信息读取
    presets.ts               输出预设、体积估算和错误映射
    format.ts                展示格式化工具
  workers/
    video-job-worker.ts      Mediabunny 转码任务
  types/
    media.ts                 媒体、能力检测和任务类型定义
  components/ui/             shadcn/ui 基础组件
```

## 技术实现

转码流程由 `src/workers/video-job-worker.ts` 执行：

1. 使用 Mediabunny `Input` 和 `BlobSource` 读取用户选择的视频文件
2. 使用 `Conversion.init` 选择主视频/音频轨
3. 将视频强制转码为 H.264，并按页面配置设置分辨率、帧率、码率和关键帧间隔
4. 将音频输出为 AAC，必要时强制转码
5. 使用 `Mp4OutputFormat` 和 `BufferTarget` 生成 MP4 Blob
6. 主线程生成对象 URL，提供浏览器下载

能力检测由 `src/lib/capabilities.ts` 完成，主要检查：

- `VideoFrame`
- `VideoDecoder`
- `VideoEncoder`
- `navigator.gpu`
- Mediabunny 对 H.264 1080p60 / 1080p30 的编码支持

## 开发说明

- UI 使用 React 19、Tailwind CSS 4、shadcn/ui 和 lucide-react
- 路径别名 `@/` 指向 `src/`
- 代码检查使用 `oxlint`
- 构建流程会先执行 TypeScript project references 检查，再运行 Vite 构建
- 项目是纯前端应用，目前没有服务端上传、账号、任务队列或云端存储逻辑
