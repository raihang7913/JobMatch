import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { matchJobs } from '../api/client'
import { MagnifyingGlass, MapPin, Buildings, Sparkle, Target } from '@phosphor-icons/react'
import { JobCardSkeletonList } from '../components/JobCardSkeleton'
import { EmptyState } from '../components/EmptyState'

function MatchPage({ cvId, cvInfo }) {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [source, setSource] = useState('jobstreet')
  const [limit, setLimit] = useState(10)
  const [matchMode, setMatchMode] = useState('skills')
  const [sortBy, setSortBy] = useState('relevance')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [matchedJobs, setMatchedJobs] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalResults, setTotalResults] = useState(0)

  const handleMatch = async (e, page = 1) => {
    e?.preventDefault()

    if (!cvId) {
      setError('Please upload your CV first')
      return
    }
    if (!query.trim()) {
      setError('Please enter a job search keyword')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const offset = (page - 1) * limit
      const data = await matchJobs(
        cvId,
        query.trim(),
        location.trim(),
        source,
        limit,
        offset,
        matchMode,
        sortBy
      )
      const jobs = data.matched_jobs || []
      setMatchedJobs(jobs)
      setTotalResults(data.total || 0)
      setCurrentPage(page)
      // ponytail: save to localStorage so OptimizePage can pick matched jobs
      localStorage.setItem('matchedJobs', JSON.stringify(jobs))
      const count = jobs.length
      toast.success(`Found ${count} matches`)
    } catch (err) {
      setError(err.message || 'Failed to match jobs. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (newPage) => {
    handleMatch(null, newPage)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl transition-theme">
          AI Job Matching
        </h1>
        <p className="text-sm text-muted-foreground transition-theme leading-relaxed">
          Compare your <span className="text-foreground font-semibold">CV profile</span> against job
          listings using skill-based scoring algorithms.
        </p>
      </header>

      {/* CV Status */}
      {!cvId && (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Target size={32} className="text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">No CV Detected</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Upload your CV first to enable AI-powered job matching.
          </p>
          <Link
            to="/cv"
            className="inline-flex items-center justify-center bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-all shadow-sm text-xs"
          >
            Upload CV →
          </Link>
        </div>
      )}

      {cvInfo && (
        <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <div className="text-xs">
                <span className="font-semibold text-foreground">{cvInfo.name}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="text-muted-foreground">
                  {cvInfo.skills?.length || 0} skills indexed
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Match Form */}
      <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
        <form className="p-5 space-y-4" onSubmit={handleMatch}>
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
              disabled={loading || !cvId}
              className="md:col-span-3 bg-primary text-primary-foreground font-medium text-sm py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Target size={14} weight="bold" />
              Run Match
            </button>
          </div>

          <div className="pt-3 border-t border-border flex flex-wrap items-center gap-6 text-xs text-muted-foreground font-medium transition-theme">
            <div className="flex items-center gap-2">
              <span>Job Board:</span>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="bg-card border border-border text-foreground rounded-md px-2 py-1 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 cursor-pointer font-semibold transition-theme text-xs"
              >
                <option value="jobstreet">Jobstreet</option>
                <option value="indeed">Indeed</option>
                <option value="both">Both</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span>Match Mode:</span>
              <select
                value={matchMode}
                onChange={(e) => setMatchMode(e.target.value)}
                className="bg-card border border-border text-foreground rounded-md px-2 py-1 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 cursor-pointer font-semibold transition-theme text-xs"
              >
                <option value="skills">Skills Matching</option>
                <option value="semantic">Semantic Matching</option>
                <option value="hybrid">Hybrid Matching</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span>Results Limit:</span>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                min="1"
                max="50"
                className="w-16 bg-card border border-border text-foreground rounded-md px-2 py-1 text-center font-semibold text-xs focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
              />
            </div>

            <div className="flex items-center gap-2">
              <span>Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-card border border-border text-foreground rounded-md px-2 py-1 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 cursor-pointer font-semibold transition-theme text-xs"
              >
                <option value="relevance">Relevance</option>
                <option value="date">Newest First</option>
              </select>
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
                onClick={() => handleMatch()}
                className="whitespace-nowrap bg-destructive text-destructive-foreground font-medium px-3 py-1 rounded-md hover:opacity-90 active:scale-[0.98] transition-all text-xs shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </form>
      </section>

      {/* Results */}
      {matchedJobs.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2 transition-theme">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Match Results ({matchedJobs.length})
            </h2>
            <span className="text-xs font-mono bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded transition-theme">
              MATCH_ENGINE: OK
            </span>
          </div>

          <div className="space-y-3">
            {matchedJobs.map((job, index) => {
              const matchScore = job.match_score || 0
              const matchDetails = job.match_details || {}
              const matchedSkills = matchDetails.matched_skills || []

              return (
                <div
                  key={index}
                  className="bg-card border border-border hover:border-muted-foreground/30 shadow-sm transition-all rounded-xl p-5 card-hover"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
                        {job.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground font-medium mt-1 transition-theme">
                        <span className="text-foreground font-semibold flex items-center gap-1">
                          <Buildings size={12} />
                          {job.company}
                        </span>
                        {job.location && (
                          <>
                            <span className="text-muted-foreground/40">•</span>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {job.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="self-start text-[10px] font-mono font-bold tracking-wider bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded uppercase transition-theme">
                      {job.source}
                    </span>
                  </div>

                  {/* Match Score Bar */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          matchScore >= 70
                            ? 'bg-emerald-500'
                            : matchScore >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${matchScore}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-foreground min-w-[40px] text-right">
                      {matchScore}%
                    </span>
                    <span className="text-[10px] font-semibold text-muted-foreground border border-border px-2 py-0.5 rounded inline-flex items-center gap-1">
                      <Sparkle size={10} weight="fill" />
                      {matchScore >= 70 ? 'Strong' : matchScore >= 50 ? 'Good' : 'Partial'}
                    </span>
                  </div>

                  {/* Matched Skills */}
                  {matchedSkills.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Matched Skills ({matchedSkills.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedSkills.slice(0, 8).map((skill, i) => (
                          <span
                            key={i}
                            className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded text-xs font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {matchedSkills.length > 8 && (
                          <span className="text-xs text-muted-foreground self-center">
                            +{matchedSkills.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {job.description && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-4xl transition-theme">
                      {job.description}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3.5 border-t border-border text-xs transition-theme">
                    <span className="text-muted-foreground font-mono">
                      {job.posted_date || 'Date N/A'}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View source post for ${job.title}`}
                        className="border border-border text-foreground hover:bg-muted font-medium px-3 py-1.5 rounded-md transition-all"
                      >
                        Source Post ↗
                      </a>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Apply to ${job.title}`}
                        className="bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-all shadow-sm"
                      >
                        Apply
                      </a>
                      <Link
                        to="/optimize"
                        aria-label={`Optimize CV for ${job.title}`}
                        className="border border-primary text-primary font-medium px-3 py-1.5 rounded-md hover:bg-primary/10 transition-all"
                      >
                        Optimize CV
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {totalResults > limit && (
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Go to previous page"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">
                  Page <span className="font-bold text-foreground">{currentPage}</span> of{' '}
                  <span className="font-bold text-foreground">
                    {Math.ceil(totalResults / limit)}
                  </span>
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">
                  <span className="font-bold text-foreground">{totalResults}</span> total results
                </span>
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= Math.ceil(totalResults / limit)}
                aria-label="Go to next page"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </section>
      )}

      {/* Loading State */}
      {loading && <JobCardSkeletonList count={3} showScoreBar showSkills />}

      {/* Welcome Empty State — CV loaded but no search yet */}
      {!loading && matchedJobs.length === 0 && !query && cvId && (
        <EmptyState
          icon={Target}
          title="Ready to Match"
          description="Search for jobs and we'll score them against your CV profile."
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
      )}

      {/* Empty State — search returned nothing */}
      {!loading && matchedJobs.length === 0 && query && (
        <EmptyState
          icon={MagnifyingGlass}
          title="No Matches Found"
          description="Try different keywords or adjust your search criteria"
          actionLabel="Clear Filters"
          onAction={() => {
            setQuery('')
            setLocation('')
            setMatchedJobs([])
          }}
        />
      )}
    </div>
  )
}

export default MatchPage
