import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { ToastProvider } from '@/components/ui/Toast'
import { queryClient } from '@/lib/queryClient'
import './index.css'

const radice = document.getElementById('root')
if (!radice) throw new Error('Manca #root in index.html')

createRoot(radice).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* AuthProvider sta dentro QueryClientProvider: al logout svuota la cache. */}
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
