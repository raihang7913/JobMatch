import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CloudArrowUp,
  Paperclip,
  CheckCircle,
  FileDoc,
  X,
  ArrowArcRight,
  FileText,
} from '@phosphor-icons/react'
import { uploadCV, downloadCVUrl, getSessionId, loadDemoCV } from '../api/client'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/EmptyState'

// ponytail: browser native PDF viewer via <embed>, upgrade to pdf.js for thumbnails/annotations
function CVPage({ onUpload, cvInfo }) {
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  // ponytail: fetch CV as blob with session header for authenticated preview.
  // Blob URL avoids exposing the file to the browser's embed/src fetch which can't send custom headers.
  useEffect(() => {
    if (!cvInfo?.cv_id) return
    let revoked = false
    setPdfLoading(true)
    fetch(downloadCVUrl(cvInfo.cv_id), {
      headers: { 'X-Session-Id': getSessionId() },
    })
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load CV')
        return r.blob()
      })
      .then((blob) => {
        if (!revoked) {
          setPdfUrl(URL.createObjectURL(blob))
          setPdfLoading(false)
        }
      })
      .catch(() => {
        if (!revoked) {
          toast.error('Failed to load CV preview')
          setPdfLoading(false)
        }
      })
    return () => {
      revoked = true
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [cvInfo?.cv_id])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.pdf') && !selectedFile.name.endsWith('.docx')) {
        setError('Only PDF and DOCX files are supported')
        setFile(null)
        return
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (!droppedFile.name.endsWith('.pdf') && !droppedFile.name.endsWith('.docx')) {
        setError('Only PDF and DOCX files are supported')
        return
      }
      if (droppedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(droppedFile)
      setError(null)
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a file first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await uploadCV(file)
      onUpload(data.cv_id, data)
      setFile(null)
      const fileInput = document.getElementById('cv-file-input')
      if (fileInput) fileInput.value = ''
      toast.success('CV uploaded and parsed successfully!')
    } catch (err) {
      setError(err.message || 'Failed to upload CV. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadDemo = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadDemoCV()
      onUpload(data.cv_id, data)
      toast.success('Sample CV loaded! Ready to explore.')
    } catch (err) {
      setError(err.message || 'Failed to load demo CV')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-2 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl transition-theme">
          Upload Your CV
        </h1>
        <p className="text-sm text-muted-foreground transition-theme leading-relaxed">
          AI-powered document parser extracts skills, experience, and contact data from your resume.
        </p>
      </header>

      {/* Upload Form */}
      <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
        <form className="p-5 space-y-4" onSubmit={handleUpload}>
          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-all ${
              dragActive
                ? 'border-primary bg-primary/5'
                : file
                  ? 'border-primary/50 bg-primary/5'
                  : 'border-border hover:border-muted-foreground/40'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {!file ? (
              <div className="space-y-3">
                <CloudArrowUp
                  size={40}
                  weight="duotone"
                  className="text-muted-foreground mx-auto"
                />
                <div className="text-sm">
                  <label
                    htmlFor="cv-file-input"
                    className="cursor-pointer text-primary hover:text-primary/80 font-semibold"
                  >
                    Click to upload
                  </label>
                  <span className="text-muted-foreground"> or drag and drop</span>
                </div>
                <p className="text-xs text-muted-foreground">PDF or DOCX (max 10MB)</p>
                <p className="text-xs text-primary font-medium">
                  Rekomendasi: upload DOCX kalau mau hasil tailoring paling rapi. PDF tetap bisa, tapi akan dibuat ulang sebagai ATS CV.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Paperclip size={32} weight="duotone" className="text-primary mx-auto" />
                <p className="text-sm font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null)
                    document.getElementById('cv-file-input').value = ''
                  }}
                  className="bg-destructive text-destructive-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-all text-xs inline-flex items-center gap-1"
                >
                  <X size={12} weight="bold" /> Remove
                </button>
              </div>
            )}
            <input
              id="cv-file-input"
              type="file"
              accept=".pdf,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="bg-destructive/10 border border-destructive/20 text-destructive px-3 py-2 rounded-lg text-xs"
            >
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !file}
              className="flex-1 bg-primary text-primary-foreground font-medium text-sm py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CloudArrowUp size={14} weight="bold" />
              {loading ? 'Analyzing...' : 'Upload & Analyze CV'}
            </button>
          </div>
        </form>

        {/* Demo button — outside form to avoid submit */}
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={loading}
            aria-label="Load sample CV for demonstration"
            className="w-full border border-border bg-muted/50 text-foreground font-medium text-sm py-2 px-4 rounded-lg hover:bg-muted transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ArrowArcRight size={14} weight="bold" />
            Try with Sample CV
          </button>
        </div>
      </section>

      {/* CV Loading Skeleton */}
      {loading && !cvInfo && (
        <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
              <Skeleton className="w-5 h-5 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <Skeleton className="h-2.5 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="border border-border rounded-lg p-4 space-y-2">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-7 w-12" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Empty State — no CV uploaded */}
      {!loading && !cvInfo && (
        <EmptyState
          icon={FileText}
          title="No CV Uploaded"
          description="Upload your CV or try our sample to get started with AI-powered job matching."
        />
      )}

      {/* CV Analysis Results */}
      {cvInfo && (
        <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border">
              <CheckCircle size={20} weight="fill" className="text-emerald-500" />
              <div>
                <h3 className="text-sm font-bold text-foreground">CV Parsed Successfully</h3>
                <p className="text-xs text-muted-foreground">Profile ready for job matching</p>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                ['Full Name', cvInfo.name],
                ['Email', cvInfo.email],
                ['Phone', cvInfo.phone],
                [
                  'Education',
                  cvInfo.education?.map((e) => e.degree).join(', ') || cvInfo.location || '-',
                ],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    {label}
                  </p>
                  <p className="text-sm text-foreground font-medium truncate">{value || '-'}</p>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="border border-border rounded-lg p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Skills Detected
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {cvInfo.skills?.length || 0}
                </span>
              </div>
              <div className="border border-border rounded-lg p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Experience
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {cvInfo.experience_count || 0}
                </span>
              </div>
              <div className="border border-border rounded-lg p-4">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Projects
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {cvInfo.projects_count || 0}
                </span>
              </div>
            </div>

            {/* Skills */}
            {cvInfo.skills?.length > 0 && (
              <div className="pt-4 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Skill Index
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {cvInfo.skills.slice(0, 30).map((skill, i) => (
                    <span
                      key={i}
                      className="bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded text-xs font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                  {cvInfo.skills.length > 30 && (
                    <span className="text-xs text-muted-foreground self-center">
                      +{cvInfo.skills.length - 30} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="mt-5 pt-4 border-t border-border">
              <Link
                to="/match"
                className="inline-flex items-center justify-center bg-primary text-primary-foreground font-medium px-3 py-1.5 rounded-md hover:opacity-90 transition-all shadow-sm text-xs"
              >
                Start Matching Jobs →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CV Preview — authenticated blob URL from useEffect above */}
      {cvInfo && cvInfo.filename && (
        <section className="bg-card border border-border shadow-sm rounded-xl overflow-hidden transition-theme">
          <div className="p-5">
            <h3 className="text-sm font-bold text-foreground mb-4 pb-3 border-b border-border">
              CV Preview
            </h3>

            {cvInfo.filename.endsWith('.pdf') && (pdfLoading || pdfUrl) ? (
              <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                {pdfLoading && !pdfUrl ? (
                  <div className="w-full h-[400px] flex items-center justify-center bg-muted/30 rounded-lg">
                    <Skeleton className="h-5 w-48" />
                  </div>
                ) : (
                  <embed src={pdfUrl} type="application/pdf" className="w-full h-[700px]" />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-8 gap-3">
                <FileDoc size={40} weight="duotone" className="text-muted-foreground" />
                <p className="text-sm text-foreground font-medium">Word Document (.docx)</p>
                <p className="text-xs text-muted-foreground">
                  Preview not available for DOCX files
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default CVPage
