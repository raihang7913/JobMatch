import { Buildings, MapPin } from '@phosphor-icons/react'

/**
 * FeaturedJobCard - Premium large card with double-bezel (nested) architecture
 * Based on: high-end-visual-design skill + redesign-existing-projects
 *
 * Features:
 * - Double-bezel nested architecture (outer shell + inner core)
 * - Magnetic hover physics with spring easing
 * - Custom cubic-bezier transitions
 * - Tinted shadows matching theme
 */
function FeaturedJobCard({ job, index }) {
  return (
    <div
      className="group animate-slide-up"
      style={{
        animationDelay: `${index * 50}ms`,
        // Custom cubic-bezier for premium feel
        transition: 'all 700ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {/* OUTER SHELL - Double-Bezel Architecture */}
      <div className="relative p-1.5 bg-gradient-to-br from-white/10 to-white/5 rounded-[2rem] ring-1 ring-white/10 hover:ring-white/20 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]">
        {/* INNER CORE */}
        <div className="relative bg-gradient-to-br from-white/70 to-white/60 backdrop-blur-xl rounded-[calc(2rem-0.375rem)] border border-white/30 overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.12)] transition-all duration-700">
          {/* Background Pattern/Texture */}
          <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgMTBMMCA0MEw0MCA0MEw0MCAxMFoiIGZpbGw9IiMwMDAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSI1MCUiIGhlaWdodD0iNTAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] pointer-events-none"></div>

          <div className="relative p-8">
            {/* Eyebrow Tag */}
            <div className="inline-flex items-center gap-2 mb-4">
              <span className="inline-block px-3 py-1.5 rounded-lg text-xs uppercase tracking-widest font-semibold bg-primary-100/80 text-primary-700 border border-primary-200/50 shadow-sm">
                Featured
              </span>
              <span
                className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-widest font-semibold shadow-sm transition-all duration-200 ${
                  job.source === 'Indeed'
                    ? 'bg-blue-100/80 text-blue-800 border border-blue-200/50'
                    : 'bg-secondary-100/80 text-secondary-700 border border-secondary-200/50'
                }`}
              >
                {job.source}
              </span>
            </div>

            {/* Job Title - Using typography scale */}
            <h3 className="text-h1 font-heading font-bold text-foreground mb-4 group-hover:text-primary-600 transition-colors duration-200">
              {job.title}
            </h3>

            {/* Company & Location - Better hierarchy */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center border border-primary-200/30">
                  <Buildings size={20} weight="duotone" className="text-primary-600" />
                </div>
                <span className="font-semibold text-foreground text-lg">{job.company}</span>
              </div>
              <div className="flex items-center gap-2 text-foreground/70">
                <MapPin size={18} weight="duotone" className="text-foreground/60" />
                <span className="text-base">{job.location}</span>
              </div>
            </div>

            {/* Job Summary - Constrained width for readability */}
            {job.summary && job.summary !== 'N/A' && (
              <p className="text-foreground/70 mb-6 leading-relaxed max-w-[65ch] text-base">
                {job.summary}
              </p>
            )}

            {/* CTA with Button-in-Button trailing icon pattern */}
            <div className="flex items-center justify-between pt-6 border-t border-white/30">
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group/btn relative inline-flex items-center gap-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white px-6 py-3 rounded-lg font-semibold shadow-lg hover:shadow-xl active:scale-[0.98] transition-all duration-200"
              >
                <span>View Details</span>
                {/* Nested Icon Circle - Button-in-Button pattern */}
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover/btn:translate-x-1 group-hover/btn:scale-110 transition-all duration-200">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FeaturedJobCard
