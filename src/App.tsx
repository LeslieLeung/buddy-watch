import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClapperboardIcon,
  ClockIcon,
  CpuIcon,
  DownloadIcon,
  FileVideoIcon,
  GaugeIcon,
  HardDriveIcon,
  InfoIcon,
  Loader2Icon,
  MonitorIcon,
  MoonIcon,
  PackageIcon,
  PencilIcon,
  PlayIcon,
  Rotate3dIcon,
  RotateCcwIcon,
  ScalingIcon,
  SignalIcon,
  SparklesIcon,
  SquareIcon,
  SunIcon,
  UploadCloudIcon,
  Volume2Icon,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { Toaster } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatBytes, formatDuration, formatPercent, formatRatio, formatSpeed } from '@/lib/format'
import { probeCapabilities } from '@/lib/capabilities'
import { probeMediaFile } from '@/lib/mediaProbe'
import { clonePreset, estimateOutputBytes } from '@/lib/presets'
import { useVideoJob } from '@/hooks/useVideoJob'
import { usePreventJobNavigation } from '@/hooks/usePreventJobNavigation'
import type { CapabilityReport, OutputConfig, PresetId, VideoMetadata } from '@/types/media'

type ResolutionOption = {
  label: string
  description: string
  width: number
  height: number
}

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { label: '4K', description: '3840×2160', width: 3840, height: 2160 },
  { label: '1080p', description: '1920×1080', width: 1920, height: 1080 },
  { label: '720p', description: '1280×720', width: 1280, height: 720 },
  { label: '480p', description: '854×480', width: 854, height: 480 },
]

const FRAME_RATE_OPTIONS = [60, 30, 24]

const QUALITY_PRESETS: {
  id: PresetId
  label: string
  description: string
  audioBitrateKbps: number
  baseVideoBitrateMbps: number
}[] = [
  { id: 'quality', label: '高', description: '画质优先', audioBitrateKbps: 192, baseVideoBitrateMbps: 7 },
  { id: 'upload', label: '中', description: '体积均衡', audioBitrateKbps: 160, baseVideoBitrateMbps: 5 },
  { id: 'small', label: '低', description: '更小体积', audioBitrateKbps: 128, baseVideoBitrateMbps: 3 },
  { id: 'custom', label: '自定义', description: '手动设置码率', audioBitrateKbps: 160, baseVideoBitrateMbps: 5 },
]

const PRESET_DESCRIPTION: Record<PresetId, string> = {
  quality: '高预设会提高视频和音频码率，更适合运动画面或二次编辑素材。',
  upload: '中预设在画质和体积之间取平衡，适合常规上传和分享。',
  small: '低预设会优先压低体积，适合聊天发送或快速预览。',
  custom: '自定义预设可手动设置视频码率和音频码率；分辨率与帧率可在各自分组中单独自定义。',
}

function recommendVideoBitrateMbps(input: {
  presetId: PresetId
  width: number
  height: number
  frameRate: number
  fallback: number
}) {
  const preset = QUALITY_PRESETS.find((item) => item.id === input.presetId)
  if (!preset || input.presetId === 'custom') {
    return input.fallback
  }

  const pixelScale = (input.width * input.height) / (1920 * 1080)
  const frameScale = input.frameRate / 30
  const scaled = preset.baseVideoBitrateMbps * pixelScale * frameScale

  return Math.round(Math.min(80, Math.max(1, scaled)) * 2) / 2
}

function presetPreviewLabel(presetId: PresetId, config: OutputConfig) {
  if (presetId === 'custom') {
    return null
  }

  const mbps = recommendVideoBitrateMbps({
    presetId,
    width: config.width,
    height: config.height,
    frameRate: config.frameRate,
    fallback: config.videoBitrateMbps,
  })

  return `约 ${mbps} Mbps`
}

function choiceButtonClass(active: boolean) {
  return `relative flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active
      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
      : 'border-border bg-background hover:border-primary/40 hover:bg-muted/50'
  }`
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2 transition-colors hover:bg-muted/60">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  )
}

