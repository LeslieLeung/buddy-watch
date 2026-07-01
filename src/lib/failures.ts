import type { WorkerFailure } from '@/types/media'

export function mapErrorToFailure(error: unknown): WorkerFailure {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (lower.includes('canceled') || lower.includes('cancelled')) {
    return {
      titleKey: 'job.cancelled',
      message,
      suggestionKey: 'job.cancelledSuggestion',
    }
  }

  if (lower.includes('unsupported') || lower.includes('format')) {
    return {
      titleKey: 'job.unsupportedFormat',
      message,
      suggestionKey: 'job.unsupportedSuggestion',
    }
  }

  if (lower.includes('encode') || lower.includes('encodable')) {
    return {
      titleKey: 'job.encodeFailed',
      message,
      suggestionKey: 'job.encodeSuggestion',
    }
  }

  if (lower.includes('decode') || lower.includes('decodable')) {
    return {
      titleKey: 'job.decodeFailed',
      message,
      suggestionKey: 'job.decodeSuggestion',
    }
  }

  if (lower.includes('memory') || lower.includes('quota')) {
    return {
      titleKey: 'job.memoryError',
      message,
      suggestionKey: 'job.memorySuggestion',
    }
  }

  return {
    titleKey: 'job.defaultFailed',
    message,
    suggestionKey: 'job.defaultSuggestion',
  }
}
