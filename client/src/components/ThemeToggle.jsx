import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({
  className = '',
  style = {},
  iconSize = 16,
  showLabel = false,
  ariaLabel = 'Toggle theme'
}) {
  const { theme, isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`icon-btn theme-toggle-btn ${isDark ? 'is-dark' : 'is-light'} ${className}`}
      onClick={toggleTheme}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={ariaLabel}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...style
      }}
    >
      <div className="theme-toggle-icon-wrap" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {isDark ? (
          <Sun size={iconSize} className="theme-icon theme-icon-sun" style={{ color: '#FBBF24' }} />
        ) : (
          <Moon size={iconSize} className="theme-icon theme-icon-moon" style={{ color: 'var(--text-dim)' }} />
        )}
      </div>
      {showLabel && (
        <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 8 }}>
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
}
