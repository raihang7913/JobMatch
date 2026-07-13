import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { searchJobs } from '../api/client'
import { MagnifyingGlass, MapPin, Buildings, Funnel } from '@phosphor-icons/react'
import { JobCardSkeletonList } from '../components/JobCardSkeleton'
import { EmptyState } from '../components/EmptyState'

function SearchPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [source, setSource] = useState('jobstreet')
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [jobs, setJobs] = useState([])
  const [stats, setStats] = useState(null)

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch((err) => console.error('Failed to fetch stats:', err))
  }, [])

  const handleSearch = async (e) => {
    e?.preventDefault()

    if (!query.trim()) {
      setError('Please enter a job search keyword')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await searchJobs(query.trim(), location.trim(), source, limit)
      setJobs(data.jobs)
      toast.success(`Found ${data.jobs.length} jobs`)
    } catch (err) {
      setError(err.message || 'Failed to search jobs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-h2 font-bold tracking-tight text-foreground">
          Find Your Next Career Move
        </h1>
        <p className="text-body text-muted-foreground leading-relaxed">
          Temukan dan filter lowongan kerja dari{' '}
          <span className="text-foreground font-semibold">Jobstreet Indonesia</span> dalam satu
          interface yang bersih.
        </p>
      </header>

      {/* Search Form */}
      <section className="bg-card border border-border shadow-sm rounded-lg overflow-hidden transition-all duration-200">
        <form className="p-5 space-y-4" onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <MagnifyingGlass
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
                weight="bold"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Job title, keywords, or technology stack"
                className="w-full pl-9 pr-3 py-2 bg-input border border-border text-foreground rounded-lg text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
              />
            </div>

            <div className="md:col-span-4 relative">
              <MapPin
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
                weight="bold"
              />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, state, or 'Remote'"
                className="w-full pl-9 pr-3 py-2 bg-input border border-border text-foreground rounded-lg text-sm focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="md:col-span-3 bg-primary text-primary-foreground font-medium text-sm py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Funnel size={12} weight="bold" />
              Execute Query
            </button>
          </div>

          <div className="pt-3 border-t border-border flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium transition-theme">
            <div className="flex items-center gap-2">
              <span>Data Source:</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="bg-card border border-border text-foreground rounded-md px-2 py-1 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 cursor-pointer font-semibold transition-theme"
              >
                <option value="jobstreet">Jobstreet Indonesia</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span>Batch Size Limit:</span>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                min="1"
                max="50"
                className="w-16 bg-card border border-border text-foreground rounded-md px-2 py-1 text-center font-semibold focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-lg text-xs flex items-center justify-between gap-3"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={handleSearch}
                className="whitespace-nowrap bg-destructive text-destructive-foreground font-medium px-3 py-1 rounded-md hover:opacity-90 active:scale-[0.98] transition-all text-xs shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-border bg-card rounded-lg p-6 shadow-sm transition-all duration-200 card-hover">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
            Active Index
          </span>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            {stats ? stats.total_jobs.toLocaleString() : '...'}{' '}
            <span className="text-xs text-secondary-600 dark:text-secondary-400 font-medium bg-secondary-50 dark:bg-secondary-950/30 border border-secondary-100 dark:border-secondary-900/30 px-2 py-1 rounded ml-2">
              +{stats ? stats.growth_percentage : '...'}%
            </span>
          </div>
        </div>

        <div className="border border-border bg-card rounded-lg p-6 shadow-sm transition-all duration-200 card-hover">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
            Monitored Platform
          </span>
          <div className="text-2xl font-bold text-foreground tracking-tight">
            Jobstreet{' '}
            <span className="text-xs text-muted-foreground font-mono block mt-1 font-normal">
              JOBSTREET_ID
            </span>
          </div>
        </div>

        <div className="border border-border bg-card rounded-lg p-6 shadow-sm transition-all duration-200 card-hover">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest block mb-2">
            Scraper Status
          </span>
          <div className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary-500 block" />
            <span className="text-base font-semibold">
              {stats
                ? stats.scraper_status.charAt(0).toUpperCase() + stats.scraper_status.slice(1)
                : 'Loading...'}
            </span>
          </div>
        </div>
      </section>

      {/* Results */}
      {jobs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Query Stream Results ({jobs.length})
            </h2>
            <span className="text-xs font-mono bg-muted text-muted-foreground border border-border px-2 py-1 rounded transition-all">
              FILTER_MATCH: SUCCESS
            </span>
          </div>

          <div className="space-y-3">
            {jobs.map((job, index) => {
              if (job.error) {
                return (
                  <div
                    key={index}
                    className="bg-card border border-destructive/20 rounded-lg p-5 shadow-sm"
                  >
                    <p className="text-small text-destructive font-medium">Error: {job.error}</p>
                  </div>
                )
              }

              return (
                <div
                  key={index}
                  className="bg-card border border-border hover:border-muted-foreground/30 shadow-sm transition-all duration-200 rounded-lg p-5 card-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="text-body font-bold text-foreground hover:text-primary transition-colors duration-200 cursor-pointer">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground font-medium mt-1">
                        <span className="text-foreground font-semibold flex items-center gap-1">
                          <Buildings size={14} />
                          {job.company}
                        </span>
                        {job.location && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={14} />
                              {job.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold tracking-wider bg-muted text-muted-foreground border border-border px-2 py-1 rounded uppercase">
                      {job.source}
                    </span>
                  </div>

                  {job.description && (
                    <p className="text-small text-muted-foreground leading-relaxed mb-4 max-w-4xl">
                      {job.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border text-small">
                    <span className="text-muted-foreground font-mono">
                      Posted: {job.posted_date || 'Date N/A'}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View source post for ${job.title}`}
                        className="border border-border text-foreground hover:bg-muted font-medium px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm hover:shadow-base"
                      >
                        Source Post ↗
                      </a>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Apply to ${job.title}`}
                        className="bg-primary text-primary-foreground font-medium px-4 py-1.5 rounded-lg hover:opacity-90 transition-all duration-200 shadow-sm hover:shadow-base"
                      >
                        Apply
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Loading State */}
      {loading && <JobCardSkeletonList count={4} />}

      {/* Welcome Empty State — no search yet */}
      {!loading && jobs.length === 0 && !query && (
        <>
          <EmptyState
            icon={MagnifyingGlass}
            title="Ready to Search"
            description="Enter a job title or technology to find opportunities across Jobstreet Indonesia."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {['React Developer', 'Python Backend', 'Full Stack Engineer', 'DevOps'].map(
                  (term) => (
                    <button
                      key={term}
                      onClick={() => setQuery(term)}
                      aria-label={`Search for ${term}`}
                      className="border border-border text-foreground hover:bg-muted active:scale-[0.98] font-medium px-3 py-1.5 rounded-md transition-all text-xs"
                    >
                      {term}
                    </button>
                  )
                )}
              </div>
            }
          />

          {/* Sample Jobs for first-time visitors */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2 transition-theme">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Featured Opportunities
              </h2>
              <span className="text-xs font-mono bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 px-2 py-0.5 rounded transition-theme">
                SAMPLE DATA
              </span>
            </div>
            <div className="space-y-3">
              {[
                {
                  title: 'Senior React Developer',
                  company: 'Tokopedia',
                  location: 'Jakarta, Hybrid',
                  description:
                    'Build scalable React applications with TypeScript, Next.js, and GraphQL. 3+ years experience required.',
                },
                {
                  title: 'Python Backend Engineer',
                  company: 'GoTo',
                  location: 'Remote',
                  description:
                    'Design and maintain high-traffic Python microservices. Experience with FastAPI, PostgreSQL, and Docker.',
                },
                {
                  title: 'Full Stack Developer',
                  company: 'Bukalapak',
                  location: 'Bandung',
                  description:
                    'End-to-end feature development using React and Node.js. Strong understanding of REST APIs and CI/CD.',
                },
              ].map((job, i) => (
                <div
                  key={i}
                  className="bg-card border border-border hover:border-muted-foreground/30 shadow-sm transition-all rounded-xl p-5 card-hover opacity-80"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium mt-1">
                        <span className="text-foreground font-semibold flex items-center gap-1">
                          <Buildings size={12} />
                          {job.company}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          {job.location}
                        </span>
                      </div>
                    </div>
                    <span className="self-start text-[10px] font-mono font-bold tracking-wider bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded uppercase">
                      SAMPLE
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                    {job.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 font-mono">
                    Search above to find real opportunities
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* Empty State — search returned nothing */}
      {!loading && jobs.length === 0 && query && (
        <EmptyState
          icon={MagnifyingGlass}
          title="No Results Found"
          description="Try adjusting your search criteria"
          actionLabel="Clear Filters"
          onAction={() => {
            setQuery('')
            setLocation('')
            setJobs([])
          }}
        />
      )}
    </div>
  )
}

export default SearchPage
