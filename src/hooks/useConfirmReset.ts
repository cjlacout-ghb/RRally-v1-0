import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseConfirmResetOptions {
  /** The action to execute on confirmed reset (or immediate reset if nothing to lose) */
  onReset: () => void;
  /**
   * Predicate indicating whether there is race progress to lose.
   * Can be a boolean or a function returning boolean.
   */
  hasSomethingToLose: boolean | (() => boolean);
  /** Whether the parent screen/tab is currently visible */
  isVisible?: boolean;
}

export interface UseConfirmResetResult {
  /** Whether the reset button is currently armed */
  isArmed: boolean;
  /** Current button text: 'REINICIAR' or 'CONFIRMAR' */
  buttonLabel: 'REINICIAR' | 'CONFIRMAR';
  /** Click handler for the reset button */
  handleResetClick: () => void;
  /** Explicitly disarm the button (e.g., when another control is tapped) */
  disarm: () => void;
  /** Ref to attach to the reset button element for outside click detection */
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

export const CONFIRM_RESET_TIMEOUT_MS = 4000;

/**
 * Shared hook managing the two-step confirmation cycle for the main race stopwatch REINICIAR button.
 *
 * Flow:
 * - If there is nothing to lose (elapsed === 0 and no marks/skips), resets immediately.
 * - If there is something to lose, first tap arms the button (label -> CONFIRMAR, primary border).
 * - Second tap while armed executes onReset and disarms.
 * - Automatically disarms after 4 seconds without resetting.
 * - Disarms immediately if any other control is tapped, screen/tab becomes hidden, or on unmount.
 * - State is purely local UI state: never persisted in localStorage or race state.
 */
export function useConfirmReset({
  onReset,
  hasSomethingToLose,
  isVisible = true,
}: UseConfirmResetOptions): UseConfirmResetResult {
  const [isArmed, setIsArmed] = useState(false);
  const timerRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const disarm = useCallback(() => {
    clearTimer();
    setIsArmed(false);
  }, [clearTimer]);

  const handleResetClick = useCallback(() => {
    if (isArmed) {
      disarm();
      onReset();
    } else {
      const somethingToLose =
        typeof hasSomethingToLose === 'function'
          ? hasSomethingToLose()
          : hasSomethingToLose;

      if (somethingToLose) {
        setIsArmed(true);
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          setIsArmed(false);
          timerRef.current = null;
        }, CONFIRM_RESET_TIMEOUT_MS);
      } else {
        onReset();
      }
    }
  }, [isArmed, disarm, onReset, hasSomethingToLose, clearTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  // Disarm whenever visibility changes to false
  useEffect(() => {
    if (!isVisible) {
      disarm();
    }
  }, [isVisible, disarm]);

  // Disarm when the user taps any other control or clicks outside the button
  useEffect(() => {
    if (!isArmed) return;

    const handleOutsideInteraction = (event: Event) => {
      const target = event.target as Node | null;
      if (buttonRef.current && target && buttonRef.current.contains(target)) {
        return;
      }
      disarm();
    };

    document.addEventListener('pointerdown', handleOutsideInteraction, true);
    document.addEventListener('click', handleOutsideInteraction, true);

    return () => {
      document.removeEventListener('pointerdown', handleOutsideInteraction, true);
      document.removeEventListener('click', handleOutsideInteraction, true);
    };
  }, [isArmed, disarm]);

  return {
    isArmed,
    buttonLabel: isArmed ? 'CONFIRMAR' : 'REINICIAR',
    handleResetClick,
    disarm,
    buttonRef,
  };
}
