'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export function ClearSessionButton() {
  const router = useRouter();

  const handleClearSession = async () => {
    // Clear all cookies
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
      document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=' + window.location.hostname;
    }

    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Sign out from NextAuth
    await signOut({ redirect: false });

    // Redirect to login
    router.push('/login');
    router.refresh();
  };

  return (
    <button
      onClick={handleClearSession}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        marginLeft: '0.5rem',
      }}
      aria-label="Effacer la session"
      title="Effacer les cookies et la session"
    >
      <Trash2 size={16} />
      Effacer Session
    </button>
  );
}
