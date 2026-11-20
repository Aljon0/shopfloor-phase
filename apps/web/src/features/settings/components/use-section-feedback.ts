import { useState } from 'react'

/** One notice or error at a time for a settings section. */
export function useSectionFeedback() {
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  return {
    notice,
    error,
    success: (message: string) => {
      setError(undefined)
      setNotice(message)
    },
    fail: (e: unknown) => {
      setNotice(undefined)
      setError(e instanceof Error ? e.message : 'That did not work. Try again.')
    },
  }
}
