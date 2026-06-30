import {
  ALL_FORMATS,
  BlobSource,
  Input,
  UnsupportedInputFormatError,
  type InputAudioTrack,
  type InputVideoTrack,
} from 'mediabunny'

import type { VideoMetadata } from '@/types/media'

async function readVideoTrack(track: InputVideoTrack) {
  const [codec, codecString, width, height, codedWidth, codedHeight, rotation, hdr, canDecode] =
    await Promise.all([
      track.getCodec(),
      track.getCodecParameterString(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.getCodedWidth(),
      track.getCodedHeight(),
      track.getRotation(),
      track.hasHighDynamicRange(),
      track.canDecode(),
    ])

  return {
    codec,
    codecString,
    width,
    height,
    codedWidth,
    codedHeight,
    frameRate: null,
    rotation,
    hdr,
    canDecode,
  }
}

async function readAudioTrack(track: InputAudioTrack) {
  const [codec, codecString, channels, sampleRate, canDecode] = await Promise.all([
    track.getCodec(),
    track.getCodecParameterString(),
    track.getNumberOfChannels(),
    track.getSampleRate(),
    track.canDecode(),
  ])

  return {
    codec,
    codecString,
    channels,
    sampleRate,
    canDecode,
  }
}

export async function probeMediaFile(file: File): Promise<VideoMetadata> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  })

  try {
    const canRead = await input.canRead()
    if (!canRead) {
      throw new UnsupportedInputFormatError('Mediabunny could not read this media container.')
    }

    const [format, durationFromMetadata, videoTrack, audioTrack] = await Promise.all([
      input.getFormat(),
      input.getDurationFromMetadata(),
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
    ])

    const duration = durationFromMetadata ?? (await input.computeDuration())

    return {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || format.mimeType,
      container: format.name,
      duration,
      video: videoTrack ? await readVideoTrack(videoTrack) : null,
      audio: audioTrack ? await readAudioTrack(audioTrack) : null,
    }
  } finally {
    input.dispose()
  }
}
