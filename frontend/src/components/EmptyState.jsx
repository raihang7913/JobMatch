function EmptyState({ icon: Icon, title, description, action, actionLabel, onAction }) {
  return (
    <div className="bg-card border border-border shadow-sm rounded-lg p-12 text-center transition-all duration-200 card-hover">
      {Icon && (
        <Icon
          size={40}
          weight="duotone"
          className="text-secondary-600 dark:text-secondary-400 mx-auto mb-4"
        />
      )}
      <h3 className="text-h3 font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-small text-muted-foreground mb-6 max-w-md mx-auto">{description}</p>
      {action ? (
        action
      ) : onAction && actionLabel ? (
        <button
          onClick={onAction}
          className="inline-flex items-center justify-center border border-border text-foreground hover:bg-muted active:scale-[0.98] font-medium px-6 py-2.5 rounded-lg transition-all duration-200 text-small shadow-sm hover:shadow-base"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export { EmptyState }
