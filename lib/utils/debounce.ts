/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Creates a debounced function that returns a promise
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeout: NodeJS.Timeout | null = null;
  let latestArgs: Parameters<T> | null = null;
  let resolve: ((value: ReturnType<T>) => void) | null = null;
  let reject: ((error: any) => void) | null = null;

  return function executedFunction(...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((res, rej) => {
      latestArgs = args;
      resolve = res;
      reject = rej;

      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(async () => {
        timeout = null;
        try {
          const result = await func(...(latestArgs as Parameters<T>));
          if (resolve) resolve(result);
        } catch (error) {
          if (reject) reject(error);
        }
      }, wait);
    });
  };
}
