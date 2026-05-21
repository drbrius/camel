import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camel_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('camel_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('camel_theme', 'light');
    }
  }, [theme]);

  return (
    <button
      id="theme-toggle-btn"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2.5 rounded-xl border border-clay/15 bg-sand/40 hover:bg-sand/80 text-clay transition-all dark:border-sand/15 dark:bg-white/5 dark:hover:bg-white/10 dark:text-sand focus:outline-none focus:ring-2 focus:ring-terracotta/30 flex items-center gap-2 text-xs font-medium cursor-pointer"
      title="Toggle Light/Dark Theme"
    >
      {theme === 'light' ? (
        <>
          <Moon size={15} />
          <span>Desert Night</span>
        </>
      ) : (
        <>
          <Sun size={15} />
          <span>Desert Sun</span>
        </>
      )}
    </button>
  );
}
