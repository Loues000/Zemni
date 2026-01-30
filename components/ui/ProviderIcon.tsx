interface ProviderIconProps {
  provider: string;
  className?: string;
}

/**
 * Simple SVG icons for AI model providers
 */
export function ProviderIcon({ provider, className = "" }: ProviderIconProps) {
  const normalizedProvider = provider.toLowerCase();
  
  // Simple colored circles/rectangles as placeholders
  // In production, you might want to use actual brand logos
  const getIcon = () => {
    switch (normalizedProvider) {
      case "openai":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <circle cx="12" cy="12" r="10" fill="#10a37f" />
            <path d="M12 8v8M8 12h8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "anthropic":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#d4a574" />
            <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "google":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <circle cx="12" cy="12" r="10" fill="#4285f4" />
            <path d="M12 7v5l4-2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        );
      case "x-ai":
      case "xai":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#000000" />
            <path d="M8 8l8 8M16 8l-8 8" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
      case "moonshotai":
      case "moonshot":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <circle cx="12" cy="12" r="10" fill="#6366f1" />
            <circle cx="12" cy="12" r="4" fill="white" />
          </svg>
        );
      case "deepseek":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#3b82f6" />
            <path d="M8 12h8M12 8v8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case "z-ai":
      case "zai":
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <rect x="4" y="4" width="16" height="16" rx="2" fill="#8b5cf6" />
            <path d="M8 8l8 8M8 16l8-8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      default:
        return (
          <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={{ width: "20px", height: "20px" }}>
            <circle cx="12" cy="12" r="10" fill="var(--text-muted)" />
            <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
              {provider[0]?.toUpperCase() || "?"}
            </text>
          </svg>
        );
    }
  };

  return getIcon();
}
