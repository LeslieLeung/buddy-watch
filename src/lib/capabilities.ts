import { canEncodeVideo } from 'mediabunny'

import { classifyCapabilities, clonePreset } from '@/lib/presets'
import type { CapabilityReport, OutputConfig, VideoMetadata } from '@/types/media'

async function canEncodeAvc(config: OutputConfig) {
  if (typeof VideoEncoder === 'undefined') {
    return false
  }

  try {
    return await canEncodeVideo('avc', {
      width: config.width,
      height: config.height,
      bitrate: config.videoBitrateMbps * 1_000_000,
    })
  } catch {
    return false
  }
}

export async function probeCapabilities(metadata?: VideoMetadata): Promise<CapabilityReport> {
  const webCodecs = typeof VideoFrame !== 'undefined'
  const videoDecoder = typeof VideoDecoder !== 'undefined' && (metadata ? Boolean(metadata.video?.canDecode) : true)
  const videoEncoder = typeof VideoEncoder !== 'undefined'
  const webGpu = typeof navigator !== 'undefined' && 'gpu' in navigator
  const workerWebGpu = false
  const upload = clonePreset('upload')
  const small = clonePreset('small')
  const h264Encode1080p60 = await canEncodeAvc(upload)
  const h264Encode1080p30 = await canEncodeAvc(small)
  const warnings: string[] = []

  if (!webCodecs) {
    warnings.push('capability.webCodecsWarning')
  }

  if (!webGpu) {
    warnings.push('capability.webGpuWarning')
  }

  if (metadata?.video?.hdr) {
    warnings.push('capability.hdrWarning')
  }

  if (!h264Encode1080p60 && h264Encode1080p30) {
    warnings.push('capability.h264_1080p60_Warning')
  }

  if (!h264Encode1080p60 && !h264Encode1080p30) {
    warnings.push('capability.h264None')
  }

  const level = classifyCapabilities({
    webCodecs,
    videoDecoder,
    videoEncoder,
    webGpu,
  })

  return {
    level,
    webCodecs,
    videoDecoder,
    videoEncoder,
    webGpu,
    workerWebGpu,
    h264Encode1080p60,
    h264Encode1080p30,
    recommendedConfig: h264Encode1080p60 ? upload : small,
    warnings,
  }
}
