import { CheckCircle, Copy, ArrowRight, DownloadSimple } from '@phosphor-icons/react'

export default function OptimizationResults({
  result,
  originalCv,
  appliedSuggestions,
  onToggleSuggestion,
  onApplyAll,
  onCopyOptimized,
  onGenerateTailored,
  generatingTailored = false,
}) {
  if (!result) return null
  const cvData = originalCv?.parsed_data || originalCv || {}

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-xl font-semibold text-foreground">Hasil Optimisasi</h2>
        <div className="flex gap-3">
          <button
            aria-label="Apply all suggestions"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border text-foreground hover:bg-muted active:scale-[0.98] rounded-lg transition-all"
            onClick={onApplyAll}
          >
            <CheckCircle size={20} />
            Apply All
          </button>
          <button
            aria-label="Generate tailored CV file"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-medium text-sm py-2 px-4 rounded-lg hover:opacity-90 active:scale-[0.98] transition-all shadow-sm disabled:opacity-50"
            onClick={onGenerateTailored}
            disabled={generatingTailored}
          >
            <DownloadSimple size={20} />
            {generatingTailored ? 'Generating...' : 'Generate Tailored CV'}
          </button>
          <button
            aria-label="Copy optimized CV to clipboard"
            className="inline-flex items-center gap-2 border border-border text-foreground font-medium text-sm py-2 px-4 rounded-lg hover:bg-muted active:scale-[0.98] transition-all"
            onClick={onCopyOptimized}
          >
            <Copy size={20} />
            Copy
          </button>
        </div>
      </div>

      {/* Experience Improvements */}
      {result.experience_improvements && result.experience_improvements.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-foreground">📝 Perbaikan Pengalaman Kerja</h3>
          {result.experience_improvements.map((improvement, idx) => {
            const isApplied = appliedSuggestions.has(`experience-${idx}`)
            const originalExp = cvData.experience?.[improvement.index]

            return (
              <div
                key={idx}
                className={`bg-card border shadow-sm rounded-xl p-5 flex flex-col gap-4 transition-all card-hover ${
                  isApplied ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex justify-between items-center gap-4">
                  <h4 className="text-base font-semibold text-foreground">
                    {originalExp?.title || 'Experience'} - {originalExp?.company || ''}
                  </h4>
                  <button
                    aria-label={
                      isApplied
                        ? `Remove suggestion for ${originalExp?.title || 'experience'}`
                        : `Apply suggestion for ${originalExp?.title || 'experience'}`
                    }
                    className={`py-2 px-4 text-sm font-medium rounded-lg cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] ${
                      isApplied
                        ? 'bg-primary text-primary-foreground border border-primary'
                        : 'bg-card text-foreground border border-border hover:bg-muted'
                    }`}
                    onClick={() => onToggleSuggestion('experience', idx)}
                  >
                    {isApplied ? 'Applied' : 'Apply'}
                  </button>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center max-md:grid-cols-1">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Original:
                    </span>
                    <p className="p-4 bg-muted rounded-lg text-sm leading-relaxed text-foreground m-0">
                      {improvement.original}
                    </p>
                  </div>

                  <ArrowRight
                    size={24}
                    className="text-muted-foreground flex-shrink-0 max-md:rotate-90 max-md:my-2"
                  />

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Suggestion:
                    </span>
                    <p className="p-4 bg-muted rounded-lg text-sm leading-relaxed text-foreground m-0">
                      {improvement.suggestion}
                    </p>
                  </div>
                </div>

                {improvement.reasoning && (
                  <div className="p-4 bg-primary/5 border-l-[3px] border-primary rounded-md text-sm text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Alasan:</strong> {improvement.reasoning}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Skills Improvements */}
      {result.skills_improvements && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-foreground">🎯 Perbaikan Skills</h3>
          <div
            className={`bg-card border shadow-sm rounded-xl p-5 flex flex-col gap-4 transition-all card-hover ${
              appliedSuggestions.has('skills-0') ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex justify-between items-center gap-4">
              <h4 className="text-base font-semibold text-foreground">Skills Optimization</h4>
              <button
                aria-label={
                  appliedSuggestions.has('skills-0')
                    ? 'Remove skills suggestion'
                    : 'Apply skills suggestion'
                }
                className={`py-2 px-4 text-sm font-medium rounded-lg cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] ${
                  appliedSuggestions.has('skills-0')
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'bg-card text-foreground border border-border hover:bg-muted'
                }`}
                onClick={() => onToggleSuggestion('skills', 0)}
              >
                {appliedSuggestions.has('skills-0') ? 'Applied' : 'Apply'}
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {result.skills_improvements.skills_to_add &&
                result.skills_improvements.skills_to_add.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Skills yang Sebaiknya Ditambahkan:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.skills_improvements.skills_to_add.map((skill, idx) => (
                        <span
                          key={idx}
                          className="py-1.5 px-3 text-sm rounded-md font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {result.skills_improvements.skills_to_prioritize &&
                result.skills_improvements.skills_to_prioritize.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Skills yang Diprioritaskan:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.skills_improvements.skills_to_prioritize.map((skill, idx) => (
                        <span
                          key={idx}
                          className="py-1.5 px-3 text-sm rounded-md font-medium bg-primary/10 text-primary border border-primary/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {result.skills_improvements.reasoning && (
                <div className="p-4 bg-primary/5 border-l-[3px] border-primary rounded-md text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Alasan:</strong>{' '}
                  {result.skills_improvements.reasoning}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary Suggestion */}
      {result.summary_suggestion && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-foreground">✨ Professional Summary</h3>
          <div
            className={`bg-card border shadow-sm rounded-xl p-5 flex flex-col gap-4 transition-all card-hover ${
              appliedSuggestions.has('summary-0') ? 'border-primary bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex justify-between items-center gap-4">
              <h4 className="text-base font-semibold text-foreground">Professional Summary</h4>
              <button
                aria-label={
                  appliedSuggestions.has('summary-0')
                    ? 'Remove summary suggestion'
                    : 'Apply summary suggestion'
                }
                className={`py-2 px-4 text-sm font-medium rounded-lg cursor-pointer transition-all hover:opacity-90 active:scale-[0.98] ${
                  appliedSuggestions.has('summary-0')
                    ? 'bg-primary text-primary-foreground border border-primary'
                    : 'bg-card text-foreground border border-border hover:bg-muted'
                }`}
                onClick={() => onToggleSuggestion('summary', 0)}
              >
                {appliedSuggestions.has('summary-0') ? 'Applied' : 'Apply'}
              </button>
            </div>

            <div>
              <p className="p-4 bg-muted rounded-lg text-sm leading-relaxed text-foreground m-0">
                {result.summary_suggestion.suggestion}
              </p>
            </div>

            {result.summary_suggestion.reasoning && (
              <div className="p-4 bg-primary/5 border-l-[3px] border-primary rounded-md text-sm text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Alasan:</strong>{' '}
                {result.summary_suggestion.reasoning}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overall Tips */}
      {result.overall_tips && result.overall_tips.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-foreground">💡 Tips Umum</h3>
          <div className="flex flex-col gap-3">
            {result.overall_tips.map((tip, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 bg-card border border-border rounded-lg text-sm leading-relaxed text-foreground"
              >
                <CheckCircle
                  size={20}
                  weight="fill"
                  className="text-primary flex-shrink-0 mt-0.5"
                />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
