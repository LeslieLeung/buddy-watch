import { useTranslation } from 'react-i18next'
import { GlobeIcon } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'

function supportedLanguage(lang: string) {
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <Select value={supportedLanguage(i18n.language)} onValueChange={i18n.changeLanguage}>
      <SelectTrigger className="size-10! shrink-0 justify-center rounded-lg border border-input bg-transparent p-0 hover:bg-muted/50 dark:hover:bg-input/50 [&>svg:last-child]:hidden [&_[data-slot=select-value]]:sr-only">
        <GlobeIcon className="size-4 shrink-0" />
      </SelectTrigger>
      <SelectContent position="popper" align="end" sideOffset={8}>
        <SelectItem value="zh-CN">中文</SelectItem>
        <SelectItem value="en-US">English</SelectItem>
      </SelectContent>
    </Select>
  )
}
