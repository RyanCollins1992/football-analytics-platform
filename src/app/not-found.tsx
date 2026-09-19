import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        Nothing here — either the URL is wrong, or the id it references doesn&rsquo;t exist in the database.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/50 hover:text-black dark:border-white/10 dark:text-white/50 dark:hover:text-white"
      >
        &larr; Back to dashboard
      </Link>
    </div>
  );
}
