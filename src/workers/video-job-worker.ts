import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  Conversion,
  ConversionCanceledError,
  Input,
  Mp4OutputFormat,
  Output,
  type ConversionVideoOptions,
} from 'mediabunny'

import { mapErrorToFailure } from '@/lib/presets'
import type { JobProgress, WorkerRequest, WorkerResponse } from '@/types/media'

let activeConversion: Conversion | null = null
let canceled = false

function post(message: WorkerResponse) {
  self.postMessage(message)
}

function progress(update: JobProgress) {
  post({ type: 'progress', progress: update })
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data

  if (request.type === 'cancel') {
    canceled = true
    await activeConversion?.cancel()
    post({ type: 'canceled' })
    return
  }

  canceled = false
  const startTime = performance.now()
  const { file, metadata, config } = request

  try {
    progress({
      stage: 'probing',
      progress: 0.02,
      processedSeconds: 0,
      speed: null,
      etaSeconds: null,
    })

    const input = new Input({
      source: new BlobSource(file),
      formats: ALL_FORMATS,
    })
    const target = new BufferTarget()
    const output = new Output({
      format: new Mp4OutputFormat(),
      target,
    })

    const videoOptions: ConversionVideoOptions = {
      width: config.width,
      height: config.height,
      fit: 'contain',
      frameRate: config.frameRate,
      codec: config.codec,
      bitrate: config.videoBitrateMbps * 1_000_000,
      keyFrameInterval: 2,
      hardwareAcceleration: 'prefer-hardware',
      forceTranscode: true,
      allowRotationMetadata: false,
    }

    activeConversion = await Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: videoOptions,
      audio: async (track) => {
        const codec = await track.getCodec()

        return {
          codec: 'aac',
          bitrate: config.audioBitrateKbps * 1_000,
          forceTranscode: codec !== 'aac',
        }
      },
      showWarnings: false,
    })

    if (!activeConversion.isValid) {
      const reasons = activeConversion.discardedTracks.map((track) => track.reason).join(', ')
      throw new Error(`Conversion is not valid: ${reasons || 'no compatible tracks'}`)
    }

    activeConversion.onProgress = (ratio, processedSeconds) => {
      if (canceled) {
        return
      }

      const elapsedSeconds = Math.max((performance.now() - startTime) / 1000, 0.1)
      const speed = processedSeconds > 0 ? processedSeconds / elapsedSeconds : null
      const remainingInput = metadata.duration ? Math.max(metadata.duration - processedSeconds, 0) : 0
      const etaSeconds = speed && speed > 0 ? remainingInput / speed : null
      const stage = ratio >= 0.98 ? 'muxing' : ratio > 0.08 ? 'encoding' : 'decoding'

      progress({
        stage,
        progress: Math.max(0.03, Math.min(0.98, ratio)),
        processedSeconds,
        speed,
        etaSeconds,
      })
    }

    await activeConversion.execute()

    if (canceled) {
      post({ type: 'canceled' })
      return
    }

    const buffer = target.buffer
    if (!buffer) {
      throw new Error('Mediabunny did not produce an output buffer.')
    }

    const outputName = file.name.replace(/\.[^.]+$/, '') || 'compressed-video'
    const blob = new Blob([buffer], { type: 'video/mp4' })

    post({
      type: 'complete',
      result: {
        blob,
        fileName: `${outputName}-1080p-${config.frameRate}fps.mp4`,
        size: blob.size,
        durationSeconds: (performance.now() - startTime) / 1000,
        config,
        compressionRatio: file.size > 0 ? blob.size / file.size : null,
      },
    })

    input.dispose()
  } catch (error) {
    if (error instanceof ConversionCanceledError || canceled) {
      post({ type: 'canceled' })
      return
    }

    post({
      type: 'failed',
      failure: mapErrorToFailure(error),
    })
  } finally {
    activeConversion = null
  }
}
