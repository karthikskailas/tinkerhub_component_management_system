import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // A small non-zero default (react-query's own default is 0, i.e.
      // "always stale") avoids a background refetch on every remount for
      // the many list/detail views that don't set their own staleTime.
      // Individual hooks that need fresher or longer-lived data (e.g.
      // useCatalog's 5 min, or Issue/Returns' explicit focus-refetch) still
      // override this.
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
