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
    warnings.push('当前浏览器缺少 WebCodecs，无法执行本地压缩。')
  }

  if (!webGpu) {
    warnings.push('WebGPU 不可用，将使用 Mediabunny/WebCodecs 可行路径并标记为降级。')
  }

  if (metadata?.video?.hdr) {
    warnings.push('检测到 HDR 素材，输出色彩可能不符合预期。')
  }

  if (!h264Encode1080p60 && h264Encode1080p30) {
    warnings.push('1080p60 H.264 编码不可用，已建议回退到 1080p30。')
  }

  if (!h264Encode1080p60 && !h264Encode1080p30) {
    warnings.push('H.264 MP4 编码不可用，请使用最新版桌面 Chrome/Edge。')
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
