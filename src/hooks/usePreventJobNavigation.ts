import { useCallback, useEffect, useRef } from 'react'

import i18n from '@/i18n'

const JOB_GUARD_STATE_KEY = '__buddyWatchVideoJobGuard'

type NavigationConfirmation = () => boolean | Promise<boolean>

export function usePreventJobNavigation(active: boolean, confirmNavigation?: NavigationConfirmation) {
  const allowingBackRef = useRef(false)
  const guardPushedRef = useRef(false)

  const requestConfirmation = useCallback(async () => {
    if (!active) {
      return true
    }

    if (confirmNavigation) {
      return confirmNavigation()
    }

    return window.confirm(i18n.t('navigation.leaveWarning'))
  }, [active, confirmNavigation])

  useEffect(() => {
    if (!active) {
      return
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [active])

  useEffect(() => {
    if (!active) {
      guardPushedRef.current = false
      return
    }

    const pushGuardState = () => {
      const currentState =
        typeof window.history.state === 'object' && window.history.state !== null ? window.history.state : {}

      if (currentState[JOB_GUARD_STATE_KEY]) {
        guardPushedRef.current = true
        return
      }

      window.history.pushState(
        {
          ...currentState,
          [JOB_GUARD_STATE_KEY]: true,
        },
        '',
        window.location.href,
      )
      guardPushedRef.current = true
    }

    if (!guardPushedRef.current) {
      pushGuardState()
    }

    const handlePopState = () => {
      if (allowingBackRef.current) {
        return
      }

      void requestConfirmation().then((confirmed) => {
        if (confirmed) {
          allowingBackRef.current = true
          window.setTimeout(() => window.history.back(), 0)
          return
        }

        pushGuardState()
      })
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      allowingBackRef.current = false
      window.removeEventListener('popstate', handlePopState)
    }
  }, [active, requestConfirmation])

  return requestConfirmation
}
