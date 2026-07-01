import i18n from '@/i18n'
import type { CapabilityLevel, OutputConfig, PresetId } from '@/types/media'

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
