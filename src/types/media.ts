export type PresetId = 'upload' | 'small' | 'quality' | 'custom'

export type JobStage =
  | 'idle'
  | 'probing'
  | 'ready'
  | 'starting'
  | 'decoding'
  | 'encoding'
  | 'muxing'
  | 'completed'
  | 'failed'
  | 'canceled'

export type CapabilityLevel = 'A' | 'B' | 'C' | 'D'

export type OutputConfig = {
  presetId: PresetId
  width: number
  height: number
  frameRate: number
  videoBitrateMbps: number
  audioBitrateKbps: number
  codec: 'avc'
  hardwareAcceleration: boolean
}

export type VideoMetadata = {
  fileName: string
  fileSize: number
  mimeType: string
  container: string
  duration: number | null
  video: {
    codec: string | null
    codecString: string | null
    width: number
    height: number
    codedWidth: number
    codedHeight: number
    frameRate: number | null
    rotation: number
    hdr: boolean
    canDecode: boolean
  } | null
  audio: {
    codec: string | null
    codecString: string | null
    channels: number
    sampleRate: number
    canDecode: boolean
  } | null
}

export type CapabilityReport = {
  level: CapabilityLevel
  webCodecs: boolean
  videoDecoder: boolean
  videoEncoder: boolean
  webGpu: boolean
  workerWebGpu: boolean
  h264Encode1080p60: boolean
  h264Encode1080p30: boolean
  recommendedConfig: OutputConfig
  warnings: string[]
}

export type JobProgress = {
  stage: JobStage
  progress: number
  processedSeconds: number
  speed: number | null
  etaSeconds: number | null
  message?: string
}

export type JobResult = {
  blob: Blob
  fileName: string
  size: number
  durationSeconds: number
  config: OutputConfig
  compressionRatio: number | null
}

export type FailureInfo = {
  title: string
  message: string
  suggestion: string
}

export type WorkerRequest =
  | {
      type: 'start'
      file: File
      metadata: VideoMetadata
      config: OutputConfig
    }
  | { type: 'cancel' }

export type WorkerResponse =
  | { type: 'progress'; progress: JobProgress }
  | { type: 'complete'; result: JobResult }
  | { type: 'failed'; failure: FailureInfo }
  | { type: 'canceled' }
