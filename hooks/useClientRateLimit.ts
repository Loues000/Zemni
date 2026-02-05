import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Client-side rate limiting for better UX
 * Prevents accidental double-clicks and reduces unnecessary network traffic
 * 
 * Note: This is NOT for security - server-side rate limiting handles that.
 * This is purely for UX improvement.
 */
export interface UseClientRateLimitReturn {
  /**
   * Wrapped function that enforces rate limiting
   */
  execute: () => Promise<void>;
  /**
   * Whether the function is currently rate-limited (cooldown active)
   */
  isRateLimited: boolean;
  /**
   * Time remaining in cooldown (in seconds)
   */
  cooldownRemaining: number;
  /**
   * Whether a request is currently in progress
   */
  isExecuting: boolean;
}

interface UseClientRateLimitOptions {
  /**
   * Minimum time between requests in milliseconds
   * Default: 2000ms (2 seconds)
   */
  minInterval?: number;
  /**
   * Function to execute
   */
  fn: () => Promise<void> | void;
}

/**
 * Provide a client-side rate-limited wrapper around a function.
 *
 * Enforces a minimum interval between invocations, prevents concurrent executions,
 * and exposes cooldown state.
 *
 * @param fn - The function to invoke when `execute` is called.
 * @param minInterval - Minimum time in milliseconds required between successive executions. Defaults to 2000.
 * @returns An object with:
 *   - `execute`: a function that invokes `fn` while enforcing the rate limit and ignoring calls during cooldown or concurrent execution.
 *   - `isRateLimited`: `true` if a cooldown is active, `false` otherwise.
 *   - `cooldownRemaining`: the number of whole seconds remaining in the current cooldown.
 *   - `isExecuting`: `true` while `fn` is running, `false` otherwise.
 */
export function useClientRateLimit({
  fn,
  minInterval = 2000
}: UseClientRateLimitOptions): UseClientRateLimitReturn {
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const lastExecutionRef = useRef<number>(0);
  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  // Update cooldown remaining every second
  useEffect(() => {
    if (!isRateLimited) {
      setCooldownRemaining(0);
      return;
    }

    const updateCooldown = () => {
      const now = Date.now();
      const elapsed = now - lastExecutionRef.current;
      const remaining = Math.max(0, minInterval - elapsed);
      
      if (remaining <= 0) {
        setIsRateLimited(false);
        setCooldownRemaining(0);
        if (cooldownTimerRef.current) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
        }
      } else {
        setCooldownRemaining(Math.ceil(remaining / 1000));
      }
    };

    // Update immediately
    updateCooldown();

    // Then update every second
    cooldownTimerRef.current = setInterval(updateCooldown, 1000);

    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [isRateLimited, minInterval]);

  const execute = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionRef.current;

    // Check if we're still in cooldown
    if (timeSinceLastExecution < minInterval) {
      // Still in cooldown - don't execute
      return;
    }

    // Check if already executing
    if (isExecuting) {
      // Already executing - don't start another
      return;
    }

    // Execute the function
    setIsExecuting(true);
    lastExecutionRef.current = now;
    setIsRateLimited(true);
    setCooldownRemaining(Math.ceil(minInterval / 1000));

    try {
      await fn();
    } finally {
      setIsExecuting(false);
      // Cooldown will be handled by the useEffect
    }
  }, [fn, minInterval, isExecuting]);

  return {
    execute,
    isRateLimited,
    cooldownRemaining,
    isExecuting
  };
}