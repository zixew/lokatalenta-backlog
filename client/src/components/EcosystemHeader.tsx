import { Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { ECOSYSTEM_LINKS } from '../lib/presentation.ts';

interface EcosystemHeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  totalItems: number;
}

export function EcosystemHeader({
  isDark,
  onToggleTheme,
  totalItems,
}: EcosystemHeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E3DC] bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-[#161B22]/95">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-800/20 bg-[#0F766E] text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <rect x="3" y="4" width="7" height="7" rx="1.5" fill="#FFFFFF" />
              <rect x="14" y="4" width="7" height="7" rx="1.5" fill="#99F6E4" />
              <rect x="3" y="14" width="7" height="6" rx="1.5" fill="#FDE68A" />
              <rect x="14" y="14" width="7" height="6" rx="1.5" fill="#FFFFFF" fillOpacity="0.85" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-slate-100">
                LokaTalenta
              </span>
              <span className="rounded-full border border-[#E5E3DC] bg-[#F6F5F1] px-2 py-0.5 text-[11px] font-medium text-zinc-600 font-mono-tabular dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {totalItems} items
              </span>
            </div>
            <p className="truncate text-xs text-zinc-600 dark:text-slate-400">
              Backlog &amp; Multi-Agent Grooming
            </p>
          </div>
        </div>

        <nav
          aria-label="Ecosystem switcher"
          data-testid="ecosystem-switcher"
          className="hidden items-center gap-1 lg:flex"
        >
          {ECOSYSTEM_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              data-testid={link.testId}
              aria-current={link.active ? 'page' : undefined}
              className={
                link.active
                  ? 'rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-[#0F766E] transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-400 dark:focus-visible:ring-teal-500'
                  : 'rounded-lg border border-transparent px-3 py-1.5 text-sm font-medium text-zinc-700 transition-all duration-200 ease-out hover:border-[#E5E3DC] hover:bg-[#F6F5F1] hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 dark:text-slate-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white dark:focus-visible:ring-teal-500'
              }
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="theme-toggle"
            aria-label="Toggle dark mode"
            onClick={onToggleTheme}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E5E3DC] bg-white px-2.5 text-zinc-700 transition-all duration-200 ease-out hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 lg:min-h-[36px] lg:min-w-[36px] dark:border-zinc-700 dark:bg-[#161B22] dark:text-slate-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-teal-500"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            data-testid="mobile-menu-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E5E3DC] bg-white text-zinc-700 transition-all duration-200 ease-out hover:bg-[#F6F5F1] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 lg:hidden dark:border-zinc-700 dark:bg-[#161B22] dark:text-slate-200 dark:hover:bg-zinc-800"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile ecosystem switcher"
          className="border-t border-[#E5E3DC] bg-white px-4 py-3 lg:hidden dark:border-zinc-800 dark:bg-[#161B22]"
        >
          <div className="flex flex-col gap-1.5">
            {ECOSYSTEM_LINKS.map((link) => (
              <a
                key={link.id}
                href={link.href}
                aria-current={link.active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
                className={
                  link.active
                    ? 'flex min-h-[44px] items-center rounded-lg border border-teal-200 bg-teal-50 px-3 text-sm font-semibold text-[#0F766E] dark:border-teal-800 dark:bg-teal-950/60 dark:text-teal-400'
                    : 'flex min-h-[44px] items-center rounded-lg border border-[#E5E3DC] px-3 text-sm font-medium text-zinc-700 hover:bg-[#F6F5F1] dark:border-zinc-800 dark:text-slate-200 dark:hover:bg-zinc-800'
                }
              >
                {link.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
