import { useEffect, useState } from 'react'
import { accountInitials, accountPhotoUrl } from '../lib/account'
import type { AccountUser } from '../lib/account'

/**
 * Keeps every account surface in step with Firebase's authenticated profile.
 * A failed or unsuitable remote image always falls back to the user's initials.
 */
export function AccountAvatar({ user, className = '', decorative = true }: { user: AccountUser | null; className?: string; decorative?: boolean }) {
  const photoUrl = accountPhotoUrl(user)
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => { setImageFailed(false) }, [photoUrl])

  return <span className={`account-avatar ${className}`} aria-hidden={decorative || undefined}>
    {photoUrl && !imageFailed
      ? <img src={photoUrl} alt="" referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />
      : accountInitials(user)}
  </span>
}
