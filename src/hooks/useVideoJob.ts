import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import type {
  FailureInfo,
  JobProgress,
  JobResult,
  OutputConfig,
  VideoMetadata,
  WorkerRequest,
  WorkerResponse,
} from '@/types/media'

const idleProgress: JobProgress = {
  stage: 'idle',
  progress: 0,
  processedSeconds: 0,
  speed: null,
  etaSeconds: null,
  message: '等待选择视频',
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
        message: '正在启动压缩 Worker',
      })

      const worker = new Worker(new URL('../workers/video-job-worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data

        if (message.type === 'progress') {
          setProgress(message.progress)
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
            message: '压缩完成',
          })
          setRunning(false)
          cleanupWorker()
          toast.success('压缩完成，可以下载输出文件')
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
          message: '任务已取消',
        })
        setRunning(false)
        cleanupWorker()
      }

      worker.onerror = (event) => {
        const nextFailure = {
          title: 'Worker 运行失败',
          message: event.message,
          suggestion: '请刷新页面后重试，或使用最新版桌面 Chrome/Edge。',
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
      message: '任务已取消',
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
