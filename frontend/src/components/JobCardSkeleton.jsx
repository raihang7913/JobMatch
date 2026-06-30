import { Skeleton } from './ui/skeleton'

function JobCardSkeleton({ showScoreBar = false, showSkills = false }) {
  return (
    <div className="bg-card border border-border shadow-sm rounded-lg p-5 transition-all duration-200 card-hover">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        {showScoreBar && <Skeleton className="h-1.5 w-full rounded-full" />}
        {showSkills && (
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
        )}
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Skeleton className="h-3 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-14" />
          </div>
        </div>
      </div>
    </div>
  )
}

function JobCardSkeletonList({ count = 3, showScoreBar = false, showSkills = false }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <JobCardSkeleton key={i} showScoreBar={showScoreBar} showSkills={showSkills} />
      ))}
    </div>
  )
}

export { JobCardSkeleton, JobCardSkeletonList }