function MetaStatRow({
  icon: Icon,
  label,
  value,
  placeholder,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  placeholder?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-background/70">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground ring-1 ring-border">
        <Icon className="size-3" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] leading-none text-muted-foreground">{label}</span>
        <span
          className={`truncate text-xs font-medium leading-tight ${placeholder ? 'animate-pulse text-muted-foreground/50' : ''}`}
        >
          {value}
        </span>
      </div>
    </div>
  )
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const nextValue = Number(event.currentTarget.value)
            if (Number.isFinite(nextValue)) {
              onChange(Math.min(max, Math.max(min, nextValue)))
            }
          }}
          className={suffix ? 'pr-14' : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function CapabilityBadge({ label, ok }: { label: string; ok: boolean | null }) {
  if (ok === null) {
    return (
      <div className="flex animate-pulse items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <div className="size-3 rounded-full bg-muted-foreground/30" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
        ok
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40'
      }`}
    >
      {ok ? (
        <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertCircleIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span
        className={`text-xs font-medium ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}
      >
        {label}
      </span>
    </div>
  )
}

const METADATA_STAT_ICONS = [PackageIcon, ClockIcon, HardDriveIcon, MonitorIcon, Volume2Icon, Rotate3dIcon]
const METADATA_STAT_LABELS = ['容器', '时长', '源大小', '视频', '音频', '旋转/HDR']

function metadataStats(metadata: VideoMetadata) {
  const resolution = metadata.video ? `${metadata.video.width}×${metadata.video.height}` : '无视频轨'
  const codec = metadata.video?.codecString ?? metadata.video?.codec ?? '未知'
  const audio = metadata.audio
    ? `${metadata.audio.codecString ?? metadata.audio.codec ?? '未知'} / ${metadata.audio.channels}ch / ${metadata.audio.sampleRate}Hz`
    : '无音频'

  const values = [
    metadata.container,
    formatDuration(metadata.duration),
    formatBytes(metadata.fileSize),
    `${resolution} / ${codec}`,
    audio,
    `${metadata.video?.rotation ?? 0}° / ${metadata.video?.hdr ? 'HDR' : 'SDR'}`,
  ]

  return METADATA_STAT_LABELS.map((label, index) => ({
    icon: METADATA_STAT_ICONS[index],
    label,
    value: values[index],
  }))
}

function CapabilityStatusButton({
  capabilities,
  capabilityProbing,
  hardwareAccelerationSupported,
  hardwareAccelerationDescription,
}: {
  capabilities: CapabilityReport | null
  capabilityProbing: boolean
  hardwareAccelerationSupported: boolean
  hardwareAccelerationDescription: string
}) {
  const isLoading = capabilityProbing || !capabilities
  const buttonColorClass = isLoading
    ? ''
    : hardwareAccelerationSupported
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60'
      : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950/60'

  const allChecks = capabilities
    ? [
        capabilities.webCodecs,
        capabilities.videoDecoder,
        capabilities.videoEncoder,
        capabilities.webGpu,
        capabilities.h264Encode1080p60,
        capabilities.h264Encode1080p30,
      ]
    : []
  const passCount = allChecks.filter(Boolean).length
  const totalCount = allChecks.length
  const bannerClass =
    !capabilities || isLoading
      ? 'bg-muted/30 text-muted-foreground'
      : hardwareAccelerationSupported
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
  const bannerText =
    !capabilities || isLoading
      ? '正在检测浏览器能力…'
      : hardwareAccelerationSupported
        ? `完整支持 · ${passCount}/${totalCount} 项通过`
        : `部分支持 · ${passCount}/${totalCount} 项通过`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" className={`h-10 gap-2 px-3 transition-colors ${buttonColorClass}`}>
          {isLoading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <CpuIcon data-icon="inline-start" />
          )}
          <span>硬件加速</span>
          {!isLoading && (
            <Badge
              variant="outline"
              className={
                hardwareAccelerationSupported
                  ? 'border-emerald-300 bg-emerald-100 px-1.5 py-0 text-xs text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'border-amber-300 bg-amber-100 px-1.5 py-0 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }
            >
              {hardwareAccelerationSupported ? '支持' : '不支持'}
            </Badge>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="end"
        hideArrow
        sideOffset={8}
        className="w-[min(24rem,calc(100vw-2rem))] max-w-none flex-col items-stretch gap-0 overflow-hidden border border-border bg-popover p-0 text-left text-popover-foreground shadow-md"
      >
        {/* Banner */}
        <div className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${bannerClass}`}>
          {isLoading ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : hardwareAccelerationSupported ? (
            <CheckCircle2Icon className="size-4" />
          ) : (
            <AlertCircleIcon className="size-4" />
          )}
          {bannerText}
        </div>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">能力检测</span>
              <span className="text-xs opacity-60">
                {capabilityProbing ? '检测中' : capabilities ? '已检测' : '待检测'}
              </span>
            </div>
            <span className="text-xs leading-5 opacity-70">{hardwareAccelerationDescription}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CapabilityBadge label="WebCodecs" ok={capabilities ? capabilities.webCodecs : null} />
            <CapabilityBadge label="VideoDecoder" ok={capabilities ? capabilities.videoDecoder : null} />
            <CapabilityBadge label="VideoEncoder" ok={capabilities ? capabilities.videoEncoder : null} />
            <CapabilityBadge label="WebGPU" ok={capabilities ? capabilities.webGpu : null} />
            <CapabilityBadge label="H.264 60fps" ok={capabilities ? capabilities.h264Encode1080p60 : null} />
            <CapabilityBadge label="H.264 30fps" ok={capabilities ? capabilities.h264Encode1080p30 : null} />
          </div>
          {capabilities?.warnings.length ? (
            <div className="flex flex-col gap-1.5 border-t pt-3">
              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertCircleIcon className="size-3.5" />
                兼容性提示
              </span>
              {capabilities.warnings.map((warning) => (
                <span key={warning} className="text-xs leading-5 text-amber-600/80 dark:text-amber-400/80">
                  {warning}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-center text-xs opacity-40">点击任意处关闭</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button variant="outline" size="icon" className="size-10 shrink-0" aria-label="切换主题" />
  }

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-10 shrink-0"
      aria-label="切换主题"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  )
}

type StepId = 'select' | 'config' | 'compress' | 'download'

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
}: {
  steps: { id: StepId; label: string }[]
  currentStep: StepId
  completedSteps: Set<StepId>
}) {
  return (
    <nav className="hidden items-center gap-0 md:flex" aria-label="流程步骤">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id)
        const isCurrent = step.id === currentStep
        const isFirst = index === 0

        return (
          <div key={step.id} className="flex items-center">
            {!isFirst && (
              <div
                className={`h-px w-8 transition-colors duration-300 lg:w-12 ${isCompleted ? 'bg-primary' : 'bg-border'}`}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={`flex size-6 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300 ${
                  isCompleted
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isCurrent
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted-foreground/30 bg-background text-muted-foreground/50'
                }`}
              >
                {isCompleted ? <CheckCircle2Icon className="size-3.5" /> : index + 1}
              </div>
              <span
                className={`hidden text-sm font-medium transition-colors duration-300 lg:block ${
                  isCompleted
                    ? 'text-foreground'
                    : isCurrent
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </nav>
  )
}

const STEPS: { id: StepId; label: string }[] = [
  { id: 'select', label: '选择文件' },
  { id: 'config', label: '配置参数' },
  { id: 'compress', label: '开始压缩' },
  { id: 'download', label: '下载结果' },
]

type ConfirmationDialogState = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
}

