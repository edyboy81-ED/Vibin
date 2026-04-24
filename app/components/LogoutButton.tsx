'use client'

export default function LogoutButton() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }
  return (
    <button onClick={handleLogout} className="text-sm text-indigo-200 hover:text-white transition-colors">
      Logout
    </button>
  )
}
