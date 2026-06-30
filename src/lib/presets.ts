import type { CapabilityLevel, FailureInfo, OutputConfig, PresetId } from '@/types/media'

export const OUTPUT_PRESETS: Record<PresetId, OutputConfig> = {
  upload: {
    presetId: 'upload',
    width: 1920,
    height: 1080,
    frameRate: 60,
    videoBitrateMbps: 10,
    audioBitrateKbps: 160,
    codec: 'avc',
    hardwareAcceleration: true,
  },
  small: {
    presetId: 'small',
    width: 1920,
    height: 1080,
    frameRate: 30,
    videoBitrateMbps: 6,
    audioBitrateKbps: 128,
    codec: 'avc',
    hardwareAcceleration: true,
  },
  quality: {
    presetId: 'quality',
    width: 1920,
    height: 1080,
    frameRate: 60,
    videoBitrateMbps: 14,
    audioBitrateKbps: 192,
    codec: 'avc',
    hardwareAcceleration: true,
  },
  custom: {
    presetId: 'custom',
    width: 1920,
    height: 1080,
    frameRate: 60,
    videoBitrateMbps: 10,
    audioBitrateKbps: 160,
    codec: 'avc',
    hardwareAcceleration: true,
  },
}

export const PRESET_LABELS: Record<PresetId, { name: string; description: string }> = {
  upload: {
    name: '上传推荐',
    description: '1080p60 H.264 10Mbps，适合运动画面和平台上传前压缩。',
  },
  small: {
    name: '更小体积',
    description: '1080p30 H.264 6Mbps，优先降低文件体积。',
  },
  quality: {
    name: '更高质量',
    description: '1080p60 H.264 14Mbps，保留更多运动细节。',
  },
  custom: {
    name: '自定义',
    description: '手动调整帧率和码率，仍以 H.264 MP4 为输出。',
  },
}

export function clonePreset(id: PresetId): OutputConfig {
  return { ...OUTPUT_PRESETS[id] }
}

export function estimateOutputBytes(config: OutputConfig, durationSeconds: number | null) {
  if (!durationSeconds || durationSeconds <= 0) {
    return null
  }

  const totalBitsPerSecond = config.videoBitrateMbps * 1_000_000 + config.audioBitrateKbps * 1_000
  return Math.round((totalBitsPerSecond * durationSeconds) / 8)
}

export function classifyCapabilities(input: {
  webCodecs: boolean
  videoDecoder: boolean
  videoEncoder: boolean
  webGpu: boolean
}): CapabilityLevel {
  if (input.videoDecoder && input.videoEncoder && input.webGpu) {
    return 'A'
  }

  if (input.videoDecoder && input.videoEncoder) {
    return 'B'
  }

  if (input.videoDecoder) {
    return 'C'
  }

  return input.webCodecs ? 'C' : 'D'
}

export function mapErrorToFailure(error: unknown): FailureInfo {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('canceled') || lower.includes('cancelled')) {
    return {
      title: '任务已取消',
      message: '当前压缩任务已经停止。',
      suggestion: '可以重新选择参数后再次开始。',
    }
  }

  if (lower.includes('unsupported') || lower.includes('format')) {
    return {
      title: '输入格式暂不支持',
      message,
      suggestion: '请优先使用 MP4/MOV，视频轨建议为 H.264 或 HEVC，音频建议为 AAC。',
    }
  }

  if (lower.includes('encode') || lower.includes('encodable')) {
    return {
      title: '当前浏览器无法编码目标视频',
      message,
      suggestion: '请使用最新版桌面 Chrome/Edge，或降到 1080p30 后重试。',
    }
  }

  if (lower.includes('decode') || lower.includes('decodable')) {
    return {
      title: '当前浏览器无法解码源视频',
      message,
      suggestion: '如果源文件是 HEVC/HDR/MOV，请先转成 SDR H.264 MP4 后再试。',
    }
  }

  if (lower.includes('memory') || lower.includes('quota')) {
    return {
      title: '处理时内存不足',
      message,
      suggestion: '请尝试更短素材、1080p30、更低码率，或关闭其他占用内存的标签页。',
    }
  }

  return {
    title: '压缩失败',
    message,
    suggestion: '请换用最新版桌面 Chrome/Edge，或选择更低帧率和码率后重试。',
  }
}