const RUNNING_TASK_CONFIRMATION: ConfirmationDialogState = {
  title: '当前任务正在进行中',
  description: '离开、后退或切换文件会中断正在进行的压缩任务。确认继续后，当前任务将无法恢复。',
  confirmLabel: '继续并中断任务',
  cancelLabel: '留在当前任务',
  destructive: true,
}

const COMPLETED_TASK_CONFIRMATION: ConfirmationDialogState = {
  title: '已有完成的压缩结果',
  description: '开始新任务会清除当前输出结果和下载入口。请确认已经下载或不再需要这个结果。',
  confirmLabel: '开始新任务',
  cancelLabel: '保留结果',
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [capabilities, setCapabilities] = useState<CapabilityReport | null>(null)
  const [config, setConfig] = useState<OutputConfig>(() => clonePreset('upload'))
  const [capabilityProbing, setCapabilityProbing] = useState(true)
  const [probing, setProbing] = useState(false)
  const [probeError, setProbeError] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [customResolutionOpen, setCustomResolutionOpen] = useState(false)
  const [customFrameRateOpen, setCustomFrameRateOpen] = useState(false)
  const [confirmationDialog, setConfirmationDialog] = useState<ConfirmationDialogState | null>(null)
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(null)
  const { progress, result, failure, running, start, cancel, resetResult } = useVideoJob()

  const closeConfirmationDialog = useCallback((confirmed: boolean) => {
    confirmationResolverRef.current?.(confirmed)
    confirmationResolverRef.current = null
    setConfirmationDialog(null)
  }, [])

  const requestConfirmation = useCallback((dialog: ConfirmationDialogState) => {
    confirmationResolverRef.current?.(false)

    return new Promise<boolean>((resolve) => {
      confirmationResolverRef.current = resolve
      setConfirmationDialog(dialog)
    })
  }, [])

  const requestRunningTaskConfirmation = useCallback(
    () => requestConfirmation(RUNNING_TASK_CONFIRMATION),
    [requestConfirmation],
  )
  const confirmJobNavigation = usePreventJobNavigation(running, requestRunningTaskConfirmation)

  useEffect(() => {
    return () => {
      confirmationResolverRef.current?.(false)
    }
  }, [])

  const estimatedOutput = useMemo(
    () => estimateOutputBytes(config, metadata?.duration ?? null),
    [config, metadata?.duration],
  )

  const downloadUrl = useMemo(() => {
    if (!result) {
      return null
    }

    return URL.createObjectURL(result.blob)
  }, [result])

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }, [downloadUrl])

  useEffect(() => {
    let active = true

    async function probeBrowser() {
      setCapabilityProbing(true)

      try {
        const nextCapabilities = await probeCapabilities()
        if (!active) {
          return
        }
        setCapabilities(nextCapabilities)
        setConfig(nextCapabilities.recommendedConfig)
      } catch (error) {
        if (active) {
          setProbeError(error instanceof Error ? error.message : String(error))
        }
      } finally {
        if (active) {
          setCapabilityProbing(false)
        }
      }
    }

    void probeBrowser()

    return () => {
      active = false
    }
  }, [])

  const handleFile = useCallback(async (nextFile: File) => {
    setFile(nextFile)
    setMetadata(null)
    setProbeError(null)
    resetResult()
    setProbing(true)

    try {
      const nextMetadata = await probeMediaFile(nextFile)
      const nextCapabilities = await probeCapabilities(nextMetadata)
      setMetadata(nextMetadata)
      setCapabilities(nextCapabilities)
      setConfig(nextCapabilities.recommendedConfig)
    } catch (error) {
      setProbeError(error instanceof Error ? error.message : String(error))
    } finally {
      setProbing(false)
    }
  }, [resetResult])

  const confirmNewTask = useCallback(async () => {
    if (running) {
      return confirmJobNavigation()
    }

    if (result) {
      return requestConfirmation(COMPLETED_TASK_CONFIRMATION)
    }

    return true
  }, [confirmJobNavigation, requestConfirmation, result, running])

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0]
    const input = event.currentTarget

    if (nextFile) {
      void confirmNewTask().then((confirmed) => {
        if (!confirmed) {
          input.value = ''
          return
        }

        void handleFile(nextFile)
      })
    }
  }

  const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDraggingOver(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDraggingOver(false)
    const nextFile = event.dataTransfer.files?.[0]

    if (nextFile) {
      void confirmNewTask().then((confirmed) => {
        if (confirmed) {
          void handleFile(nextFile)
        }
      })
    }
  }

  const selectResolution = (resolution: ResolutionOption) => {
    setCustomResolutionOpen(false)
    setConfig((current) => {
      const next = {
        ...current,
        width: resolution.width,
        height: resolution.height,
      }

      return {
        ...next,
        videoBitrateMbps: recommendVideoBitrateMbps({
          presetId: next.presetId,
          width: next.width,
          height: next.height,
          frameRate: next.frameRate,
          fallback: next.videoBitrateMbps,
        }),
      }
    })
  }

  const selectFrameRate = (frameRate: number) => {
    setCustomFrameRateOpen(false)
    setConfig((current) => {
      const next = {
        ...current,
        frameRate,
      }

      return {
        ...next,
        videoBitrateMbps: recommendVideoBitrateMbps({
          presetId: next.presetId,
          width: next.width,
          height: next.height,
          frameRate: next.frameRate,
          fallback: next.videoBitrateMbps,
        }),
      }
    })
  }

  const selectPreset = (presetId: PresetId) => {
    setConfig((current) => {
      if (presetId === 'custom') {
        return {
          ...current,
          presetId,
        }
      }

      const preset = QUALITY_PRESETS.find((item) => item.id === presetId)

      return {
        ...current,
        presetId,
        audioBitrateKbps: preset?.audioBitrateKbps ?? current.audioBitrateKbps,
        videoBitrateMbps: recommendVideoBitrateMbps({
          presetId,
          width: current.width,
          height: current.height,
          frameRate: current.frameRate,
          fallback: current.videoBitrateMbps,
        }),
      }
    })
  }

  const updateCustomConfig = (patch: Partial<OutputConfig>) => {
    setConfig((current) => ({
      ...current,
      ...patch,
      presetId: 'custom',
    }))
  }

  const handleStart = () => {
    if (!file || !metadata) {
      return
    }

    void confirmNewTask().then((confirmed) => {
      if (confirmed) {
        start(file, metadata, config)
      }
    })
  }

  const canStart = Boolean(file && metadata?.video && capabilities?.videoDecoder && capabilities?.videoEncoder)
  const resolutionMatchesOption = RESOLUTION_OPTIONS.some(
    (option) => option.width === config.width && option.height === config.height,
  )
  const showCustomResolution = customResolutionOpen || !resolutionMatchesOption
  const frameRateMatchesOption = FRAME_RATE_OPTIONS.includes(config.frameRate)
  const showCustomFrameRate = customFrameRateOpen || !frameRateMatchesOption
  const hardwareAccelerationSupported = Boolean(
    capabilities?.webCodecs &&
      capabilities.videoDecoder &&
      capabilities.videoEncoder &&
      (capabilities.h264Encode1080p60 || capabilities.h264Encode1080p30),
  )
  const hardwareAccelerationDescription = capabilities
    ? hardwareAccelerationSupported
      ? '当前浏览器具备 WebCodecs 解码/编码与 H.264 输出能力，压缩时会请求硬件加速；实际是否调用硬件由浏览器和系统决定。通常速度更快、CPU 占用和耗电更低。'
      : '当前浏览器缺少本地压缩所需 API、输入解码能力或 H.264 编码能力，可能无法压缩，或只能走软件路径。通常速度更慢、CPU 占用和耗电更高。'
    : '正在检测当前浏览器的本地编解码能力。'

  // Step indicator logic
  const completedSteps = new Set<StepId>()
  let currentStep: StepId = 'select'
  if (file && metadata) {
    completedSteps.add('select')
    currentStep = 'config'
  }
  if (running || result) {
    completedSteps.add('select')
    completedSteps.add('config')
    currentStep = running ? 'compress' : 'download'
  }
  if (result) {
    completedSteps.add('compress')
  }

  const dropZoneClass = isDraggingOver
    ? 'border-primary bg-primary/5 border-solid'
    : file
      ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20'
      : 'border-dashed bg-muted/30 hover:bg-muted/50'

  return (
    <TooltipProvider>
      <main className="flex h-dvh flex-col overflow-hidden bg-background">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:px-6 lg:px-8">
          <header className="flex shrink-0 items-center justify-between gap-4 border-b pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <FileVideoIcon className="size-4" />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                视频本地压缩
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <StepIndicator steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} />
              <div className="hidden h-5 w-px bg-border sm:block" />
              <CapabilityStatusButton
                capabilities={capabilities}
                capabilityProbing={capabilityProbing}
                hardwareAccelerationSupported={hardwareAccelerationSupported}
                hardwareAccelerationDescription={hardwareAccelerationDescription}
              />
              <ThemeToggle />
            </div>
          </header>

          <section className="flex min-h-0 flex-1 flex-col gap-3">
            {probeError ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>文件解析失败</AlertTitle>
                <AlertDescription>{probeError}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 lg:grid-cols-2">
            <Card className="flex h-full min-h-0 flex-col pb-0">
              <CardHeader className="shrink-0 pb-0">
                <CardTitle className="flex items-center gap-2">
                  <FileVideoIcon data-icon="inline-start" />
                  输入视频
                </CardTitle>
                <CardDescription>支持 MP4 / MOV，源视频信息会在选择后自动读取。</CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-4">
                <label
                  htmlFor="video-file"
                  onDragOver={(event) => event.preventDefault()}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex min-h-48 flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border px-4 py-5 text-center transition-all duration-200 ${dropZoneClass}`}
                >
                  <div className={`transition-transform duration-200 ${isDraggingOver ? '-translate-y-1' : ''}`}>
                    {file && !isDraggingOver ? (
                      <CheckCircle2Icon className="size-10 text-emerald-500" />
                    ) : (
                      <UploadCloudIcon
                        className={`size-10 transition-colors duration-200 ${isDraggingOver ? 'text-primary' : 'text-muted-foreground'}`}
                      />
                    )}
                  </div>
                  <div className="flex max-w-full flex-col gap-1">
                    <span className="break-all text-base font-medium">
                      {isDraggingOver
                        ? '松开以选择文件'
                        : file
                          ? file.name
                          : '拖入视频，或点击选择文件'}
                    </span>
                    {(isDraggingOver || file) && (
                      <span className="text-sm text-muted-foreground">
                        {isDraggingOver
                          ? '支持 MP4 / MOV 格式'
                          : file
                            ? formatBytes(file.size)
                            : null}
                      </span>
                    )}
                  </div>
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/mp4,video/quicktime,.mp4,.mov"
                    className="sr-only"
                    onChange={handleInputChange}
                  />
                </label>

                <div className="flex shrink-0 flex-col rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="mb-1 flex shrink-0 items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium">源视频信息</span>
                      <span className="text-[11px] leading-tight text-muted-foreground">
                        {probing ? '正在读取容器、轨道和浏览器能力。' : '选择视频后显示容器、轨道和编码信息。'}
                      </span>
                    </div>
                    {probing ? (
                      <Badge variant="outline" className="h-6 shrink-0 gap-1.5 px-2 text-[11px]">
                        <Loader2Icon className="size-3 animate-spin" />
                        读取中
                      </Badge>
                    ) : null}
                  </div>
                  <div className="grid content-start gap-x-2 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-3">
                    {metadata
                      ? metadataStats(metadata).map((stat) => <MetaStatRow key={stat.label} {...stat} />)
                      : METADATA_STAT_LABELS.map((label, index) => (
                          <MetaStatRow
                            key={label}
                            icon={METADATA_STAT_ICONS[index]}
                            label={label}
                            value={probing ? '读取中…' : '待选择'}
                            placeholder
                          />
                        ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className={`flex min-h-0 h-full transition-opacity duration-300 ${running ? 'pointer-events-none opacity-50' : ''}`}>
              <Card className="flex h-full w-full min-h-0 flex-col pb-0">
                <CardHeader className="shrink-0 pb-0">
                  <CardTitle>输出参数</CardTitle>
                  <CardDescription>先选画质预设，再按需微调分辨率、帧率和码率。</CardDescription>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-4">
                  {/* 画质预设 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <SparklesIcon className="size-3.5 text-muted-foreground" />
                      <Label className="text-sm font-medium">画质预设</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {QUALITY_PRESETS.map((preset) => {
                        const active = config.presetId === preset.id
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => selectPreset(preset.id)}
                            className={choiceButtonClass(active)}
                          >
                            <span className="flex w-full items-center justify-between gap-1">
                              <span className="text-sm font-semibold">{preset.label}</span>
                              {active && <CheckIcon className="size-3.5 shrink-0" />}
                            </span>
                            <span className={`text-xs ${active ? 'opacity-75' : 'text-muted-foreground'}`}>
                              {preset.description}
                            </span>
                            {presetPreviewLabel(preset.id, config) ? (
                              <span
                                className={`text-[11px] tabular-nums ${active ? 'opacity-60' : 'text-muted-foreground/70'}`}
                              >
                                {presetPreviewLabel(preset.id, config)}
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{PRESET_DESCRIPTION[config.presetId]}</p>
                  </div>

                  {/* 分辨率 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ScalingIcon className="size-3.5 text-muted-foreground" />
                        <Label className="text-sm font-medium">分辨率</Label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomResolutionOpen((open) => !open)}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                          showCustomResolution ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <PencilIcon className="size-3" />
                        自定义
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {RESOLUTION_OPTIONS.map((resolution) => {
                        const active = config.width === resolution.width && config.height === resolution.height
                        const sourceMatch = metadata?.video
                          ? metadata.video.width <= resolution.width && metadata.video.height <= resolution.height
                          : false

                        return (
                          <button
                            key={resolution.label}
                            type="button"
                            onClick={() => selectResolution(resolution)}
                            className={choiceButtonClass(active)}
                          >
                            <span className="flex w-full items-center justify-between gap-1">
                              <span className="text-sm font-semibold">{resolution.label}</span>
                              {active && <CheckIcon className="size-3.5 shrink-0" />}
                            </span>
                            <span className={`text-xs ${active ? 'opacity-75' : 'text-muted-foreground'}`}>
                              {resolution.description}
                            </span>
                            {sourceMatch && !active && metadata?.video && (
                              <span className="mt-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">源尺寸</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {showCustomResolution ? (
                      <div className="grid gap-3 rounded-lg border bg-muted/25 p-3 sm:grid-cols-2">
                        <NumberField
                          id="output-width"
                          label="宽度"
                          value={config.width}
                          min={320}
                          max={3840}
                          step={2}
                          suffix="px"
                          onChange={(value) => updateCustomConfig({ width: value })}
                        />
                        <NumberField
                          id="output-height"
                          label="高度"
                          value={config.height}
                          min={180}
                          max={2160}
                          step={2}
                          suffix="px"
                          onChange={(value) => updateCustomConfig({ height: value })}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* 帧率 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ClapperboardIcon className="size-3.5 text-muted-foreground" />
                        <Label className="text-sm font-medium">帧率</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        {metadata?.video?.frameRate && (
                          <span className="text-xs text-muted-foreground">源 {metadata.video.frameRate} fps</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCustomFrameRateOpen((open) => !open)}
                          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium transition-colors ${
                            showCustomFrameRate ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <PencilIcon className="size-3" />
                          自定义
                        </button>
                      </div>
                    </div>
                    <div className="flex rounded-lg border bg-muted/30 p-1 gap-1">
                      {FRAME_RATE_OPTIONS.map((frameRate) => {
                        const active = config.frameRate === frameRate
                        return (
                          <button
                            key={frameRate}
                            type="button"
                            onClick={() => selectFrameRate(frameRate)}
                            className={`flex flex-1 items-center justify-center rounded-md py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              active
                                ? 'bg-background shadow-sm text-foreground ring-1 ring-border'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                            }`}
                          >
                            {frameRate} fps
                          </button>
                        )
                      })}
                    </div>
                    {showCustomFrameRate ? (
                      <div className="rounded-lg border bg-muted/25 p-3">
                        <NumberField
                          id="frame-rate"
                          label="自定义帧率"
                          value={config.frameRate}
                          min={1}
                          max={120}
                          suffix="fps"
                          onChange={(value) => updateCustomConfig({ frameRate: value })}
                        />
                      </div>
                    ) : null}
                  </div>

                  {/* 码率 */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-1.5">
                      <SignalIcon className="size-3.5 text-muted-foreground" />
                      <Label className="text-sm font-medium">码率</Label>
                    </div>
                    {config.presetId === 'custom' ? (
                      <div className="flex flex-col gap-4 rounded-lg border bg-muted/25 p-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="bitrate">视频码率</Label>
                            <span className="text-sm font-medium tabular-nums">{config.videoBitrateMbps} Mbps</span>
                          </div>
                          <Slider
                            id="bitrate"
                            value={[config.videoBitrateMbps]}
                            min={1}
                            max={80}
                            step={0.5}
                            onValueChange={([value]) => updateCustomConfig({ videoBitrateMbps: value })}
                          />
                          <Input
                            type="number"
                            min={1}
                            max={80}
                            step={0.5}
                            value={config.videoBitrateMbps}
                            onChange={(event) => {
                              const nextValue = Number(event.currentTarget.value)
                              if (Number.isFinite(nextValue)) {
                                updateCustomConfig({ videoBitrateMbps: Math.min(80, Math.max(1, nextValue)) })
                              }
                            }}
                          />
                        </div>
                        <NumberField
                          id="audio-bitrate"
                          label="音频码率"
                          value={config.audioBitrateKbps}
                          min={32}
                          max={512}
                          step={8}
                          suffix="kbps"
                          onChange={(value) => updateCustomConfig({ audioBitrateKbps: value })}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5">
                        <div className="flex flex-1 flex-col gap-0.5">
                          <span className="text-xs text-muted-foreground">视频</span>
                          <span className="text-sm font-medium tabular-nums">{config.videoBitrateMbps} Mbps</span>
                        </div>
                        <div className="h-8 w-px shrink-0 bg-border" />
                        <div className="flex flex-1 flex-col gap-0.5 text-right">
                          <span className="text-xs text-muted-foreground">音频</span>
                          <span className="text-sm font-medium tabular-nums">{config.audioBitrateKbps} kbps</span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex shrink-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{config.width}×{config.height}</span>
                    <span aria-hidden>·</span>
                    <span>{config.frameRate} fps</span>
                    <span aria-hidden>·</span>
                    <span>{config.videoBitrateMbps} Mbps</span>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] leading-none text-muted-foreground">预估大小</p>
                    <p className="text-base font-semibold leading-tight tabular-nums">{formatBytes(estimatedOutput)}</p>
                  </div>
                </CardFooter>
              </Card>
            </div>
            </div>

            <div className="grid shrink-0 gap-3">
            <Card size="sm" className={running ? 'ring-1 ring-primary/30' : ''}>
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2">
                  <GaugeIcon data-icon="inline-start" />
                  任务状态
                  {running && (
                    <span className="ml-1 flex items-center gap-1.5 text-sm font-normal text-muted-foreground">
                      <span className="size-2 animate-pulse rounded-full bg-primary" />
                      运行中
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{progress.message}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Progress
                  value={progress.progress * 100}
                  className={running ? 'animate-pulse' : ''}
                />
                <div className={`grid gap-2 sm:grid-cols-2 ${running ? 'lg:grid-cols-4' : ''}`}>
                  <StatItem label="进度" value={formatPercent(progress.progress)} />
                  {running ? (
                    <>
                      <StatItem label="速度" value={formatSpeed(progress.speed)} />
                      <StatItem label="已处理" value={formatDuration(progress.processedSeconds)} />
                      <StatItem label="预计剩余" value={formatDuration(progress.etaSeconds)} />
                    </>
                  ) : (
                    <StatItem label="已处理" value={formatDuration(progress.processedSeconds)} />
                  )}
                </div>
                {failure ? (
                  <Alert variant="destructive">
                    <AlertCircleIcon />
                    <AlertTitle>{failure.title}</AlertTitle>
                    <AlertDescription className="flex flex-col gap-1">
                      <span>{failure.message}</span>
                      <span>{failure.suggestion}</span>
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
              <CardFooter className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full sm:flex-1"
                  disabled={!canStart || running}
                  onClick={handleStart}
                >
                  {running ? (
                    <Loader2Icon data-icon="inline-start" className="animate-spin" />
                  ) : (
                    <PlayIcon data-icon="inline-start" />
                  )}
                  {running ? '压缩中…' : '开始压缩'}
                </Button>
                {result ? (
                  <>
                    <Button asChild className="w-full sm:w-auto" variant="secondary">
                      <a href={downloadUrl ?? undefined} download={result.fileName}>
                        <DownloadIcon data-icon="inline-start" />
                        下载 MP4
                      </a>
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="w-full sm:size-9 sm:p-0"
                          variant="outline"
                          aria-label="查看输出信息"
                        >
                          <InfoIcon className="size-4" />
                          <span className="sm:hidden">输出信息</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="end"
                        hideArrow
                        sideOffset={8}
                        className="w-[min(20rem,calc(100vw-2rem))] max-w-none flex-col items-stretch gap-0 overflow-hidden border border-border bg-popover p-0 text-left text-popover-foreground shadow-md"
                      >
                        <div className="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2.5 text-sm font-medium">
                          <PackageIcon className="size-4" />
                          导出结果
                        </div>
                        <div className="flex flex-col gap-3 p-3.5">
                          <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-md border">
                            <div className="flex min-w-0 flex-col items-center gap-1 px-2 py-2.5">
                              <span className="flex items-center gap-1 text-[11px] leading-none text-muted-foreground">
                                <HardDriveIcon className="size-3" />
                                大小
                              </span>
                              <span className="max-w-full truncate text-sm font-semibold">
                                {formatBytes(result.size)}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-col items-center gap-1 px-2 py-2.5">
                              <span className="flex items-center gap-1 text-[11px] leading-none text-muted-foreground">
                                <GaugeIcon className="size-3" />
                                压缩率
                              </span>
                              <span className="max-w-full truncate text-sm font-semibold">
                                {formatRatio(result.compressionRatio)}
                              </span>
                            </div>
                            <div className="flex min-w-0 flex-col items-center gap-1 px-2 py-2.5">
                              <span className="flex items-center gap-1 text-[11px] leading-none text-muted-foreground">
                                <ClockIcon className="size-3" />
                                耗时
                              </span>
                              <span className="max-w-full truncate text-sm font-semibold">
                                {formatDuration(result.durationSeconds)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                            <ScalingIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            <div className="flex min-w-0 flex-col">
                              <span className="text-[11px] leading-none text-muted-foreground">输出参数</span>
                              <span className="mt-1 truncate text-sm font-medium">
                                {result.config.width}×{result.config.height} · {result.config.frameRate}fps ·{' '}
                                {result.config.videoBitrateMbps}Mbps
                              </span>
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                    <Button className="w-full sm:w-auto" variant="outline" onClick={resetResult}>
                      <RotateCcwIcon data-icon="inline-start" />
                      清除
                    </Button>
                  </>
                ) : null}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button className="w-full sm:w-auto" variant="outline" disabled={!running} onClick={cancel}>
                      <SquareIcon data-icon="inline-start" />
                      取消
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>停止当前 Worker 任务</TooltipContent>
                </Tooltip>
              </CardFooter>
            </Card>
            </div>
          </section>
        </div>
      </main>
      <AlertDialog
        open={Boolean(confirmationDialog)}
        onOpenChange={(open) => {
          if (!open) {
            closeConfirmationDialog(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmationDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeConfirmationDialog(false)}>
              {confirmationDialog?.cancelLabel ?? '取消'}
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmationDialog?.destructive
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40'
                  : undefined
              }
              onClick={() => closeConfirmationDialog(true)}
            >
              {confirmationDialog?.confirmLabel ?? '确认'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}

export default App
