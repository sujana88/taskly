import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { logOut, useSession } from './auth'
import { useCurrentUser } from './useCurrentUser'

/** Shows children only to a signed-in user; others go to the login page and come back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const userId = useSession((s) => s.userId)
  const user = useCurrentUser()
  const location = useLocation()

  // The stored session points at an account that no longer exists.
  useEffect(() => {
    if (userId && user === null) logOut()
  }, [userId, user])

  if (!userId) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!user) return null
  return children
}
