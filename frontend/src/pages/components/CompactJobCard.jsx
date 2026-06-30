import { Buildings, MapPin } from '@phosphor-icons/react'

/**
 * CompactJobCard - Refined standard card with premium polish
 * Based on: redesign-existing-projects skill
 *
 * Improvements over original:
 * - Custom cubic-bezier transitions (no default easing)
 * - Tinted shadows matching theme
 * - Active/pressed feedback (scale)
 * - Better visual hierarchy
 * - Max-width on summary for readability
 */
function CompactJobCard({ job, index }) {
  return (
    <div
      className="group animate-slide-up"
      style={{
        animationDelay: `${index * 50}ms`,
        // Custom cubic-bezier for premium feel (no linear/ease-in-out)
        transition: 'all 500ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <div className="relative bg-white/60 backdrop-blur-md border border-white/30 rounded-2xl p-6 hover:shadow-[0_16px_48px_rgba(0,0,0,0.08)] hover:bg-white/70 hover:border-primary-200/50 active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]">
        {/* Subtle grain texture overlay */}
        <div className="absolute inset-0 rounded-2xl opacity-[0.02] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMTBMMCA0MEw0MCA0MEw0MCAxMFoiIGZpbGw9IiMwMDAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MCUiIGhlaWdodD0iNTAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] pointer-events-none"></div>

        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              {/* Job Title - Improved hierarchy */}
              <h4 className="text-xl md:text-2xl font-heading font-bold text-foreground group-hover:text-primary-600 transition-colors duration-500 mb-2 line-clamp-2 leading-tight tracking-tight">
                {job.title}
              </h4>

              {/* Company & Location */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/70">
                <div className="flex items-center gap-1.5">
                  <Buildings size={16} weight="duotone" className="text-foreground/60" />
                  <span className="font-semibold">{job.company}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} weight="duotone" className="text-foreground/60" />
                  <span>{job.location}</span>
                </div>
              </div>
            </div>

            {/* Source Badge */}
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                job.source === 'Indeed'
                  ? 'bg-blue-100/80 backdrop-blur-sm text-blue-800 border border-blue-200/50'
                  : 'bg-green-100/80 backdrop-blur-sm text-green-800 border border-green-200/50'
              }`}
            >
              {job.source}
            </span>
          </div>

          {/* Job Summary - Constrained width for readability (65ch max) */}
          {job.summary && job.summary !== 'N/A' && (
            <p className="text-foreground/70 mb-4 leading-relaxed line-clamp-3 text-sm max-w-[65ch]">
              {job.summary}
            </p>
          )}

          {/* CTA Section */}
          <div className="flex items-center justify-between pt-4 border-t border-white/20">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/btn inline-flex items-center gap-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white py-2.5 px-5 rounded-xl text-sm font-semibold shadow-md hover:shadow-[0_8px_24px_rgba(59,130,246,0.25)] active:scale-[0.98] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
            >
              View Details
              <svg
                className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CompactJobCard
