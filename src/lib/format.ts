export function formatBytes(bytes: number | null | undefined) {
  if (!bytes || bytes <= 0) {
    return '未知'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) {
    return '未知'
  }

  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`
}

export function formatRatio(value: number | null | undefined) {
  if (!value || value <= 0) {
    return '未知'
  }

  return `${Math.round((1 - value) * 100)}%`
}

export function formatSpeed(speed: number | null | undefined) {
  if (!speed || !Number.isFinite(speed)) {
    return '计算中'
  }

  return `${speed.toFixed(2)}x`
}

export function formatPercent(value: number) {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`
}
