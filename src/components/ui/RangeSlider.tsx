"use client";

import { useRef, useEffect, useCallback } from "react";

interface RangeSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * RangeSlider with proper pointer capture to prevent "sticky drag" bugs on Mac/trackpad.
 * 
 * Features:
 * - Proper pointer capture/release
 * - Global cleanup on window pointerup/mouseup (safety-net)
 * - Handles all edge cases: pointercancel, mouseleave, blur
 * - No "sticky" behavior after releasing mouse/trackpad
 */
export function RangeSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  className = "",
  disabled = false,
}: RangeSliderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);

  // Handle value change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onChange(newValue);
    },
    [onChange]
  );

  // Start drag: capture pointer
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    if (disabled) return;

    isDraggingRef.current = true;

    // Capture pointer to ensure we receive all pointer events
    // even if the pointer moves outside the element
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        // Ignore capture errors (some browsers don't support it)
      }
    }
  }, [disabled]);

  // End drag: release pointer and cleanup
  const endDrag = useCallback((target: HTMLInputElement | null, pointerId?: number) => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;

    // Release pointer capture
    if (target && pointerId !== undefined && target.releasePointerCapture) {
      try {
        target.releasePointerCapture(pointerId);
      } catch (err) {
        // Ignore release errors
      }
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      endDrag(e.currentTarget, e.pointerId);
    },
    [endDrag]
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLInputElement>) => {
      endDrag(e.currentTarget, e.pointerId);
    },
    [endDrag]
  );

  // Fallback for browsers without Pointer Events
  const handleMouseUp = useCallback(() => {
    endDrag(inputRef.current, undefined);
  }, [endDrag]);

  const handleMouseLeave = useCallback(() => {
    // End drag if mouse leaves the slider area
    endDrag(inputRef.current, undefined);
  }, [endDrag]);

  const handleBlur = useCallback(() => {
    // End drag if focus is lost
    endDrag(inputRef.current, undefined);
  }, [endDrag]);

  // Global safety-net: cleanup on window events
  useEffect(() => {
    const cleanup = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        // Note: we can't call releasePointerCapture here without pointerId,
        // but at least we reset the state
      }
    };

    // Listen to window events to catch edge cases
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("mouseup", cleanup);
    window.addEventListener("blur", cleanup);

    return () => {
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("mouseup", cleanup);
      window.removeEventListener("blur", cleanup);
      
      // Final cleanup on unmount
      cleanup();
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleChange}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
    />
  );
}

