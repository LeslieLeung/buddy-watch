import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import i18n from '@/i18n'
import type {
  FailureInfo,
  JobProgress,
  JobResult,
  JobStage,
  OutputConfig,
  VideoMetadata,
  WorkerRequest,
  WorkerResponse,
} from '@/types/media'

const STAGE_MESSAGE_KEYS: Record<JobStage, string> = {
  idle: 'job.waitingVideo',
  probing: 'job.stageProbing',
  ready: 'job.waitingVideo',
  starting: 'job.starting',
  decoding: 'job.stageDecoding',
  encoding: 'job.stageEncoding',
  muxing: 'job.stageMuxing',
  completed: 'job.completed',
  failed: 'job.defaultFailed',
  canceled: 'job.cancelled',
}

function messageForStage(stage: JobStage): string {
  return i18n.t(STAGE_MESSAGE_KEYS[stage] ?? 'job.waitingVideo')
}

const idleProgress: JobProgress = {
  stage: 'idle',
  progress: 0,
  processedSeconds: 0,
  speed: null,
  etaSeconds: null,
  message: messageForStage('idle'),
}

export function useVideoJob() {
  const workerRef = useRef<Worker | null>(null)
  const [progress, setProgress] = useState<JobProgress>(idleProgress)
  const [result, setResult] = useState<JobResult | null>(null)
  const [failure, setFailure] = useState<FailureInfo | null>(null)
  const [running, setRunning] = useState(false)

  const cleanupWorker = useCallback(() => {
    workerRef.current?.terminate()
    workerRef.current = null
  }, [])

  const start = useCallback(
    (file: File, metadata: VideoMetadata, config: OutputConfig) => {
      cleanupWorker()
      setResult(null)
      setFailure(null)
      setRunning(true)
      setProgress({
        stage: 'starting',
        progress: 0,
        processedSeconds: 0,
        speed: null,
        etaSeconds: null,
        message: messageForStage('starting'),
      })

      const worker = new Worker(new URL('../workers/video-job-worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data

        if (message.type === 'progress') {
          setProgress({ ...message.progress, message: messageForStage(message.progress.stage) })
          return
        }

        if (message.type === 'complete') {
          setResult(message.result)
          setProgress({
            stage: 'completed',
            progress: 1,
            processedSeconds: metadata.duration ?? 0,
            speed: null,
            etaSeconds: 0,
            message: messageForStage('completed'),
          })
          setRunning(false)
          cleanupWorker()
          toast.success(i18n.t('job.completedToast'))
          return
        }

        if (message.type === 'failed') {
          setFailure(message.failure)
          setProgress({
            stage: 'failed',
            progress: 0,
            processedSeconds: 0,
            speed: null,
            etaSeconds: null,
            message: message.failure.title,
          })
          setRunning(false)
          cleanupWorker()
          toast.error(message.failure.title)
          return
        }

        setProgress({
          stage: 'canceled',
          progress: 0,
          processedSeconds: 0,
          speed: null,
          etaSeconds: null,
          message: messageForStage('canceled'),
        })
        setRunning(false)
        cleanupWorker()
      }

      worker.onerror = (event) => {
        const nextFailure = {
          title: i18n.t('job.workerFailed'),
          message: event.message,
          suggestion: i18n.t('job.workerFailedSuggestion'),
        }
        setFailure(nextFailure)
        setRunning(false)
        cleanupWorker()
      }

      const request: WorkerRequest = {
        type: 'start',
        file,
        metadata,
        config,
      }
      worker.postMessage(request)
    },
    [cleanupWorker],
  )

  const cancel = useCallback(() => {
    const request: WorkerRequest = { type: 'cancel' }
    workerRef.current?.postMessage(request)
    cleanupWorker()
    setRunning(false)
    setProgress({
      stage: 'canceled',
      progress: 0,
      processedSeconds: 0,
      speed: null,
      etaSeconds: null,
      message: messageForStage('canceled'),
    })
  }, [cleanupWorker])

  useEffect(() => cleanupWorker, [cleanupWorker])

  return {
    progress,
    result,
    failure,
    running,
    start,
    cancel,
    resetResult: () => setResult(null),
  }
}
