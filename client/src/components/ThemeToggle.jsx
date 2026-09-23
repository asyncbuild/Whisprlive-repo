import React, { useState, useRef, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({
  className = '',
  style = {},
  iconSize = 15,
  variant = 'button', // 'button' | 'slider'
  showLabel = false,
  ariaLabel = 'Toggle theme'
}) {
  const { isDark, toggleTheme, setTheme } = useTheme();

  const trackRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startThemeRef = useRef(false); // Was dark when drag started?
  const hasMoveRef = useRef(false);
  const [visualOffset, setVisualOffset] = useState(null); // null = use isDark state

  const TRAVEL = 28;

  const commitTheme = useCallback((offset) => {
    if (offset > TRAVEL / 2) {
      if (!isDark) setTheme('dark');
    } else {
      if (isDark) setTheme('light');
    }
  }, [isDark, setTheme]);

  const onPointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    const el = trackRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    hasMoveRef.current = false;
    startXRef.current = e.clientX;
    startThemeRef.current = isDark;
    setVisualOffset(isDark ? TRAVEL : 0);
  };

  const onPointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 2) hasMoveRef.current = true;
    const base = startThemeRef.current ? TRAVEL : 0;
    setVisualOffset(Math.max(0, Math.min(TRAVEL, base + dx)));
  };

  const onPointerUp = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const el = trackRef.current;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch {}
    }

    if (hasMoveRef.current && visualOffset !== null) {
      commitTheme(visualOffset);
    } else {
      // Simple tap — just toggle
      toggleTheme();
    }
    setVisualOffset(null);
  };

  const onPointerCancel = () => {
    isDraggingRef.current = false;
    setVisualOffset(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setTheme('dark'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setTheme('light'); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleTheme(); }
  };

  // ─── WIDE SLIDER VARIANT (full-width segmented toggle) ───
  if (variant === 'wide-slider') {
    return (
      <div
        ref={trackRef}
        className={`wide-theme-track ${isDark ? 'is-dark' : 'is-light'} ${className}`}
        role="switch"
        aria-checked={isDark}
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={style}
      >
        <div
          className="wide-theme-highlight"
          style={{
            transform: visualOffset !== null
              ? `translateX(${(visualOffset / TRAVEL) * 100}%)`
              : isDark ? 'translateX(100%)' : 'translateX(0%)'
          }}
        />
        <button
          type="button"
          className={`wide-theme-option ${!isDark && visualOffset === null ? 'is-active' : ''}`}
          onClick={() => setTheme('light')}
          tabIndex={-1}
        >
          <Sun size={14} />
          <span>Light</span>
        </button>
        <button
          type="button"
          className={`wide-theme-option ${isDark && visualOffset === null ? 'is-active' : ''}`}
          onClick={() => setTheme('dark')}
          tabIndex={-1}
        >
          <Moon size={14} />
          <span>Dark</span>
        </button>
      </div>
    );
  }

  // ─── SLIDER VARIANT ───
  if (variant === 'slider' || showLabel) {
    const knobX = visualOffset !== null ? visualOffset : (isDark ? TRAVEL : 0);
    const dragging = visualOffset !== null;

    return (
      <div
        className={`theme-slider-wrapper ${className}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, ...style }}
      >
        <div
          ref={trackRef}
          role="switch"
          aria-checked={isDark}
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className={`theme-slider-track ${isDark ? 'is-dark' : 'is-light'}`}
        >
          <span className="theme-slider-hint theme-slider-hint-left">
            <Sun size={11} style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#F59E0B' }} />
          </span>
          <span className="theme-slider-hint theme-slider-hint-right">
            <Moon size={11} style={{ color: isDark ? '#A5B4FC' : 'rgba(0,0,0,0.3)' }} />
          </span>
          <div
            className={`theme-slider-thumb ${isDark ? 'is-dark' : 'is-light'} ${dragging ? 'is-dragging' : ''}`}
            style={{ transform: `translateX(${knobX}px)` }}
          >
            {isDark
              ? <Moon size={12} className="theme-thumb-icon" style={{ color: '#818CF8' }} />
              : <Sun size={12} className="theme-thumb-icon" style={{ color: '#D97706' }} />
            }
          </div>
        </div>

        {showLabel && (
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-dim)', userSelect: 'none' }}>
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
        )}
      </div>
    );
  }

  // ─── COMPACT ICON BUTTON ───
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
        {isDark
          ? <Sun size={iconSize} className="theme-icon theme-icon-sun" style={{ color: '#FBBF24' }} />
          : <Moon size={iconSize} className="theme-icon theme-icon-moon" style={{ color: 'var(--text-dim)' }} />
        }
      </div>
    </button>
  );
}
