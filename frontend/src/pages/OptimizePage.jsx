import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Key, MagicWand, FileText, Sparkle, Target } from '@phosphor-icons/react'
import ApiKeyModal from '../components/ApiKeyModal'
import OptimizationResults from '../components/OptimizationResults'
import { Skeleton } from '../components/ui/skeleton'
import { hasConfig, optimizeCV } from '../api/llmClient'
import { getCVs, getCV } from '../api/client'

export default function OptimizePage() {
  const [initialLoading, setInitialLoading] = useState(true)
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [cvList, setCvList] = useState([])
  const [selectedCvId, setSelectedCvId] = useState('')
  const [selectedCv, setSelectedCv] = useState(null)
  const [jobDescription, setJobDescription] = useState('')
  const [useManualJob, setUseManualJob] = useState(false)
  const [matchedJobs, setMatchedJobs] = useState([])
  const [selectedJobIndex, setSelectedJobIndex] = useState(-1)
  const [optimizing, setOptimizing] = useState(false)
  const [optimizationResult, setOptimizationResult] = useState(null)
  const [error, setError] = useState('')
  const [appliedSuggestions, setAppliedSuggestions] = useState(new Set())

  useEffect(() => {
    setApiKeyConfigured(hasConfig())
    loadCvList()
    loadMatchedJobs()
  }, [])

  useEffect(() => {
    if (selectedCvId) {
      loadCvDetails(selectedCvId)
    }
  }, [selectedCvId])

  useEffect(() => {
    if (selectedJobIndex >= 0 && matchedJobs[selectedJobIndex]) {
      const job = matchedJobs[selectedJobIndex]
      setJobDescription(job.description || `${job.title}\n${job.company}\n${job.location}`)
    }
  }, [selectedJobIndex, matchedJobs])

  const loadCvList = async () => {
    try {
      const data = await getCVs()
      setCvList(data.cvs || [])
      if (data.cvs && data.cvs.length > 0) {
        setSelectedCvId(data.cvs[0].id)
      }
    } catch (err) {
      toast.error('Failed to load CV list. Please try again.')
    }
    setInitialLoading(false)
  }

  const loadCvDetails = async (cvId) => {
    try {
      const data = await getCV(cvId)
      setSelectedCv(data)
    } catch (err) {
      toast.error('Failed to load CV details.')
    }
  }

  const loadMatchedJobs = () => {
    const stored = localStorage.getItem('matchedJobs')
    if (stored) {
      try {
        const jobs = JSON.parse(stored)
        setMatchedJobs(jobs)
      } catch (err) {
        toast.error('Failed to load matched jobs data.')
      }
    }
  }

  const handleOptimize = async () => {
    if (!selectedCv) {
      setError('Pilih CV terlebih dahulu')
      return
    }
    if (!jobDescription.trim()) {
      setError('Masukkan job description')
      return
    }
    setOptimizing(true)
    setError('')
    setOptimizationResult(null)
    try {
      const result = await optimizeCV(selectedCv?.parsed_data, jobDescription)
      setOptimizationResult(result)
      toast.success('CV optimization complete!')
    } catch (err) {
      setError(err.message || 'Gagal mengoptimasi CV')
    } finally {
      setOptimizing(false)
    }
  }

  const handleApplySuggestion = (type, index) => {
    const key = `${type}-${index}`
    setAppliedSuggestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const handleApplyAll = () => {
    if (!optimizationResult) return
    const allKeys = new Set()
    optimizationResult.experience_improvements?.forEach((_, idx) => {
      allKeys.add(`experience-${idx}`)
    })
    if (optimizationResult.skills_improvements) {
      allKeys.add('skills-0')
    }
    if (optimizationResult.summary_suggestion) {
      allKeys.add('summary-0')
    }
    setAppliedSuggestions(allKeys)
  }

  const handleCopyOptimized = () => {
    if (!optimizationResult) return
    let optimizedText = '# OPTIMIZED CV\n\n'
    if (appliedSuggestions.has('summary-0') && optimizationResult.summary_suggestion) {
      optimizedText += '## Professional Summary\n'
      optimizedText += optimizationResult.summary_suggestion.suggestion + '\n\n'
    }
    optimizedText += '## Experience\n'
    selectedCv.experience?.forEach((exp, idx) => {
      const improvement = optimizationResult.experience_improvements?.find(
        (imp) => imp.index === idx
      )
      const text =
        appliedSuggestions.has(`experience-${idx}`) && improvement
          ? improvement.suggestion
          : exp.description
      optimizedText += `### ${exp.title || ''} - ${exp.company || ''}\n`
      optimizedText += `${exp.dates || ''}\n`
      optimizedText += `${text}\n\n`
    })
    optimizedText += '## Skills\n'
    if (appliedSuggestions.has('skills-0') && optimizationResult.skills_improvements) {
      const prioritized = optimizationResult.skills_improvements.skills_to_prioritize || []
      const toAdd = optimizationResult.skills_improvements.skills_to_add || []
      optimizedText += [...prioritized, ...toAdd].join(', ') + '\n'
    } else {
      optimizedText += (selectedCv.skills || []).join(', ') + '\n'
    }
    navigator.clipboard.writeText(optimizedText)
    alert('CV yang sudah dioptimasi telah disalin ke clipboard!')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="space-y-2 max-w-3xl">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl transition-theme">
          <Sparkle size={28} weight="fill" className="text-primary flex-shrink-0" />
          Optimize CV
        </h1>
        <p className="text-sm text-muted-foreground transition-theme leading-relaxed">
          Tingkatkan kualitas CV Anda dengan bantuan AI
        </p>
      </header>

      {/* API Key Setup Section */}
      {!apiKeyConfigured ? (
        <div className="flex justify-center px-4 py-12">
          <div className="flex flex-col items-center gap-4 px-8 py-12 bg-card border border-border shadow-sm rounded-xl text-center max-w-lg transition-theme">
            <Key size={48} weight="duotone" className="text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground">Setup AI Backend</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Untuk menggunakan fitur optimisasi CV, Anda perlu mengatur backend AI. Pilih Direct
              Cloud API (OpenAI, Gemini, Claude) atau 9Router lokal.
            </p>
            <button
              className="bg-primary text-primary-foreground font-medium text-sm py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-sm inline-flex items-center gap-2"
              onClick={() => setShowApiKeyModal(true)}
            >
              <Key size={20} />
              Setup AI Backend
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* CV Selection */}
          <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
            <div className="p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2 pb-3 border-b border-border">
                <FileText size={20} />
                Pilih CV
              </h3>

              {/* Loading skeleton */}
              {initialLoading ? (
                <div className="space-y-2">
                  <div className="h-10 bg-muted rounded-lg w-full animate-pulse" />
                </div>
              ) : cvList.length === 0 ? (
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    No CVs uploaded yet. Upload one first to get started.
                  </p>
                  <Link
                    to="/cv"
                    className="inline-flex items-center justify-center bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-all shadow-sm text-xs"
                  >
                    Upload CV →
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedCvId}
                  onChange={(e) => setSelectedCvId(e.target.value)}
                  className="w-full bg-input border border-border text-foreground rounded-lg text-sm py-2.5 px-3.5 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
                >
                  <option value="">-- Pilih CV --</option>
                  {cvList.map((cv) => (
                    <option key={cv.id} value={cv.id}>
                      {cv.filename}
                    </option>
                  ))}
                </select>
              )}

              {selectedCv && (
                <div className="p-4 bg-muted rounded-lg transition-theme">
                  <h4 className="text-lg font-semibold text-foreground mb-1">
                    {selectedCv.parsed_data?.name || 'N/A'}
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {selectedCv.parsed_data?.email || 'N/A'}
                  </p>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>{selectedCv.parsed_data?.experience?.length || 0} pengalaman</span>
                    <span>{selectedCv.parsed_data?.skills?.length || 0} skills</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Job Description Input */}
          <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
            <div className="p-5 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground pb-3 border-b border-border">
                Target Job
              </h3>

              <div className="flex gap-2 p-1 bg-muted rounded-lg">
                <button
                  className={`flex-1 py-2 px-4 text-sm font-medium border-none rounded-md cursor-pointer transition-all ${
                    !useManualJob
                      ? 'bg-card text-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setUseManualJob(false)}
                >
                  Dari Hasil Match
                </button>
                <button
                  className={`flex-1 py-2 px-4 text-sm font-medium border-none rounded-md cursor-pointer transition-all ${
                    useManualJob
                      ? 'bg-card text-foreground shadow-sm'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setUseManualJob(true)}
                >
                  Input Manual
                </button>
              </div>

              {!useManualJob ? (
                matchedJobs.length === 0 ? (
                  <div className="bg-muted/50 rounded-lg p-6 text-center">
                    <Target size={24} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">No matched jobs yet</p>
                    <p className="text-xs text-muted-foreground">
                      Use manual input or run a match first
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedJobIndex}
                    onChange={(e) => setSelectedJobIndex(parseInt(e.target.value))}
                    className="w-full bg-input border border-border text-foreground rounded-lg text-sm py-2.5 px-3.5 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
                  >
                    <option value={-1}>-- Pilih Job --</option>
                    {matchedJobs.map((job, idx) => (
                      <option key={idx} value={idx}>
                        {job.title} - {job.company}
                      </option>
                    ))}
                  </select>
                )
              ) : (
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job description di sini..."
                  className="w-full bg-input border border-border text-foreground rounded-lg text-sm py-2.5 px-3.5 resize-vertical focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-theme"
                  style={{ fontFamily: 'inherit' }}
                  rows={8}
                />
              )}
            </div>
          </section>

          {/* Optimize Button */}
          <button
            className="w-full bg-primary text-primary-foreground font-medium text-base py-3.5 px-6 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-sm inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleOptimize}
            disabled={optimizing || !selectedCv || !jobDescription.trim()}
          >
            <MagicWand size={20} weight="fill" />
            {optimizing ? 'Optimizing...' : 'Optimize CV'}
          </button>

          {/* Loading Skeleton during optimization */}
          {optimizing && (
            <div className="flex flex-col gap-6">
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <Skeleton className="h-5 w-40" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-6 rounded-full" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div
              role="alert"
              className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm transition-theme flex items-center justify-between gap-3"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={handleOptimize}
                className="whitespace-nowrap bg-destructive text-destructive-foreground font-medium px-3 py-1 rounded-md hover:opacity-90 active:scale-[0.98] transition-all text-xs shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Optimization Results */}
          {optimizationResult && (
            <OptimizationResults
              result={optimizationResult}
              originalCv={selectedCv}
              appliedSuggestions={appliedSuggestions}
              onToggleSuggestion={handleApplySuggestion}
              onApplyAll={handleApplyAll}
              onCopyOptimized={handleCopyOptimized}
            />
          )}
        </>
      )}

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={showApiKeyModal}
        onClose={() => setShowApiKeyModal(false)}
        onSuccess={() => {
          setApiKeyConfigured(true)
          setShowApiKeyModal(false)
        }}
      />
    </div>
  )
}
