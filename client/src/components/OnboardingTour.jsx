import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  CheckCircle2,
  HelpCircle
} from "lucide-react";

const TOUR_STEPS = [
  {
    id: "step_title",
    stepNumber: 1,
    tag: "Room Setup",
    title: "Event Title & 1-Click Presets",
    description:
      "Enter a custom name for your presentation or click quick presets (Keynote Q&A, Classroom Lecture, AMA) to auto-fill in 1 second.",
    targetId: "tour-target-title",
    placement: "bottom",
    tab: "new"
  },
  {
    id: "step_duration",
    stepNumber: 2,
    tag: "Duration & Timing",
    title: "Duration & Scheduled Start",
    description:
      "Choose room duration from 5 minutes to 24 hours, or schedule the room to unlock automatically for a specific future start time.",
    targetId: "tour-target-duration",
    placement: "bottom",
    tab: "new"
  },
  {
    id: "step_feed_toggle",
    stepNumber: 3,
    tag: "Audience Privacy",
    title: "Audience Live Feed Visibility",
    description:
      "Control whether attendees can see all approved questions and upvote live, or keep question submissions private to the host.",
    targetId: "tour-target-feed-toggle",
    placement: "top",
    tab: "new"
  },
  {
    id: "step_polls",
    stepNumber: 4,
    tag: "Interactive Polls",
    title: "Polls & Word Cloud Library",
    description:
      "Prepare multiple-choice polls or live organic word clouds beforehand so you can launch them to attendees mid-presentation with 1 click.",
    targetId: "tour-target-polls-banner",
    fallbackTargetId: "tour-target-polls-tab",
    placement: "top",
    tab: "new"
  },
  {
    id: "step_tabs",
    stepNumber: 5,
    tag: "Session Navigation",
    title: "Active Rooms & Past Analytics",
    description:
      "Switch between starting new rooms, moderating active live sessions with real-time upvotes, and viewing full post-session recap reports.",
    targetId: "tour-target-tabs",
    placement: "bottom",
    tab: "new"
  },
  {
    id: "step_profile",
    stepNumber: 6,
    tag: "Host Profile & Tier",
    title: "Host Profile & Room Passes",
    description:
      "View your active plan (Solo, Host, Studio) and available 24-hour Room Passes, upgrade anytime, and switch between dark and light themes.",
    targetId: "tour-target-profile",
    placement: "bottom",
    tab: "new"
  }
];

