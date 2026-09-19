interface PlaceholderPageProps {
  title: string;
  phase: string;
  description: string;
}

/**
 * Deliberately not fake data — a plain "not built yet" state per each
 * section's real phase, rather than a UI that implies data exists.
 */
export function PlaceholderPage({ title, phase, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">{description}</p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/50 dark:border-white/10 dark:text-white/50">
        Coming in {phase}
      </div>
    </div>
  );
}
