import { isAuthEnabled, isAuthenticated } from './auth'
import { isPrivateModeEnabled } from './privateAccess'

export function isLocalTrialMode() {
  return Boolean(isAuthEnabled() && !isAuthenticated() && !isPrivateModeEnabled())
}

export function storageMode() {
  return isLocalTrialMode() ? 'local' : 'cloud'
}