export default function OnboardingTour({ isOpen, onClose, onFinish, onSetTab }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, placement: "bottom" });
  const popoverRef = useRef(null);

  const totalSteps = TOUR_STEPS.length;
  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  // Auto-switch tab if step requires it
  useEffect(() => {
    if (!isOpen || !currentStep) return;
    if (currentStep.tab && onSetTab) {
      onSetTab(currentStep.tab);
    }
  }, [isOpen, currentStepIndex, currentStep, onSetTab]);

  // Update target bounding box and calculate popover position
  const updatePosition = useCallback(() => {
    if (!isOpen || !currentStep) return;

    let targetEl = document.getElementById(currentStep.targetId);
    if (!targetEl && currentStep.fallbackTargetId) {
      targetEl = document.getElementById(currentStep.fallbackTargetId);
    }

    if (!targetEl) {
      // Fallback center position if target not found
      setTargetRect(null);
      setPopoverPos({
        top: window.innerHeight / 2 - 120,
        left: window.innerWidth / 2 - 170,
        placement: "center"
      });
      return;
    }

    // Scroll element smoothly into view if out of viewport
    const rect = targetEl.getBoundingClientRect();
    const isOutOfView =
      rect.top < 80 || rect.bottom > window.innerHeight - 80;

    if (isOutOfView) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }

    // Capture updated rect
    const freshRect = targetEl.getBoundingClientRect();
    setTargetRect(freshRect);

    // Calculate Popover Position
    const popoverWidth = popoverRef.current?.offsetWidth || 340;
    const popoverHeight = popoverRef.current?.offsetHeight || 220;
    const padding = 14;

    let placement = currentStep.placement || "bottom";
    let top = 0;
    let left = freshRect.left + freshRect.width / 2 - popoverWidth / 2;

    // Check vertical space
    if (placement === "bottom") {
      if (freshRect.bottom + popoverHeight + padding > window.innerHeight && freshRect.top - popoverHeight - padding > 0) {
        placement = "top";
      }
    } else if (placement === "top") {
      if (freshRect.top - popoverHeight - padding < 0 && freshRect.bottom + popoverHeight + padding < window.innerHeight) {
        placement = "bottom";
      }
    }

    if (placement === "bottom") {
      top = freshRect.bottom + padding;
    } else {
      top = freshRect.top - popoverHeight - padding;
    }

    // Clamp horizontal position within screen bounds
    const minLeft = 16;
    const maxLeft = window.innerWidth - popoverWidth - 16;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    // Clamp vertical position
    top = Math.max(16, Math.min(top, window.innerHeight - popoverHeight - 16));

    setPopoverPos({ top, left, placement });
  }, [isOpen, currentStep]);

  // Recalculate on step change, resize, and scroll
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(updatePosition, 100);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, currentStepIndex, updatePosition]);

  // Keyboard navigation: Left/Right arrows & Escape
  const handleKeyDown = useCallback(
    (e) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight" || e.key === "KeyD") {
        e.preventDefault();
        if (currentStepIndex < totalSteps - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          handleComplete();
        }
      } else if (e.key === "ArrowLeft" || e.key === "KeyA") {
        e.preventDefault();
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    },
    [isOpen, currentStepIndex, totalSteps]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleComplete = () => {
    if (onFinish) onFinish();
    if (onClose) onClose();
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <div className="tour-spotlight-root">
      {/* SVG Mask: The background is dimmed, while the target feature is 100% crystal-clear and unblurred */}
      <svg className="tour-spotlight-svg" aria-hidden="true">
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="12"
                ry="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(11, 15, 25, 0.68)"
          mask="url(#tour-spotlight-mask)"
          onClick={handleClose}
          style={{ pointerEvents: "auto", cursor: "pointer" }}
        />
      </svg>

      {/* Target Element Highlight Ring around the transparent cutout */}
      {targetRect && (
        <div
          className="tour-target-highlight"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12
          }}
        />
      )}

      {/* Floating Popover Tooltip Widget */}
      <div
        ref={popoverRef}
        className={`tour-popover-widget tour-placement-${popoverPos.placement}`}
        style={{
          top: popoverPos.top,
          left: popoverPos.left
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-widget-title"
      >
        {/* Pointer Arrow */}
        {targetRect && popoverPos.placement !== "center" && (
          <div
            className={`tour-popover-arrow arrow-${popoverPos.placement}`}
            style={{
              left: Math.max(20, Math.min(targetRect.left + targetRect.width / 2 - popoverPos.left, 320))
            }}
          />
        )}

        {/* Popover Header */}
        <div className="tour-widget-head">
          <div className="tour-widget-badges">
            <span className="tour-widget-step-pill">
              {currentStep.stepNumber} of {totalSteps}
            </span>
            <span className="tour-widget-tag-pill">{currentStep.tag}</span>
          </div>
          <button
            className="tour-widget-close"
            onClick={handleClose}
            title="Skip tour (Esc)"
            aria-label="Close tour"
          >
            <X size={15} />
          </button>
        </div>

        {/* Popover Body */}
        <div className="tour-widget-body">
          <h3 id="tour-widget-title" className="tour-widget-title">
            {currentStep.title}
          </h3>
          <p className="tour-widget-desc">{currentStep.description}</p>
        </div>

        {/* Popover Footer Controls: Back (<), Dots, Next (>) */}
        <div className="tour-widget-footer">
          {/* Step Dots */}
          <div className="tour-widget-dots">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                className={`tour-widget-dot ${idx === currentStepIndex ? "active" : ""} ${idx < currentStepIndex ? "completed" : ""}`}
                onClick={() => setCurrentStepIndex(idx)}
                title={`Step ${idx + 1}: ${step.title}`}
                aria-label={`Go to step ${idx + 1}`}
              >
                <span className="tour-dot-core" />
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="tour-widget-actions">
            <button
              type="button"
              className="btn btn-secondary btn-xs tour-btn-prev"
              onClick={handlePrev}
              disabled={isFirstStep}
              title="Previous feature (<)"
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>

            <button
              type="button"
              className="btn btn-primary btn-xs tour-btn-next"
              onClick={handleNext}
              title={isLastStep ? "Complete tour" : "Next feature (>)"}
            >
              {isLastStep ? (
                <span>Get Started</span>
              ) : (
                <>
                  <span>Next</span>
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
