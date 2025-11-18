import { useMemo } from 'react'
import { useAuth } from './AuthContext'

// Hard-coded list of editor emails
const EDITOR_EMAILS = [
  "lucas@loxo.co",
  "ahughes@loxo.co",
  "bilal@loxo.co",
  "logan@loxo.co",
  "lyndsay@loxo.co",
  "anita@loxo.co",
]

/**
 * Very defensive email derivation - tries multiple paths to get email
 */
function deriveEmail(rawUser: any): string {
  const maybe =
    rawUser?.email ??
    rawUser?.primaryEmail ??
    rawUser?.profile?.email ??
    rawUser?.user?.email ??
    (typeof rawUser?.getBasicProfile === "function"
      ? rawUser.getBasicProfile().getEmail()
      : null)
  
  return (maybe || "").toLowerCase().trim()
}

/**
 * Permissions hook - fail open (if email is empty, grant full access)
 */
export function usePermissions() {
  const { userEmail } = useAuth()
  
  const { email, isEditor, isLoxoUser } = useMemo(() => {
    // userEmail is already a string from AuthContext, so we can use it directly
    // But use deriveEmail for defensive handling
    const rawUser = userEmail ? { email: userEmail } : null
    const email = deriveEmail(rawUser)
    
    // Fail open: if email is empty, grant full access
    const isEditor = email ? EDITOR_EMAILS.includes(email) : true
    const isLoxoUser = email ? (email.endsWith("@loxo.co") || isEditor) : true
    
    // Debug log
    console.log("[MH-Auth]", { rawUser, email: email || "(empty - fail open)", isEditor, isLoxoUser })
    
    return { email, isEditor, isLoxoUser }
  }, [userEmail])
  
  return { email, isEditor, isLoxoUser }
}

