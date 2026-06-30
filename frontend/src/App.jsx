import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import SearchPage from './pages/SearchPage'
import CVPage from './pages/CVPage'
import MatchPage from './pages/MatchPage'
import OptimizePage from './pages/OptimizePage'
import { TerminalWindow, Sun, Moon, List, X } from '@phosphor-icons/react'

function Navigation({ cvId }) {
  const location = useLocation()
  const isActive = (path) => location.pathname === path
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile nav on route change
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  useEffect(() => {
    closeMobile()
  }, [location.pathname, closeMobile])

  return (
    <nav
      className="bg-card border-b border-border transition-all duration-200"
      aria-label="Main navigation"
    >
      <div className="max-w-6xl mx-auto px-4">
        {/* Mobile hamburger */}
        <div className="flex items-center justify-between h-11 md:hidden">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Navigation
          </span>
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="p-1.5 rounded-lg hover:bg-muted transition-all duration-200"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
          </button>
        </div>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6 h-11">
          {[
            ['/', 'Search Jobs', null],
            ['/cv', 'Upload CV', null],
            ['/match', 'Match Jobs', cvId],
            ['/optimize', 'Optimize CV', null],
          ].map(([path, label, indicator]) => (
            <Link
              key={path}
              to={path}
              aria-current={isActive(path) ? 'page' : undefined}
              className={`text-small font-medium transition-all duration-200 ${
                isActive(path) ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {indicator && (
                <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-secondary-500 inline-block align-middle" />
              )}
            </Link>
          ))}
        </div>
        {/* Mobile dropdown */}
        {mobileOpen && (
          <div className="md:hidden pb-3 space-y-1 border-t border-border pt-2">
            {[
              ['/', 'Search Jobs', null],
              ['/cv', 'Upload CV', null],
              ['/match', 'Match Jobs', cvId],
              ['/optimize', 'Optimize CV', null],
            ].map(([path, label, indicator]) => (
              <Link
                key={path}
                to={path}
                aria-current={isActive(path) ? 'page' : undefined}
                className={`block px-3 py-2 rounded-lg text-small font-medium transition-all duration-200 ${
                  isActive(path)
                    ? 'text-foreground bg-muted'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {label}
                {indicator && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-secondary-500 inline-block align-middle" />
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted text-foreground transition-all"
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
    </button>
  )
}

function App() {
  // Load CV data from localStorage on mount
  const [cvId, setCvId] = useState(() => {
    const saved = localStorage.getItem('cvId')
    return saved || null
  })
  const [cvInfo, setCvInfo] = useState(() => {
    const saved = localStorage.getItem('cvInfo')
    return saved ? JSON.parse(saved) : null
  })

  // Save CV data to localStorage whenever it changes
  useEffect(() => {
    if (cvId) {
      localStorage.setItem('cvId', cvId)
    } else {
      localStorage.removeItem('cvId')
    }
  }, [cvId])

  useEffect(() => {
    if (cvInfo) {
      localStorage.setItem('cvInfo', JSON.stringify(cvInfo))
    } else {
      localStorage.removeItem('cvInfo')
    }
  }, [cvInfo])

  const handleCVUpload = (id, info) => {
    setCvId(id)
    setCvInfo(info)
  }

  return (
    <Router>
      <Toaster position="top-right" richColors closeButton />
      <div className="min-h-screen bg-background text-foreground transition-all duration-200 antialiased">
        {/* Header */}
        <nav className="bg-card border-b border-border sticky top-0 z-50 transition-all duration-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-2 font-bold tracking-tight text-foreground text-small"
            >
              <TerminalWindow size={18} weight="bold" className="text-primary-600" />
              JOBMATCH<span className="text-muted-foreground/60">.ID</span>
            </Link>

            <div className="flex items-center gap-6">
              <ThemeToggle />
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary-500" /> API Connected
              </span>
            </div>
          </div>
        </nav>

        {/* Sub Navigation */}
        <Navigation cvId={cvId} />

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/cv" element={<CVPage onUpload={handleCVUpload} cvInfo={cvInfo} />} />
            <Route path="/match" element={<MatchPage cvId={cvId} cvInfo={cvInfo} />} />
            <Route path="/optimize" element={<OptimizePage />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
