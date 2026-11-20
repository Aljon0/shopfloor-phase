import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { getSettingsData } from '../services/settings-service'

export function useSettingsData() {
  return useQuery({ queryKey: ['settings'], queryFn: getSettingsData })
}

/** Names of products, lines, machines and defect types appear all over the app, so everything refreshes. */
const AFFECTED = ['settings', 'orders', 'reports', 'downtime', 'quality', 'dashboard', 'analytics', 'reports-summary']

/** Runs a settings service call as the signed-in user, then refreshes what depends on configuration. */
export function useSettingsAction<TVars>(run: (vars: TVars, actor: string) => Promise<unknown>) {
  const actor = useAuth().user?.name ?? 'Unknown user'
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVars) => run(vars, actor),
    onSuccess: () => Promise.all(AFFECTED.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))),
  })
}
