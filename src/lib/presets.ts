import i18n from '@/i18n'
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

export function getPresetLabels(): Record<PresetId, { name: string; description: string }> {
  return {
    upload: {
      name: i18n.t('presets.upload.label'),
      description: i18n.t('presets.upload.detail'),
    },
    small: {
      name: i18n.t('presets.small.label'),
      description: i18n.t('presets.small.detail'),
    },
    quality: {
      name: i18n.t('presets.quality.label'),
      description: i18n.t('presets.quality.detail'),
    },
    custom: {
      name: i18n.t('presets.custom.label'),
      description: i18n.t('presets.custom.detail'),
    },
  }
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
      title: i18n.t('job.cancelled'),
      message: i18n.t('job.cancelledMessage'),
      suggestion: i18n.t('job.cancelledSuggestion'),
    }
  }

  if (lower.includes('unsupported') || lower.includes('format')) {
    return {
      title: i18n.t('job.unsupportedFormat'),
      message,
      suggestion: i18n.t('job.unsupportedSuggestion'),
    }
  }

  if (lower.includes('encode') || lower.includes('encodable')) {
    return {
      title: i18n.t('job.encodeFailed'),
      message,
      suggestion: i18n.t('job.encodeSuggestion'),
    }
  }

  if (lower.includes('decode') || lower.includes('decodable')) {
    return {
      title: i18n.t('job.decodeFailed'),
      message,
      suggestion: i18n.t('job.decodeSuggestion'),
    }
  }

  if (lower.includes('memory') || lower.includes('quota')) {
    return {
      title: i18n.t('job.memoryError'),
      message,
      suggestion: i18n.t('job.memorySuggestion'),
    }
  }

  return {
    title: i18n.t('job.defaultFailed'),
    message,
    suggestion: i18n.t('job.defaultSuggestion'),
  }
}
