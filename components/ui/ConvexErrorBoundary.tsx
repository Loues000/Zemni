"use client";

import React from "react";
import { trackError } from "@/lib/error-tracking";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  isNetworkError: boolean;
}

/**
 * Convex Error Boundary
 * 
 * Catches React errors related to Convex/database operations.
 * Shows a database-specific fallback UI with retry options.
 * 
 * Usage: Wrap Convex-dependent components:
 * ```tsx
 * <ConvexErrorBoundary>
 *   <HistorySidebar />
 * </ConvexErrorBoundary>
 * ```
 */
export class ConvexErrorBoundary extends React.Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isNetworkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isNetworkError = 
      error.message?.includes("network") ||
      error.message?.includes("fetch") ||
      error.message?.includes("WebSocket") ||
      error.message?.includes("connection") ||
      error.message?.includes("timeout");
    
    return { 
      hasError: true, 
      error,
      isNetworkError 
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Track error
    trackError(error, {
      metadata: {
        componentStack: errorInfo.componentStack,
        retryCount: this.retryCount,
        isNetworkError: this.state.isNetworkError,
      },
    });

    // Show toast notification
    if (this.state.isNetworkError) {
      toast.error("Connection error", {
        description: "Failed to connect to the database. Retrying...",
        duration: 5000,
      });
    } else {
      toast.error("Database error", {
        description: "An error occurred while accessing your data.",
        duration: 5000,
      });
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry for network errors
    if (this.state.isNetworkError && this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.pow(2, this.retryCount) * 1000;
      
      setTimeout(() => {
        this.setState({ hasError: false });
      }, delay);
    }
  }

  handleRetry = () => {
    this.retryCount = 0;
    this.setState({ hasError: false, error: undefined, isNetworkError: false });
    toast.info("Retrying...");
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRetrying = this.state.isNetworkError && this.retryCount < this.maxRetries;

      return (
        <div className="convex-error-boundary">
          <div className="convex-error-content">
            <div className="convex-error-icon">
              <svg 
                width="48" 
                height="48" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className={this.state.isNetworkError ? "text-yellow-500" : "text-red-500"}
              >
                {this.state.isNetworkError ? (
                  <>
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </>
                ) : (
                  <>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </>
                )}
              </svg>
            </div>
            
            <h2 className="convex-error-title">
              {this.state.isNetworkError ? "Connection Issue" : "Database Error"}
            </h2>
            
            <p className="convex-error-message">
              {this.state.isNetworkError 
                ? "We're having trouble connecting to the database. Your changes are saved locally and will sync when the connection is restored."
                : "An unexpected error occurred while accessing your data. We've been notified and are working on a fix."
              }
            </p>

            {this.state.error && process.env.NODE_ENV === "development" && (
              <pre className="convex-error-details">
                {this.state.error.message}
              </pre>
            )}

            <div className="convex-error-actions">
              {!isRetrying && (
                <button
                  onClick={this.handleRetry}
                  className="btn btn-primary"
                  disabled={isRetrying}
                >
                  {isRetrying ? "Retrying..." : "Try Again"}
                </button>
              )}
              
              <button
                onClick={this.handleReload}
                className="btn btn-secondary"
              >
                Reload Page
              </button>
            </div>

            {isRetrying && (
              <p className="convex-error-retry-status">
                Retrying automatically... (Attempt {this.retryCount}/{this.maxRetries})
              </p>
            )}
          </div>

          <style jsx>{`
            .convex-error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 300px;
              padding: 2rem;
            }
            
            .convex-error-content {
              max-width: 500px;
              text-align: center;
            }
            
            .convex-error-icon {
              margin-bottom: 1rem;
            }
            
            .convex-error-title {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 0.5rem;
              color: var(--text-primary);
            }
            
            .convex-error-message {
              color: var(--text-secondary);
              margin-bottom: 1.5rem;
              line-height: 1.6;
            }
            
            .convex-error-details {
              background: var(--bg-secondary);
              padding: 1rem;
              border-radius: 8px;
              font-size: 0.875rem;
              color: var(--text-danger);
              margin-bottom: 1.5rem;
              text-align: left;
              overflow-x: auto;
            }
            
            .convex-error-actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
            }
            
            .convex-error-retry-status {
              margin-top: 1rem;
              font-size: 0.875rem;
              color: var(--text-secondary);
            }
            
            .btn {
              padding: 0.75rem 1.5rem;
              border-radius: 8px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s;
            }
            
            .btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
            
            .btn-primary {
              background: var(--primary);
              color: white;
              border: none;
            }
            
            .btn-primary:hover:not(:disabled) {
              background: var(--primary-hover);
            }
            
            .btn-secondary {
              background: transparent;
              color: var(--text-primary);
              border: 1px solid var(--border);
            }
            
            .btn-secondary:hover {
              background: var(--bg-hover);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
