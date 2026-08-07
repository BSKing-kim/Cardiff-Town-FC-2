import React from "react";

interface TeamLogoProps {
  teamName: string;
  size?: number;
  className?: string;
}

// Map of specific team IDs / names to distinct design configurations
interface CrestConfig {
  primaryColor: string;
  secondaryColor: string;
  borderColor: string;
  textColor: string;
  shape: "shield" | "circle" | "stripes" | "cross" | "diagonal" | "star";
  initials: string;
  symbol?: "crown" | "dragon" | "star" | "tiger" | "exile" | "ball" | "shield";
}

export default function TeamLogo({ teamName, size = 24, className = "" }: TeamLogoProps) {
  // Normalize team name to match keys
  const normName = teamName.trim().toLowerCase();

  // Helper to get initials
  const getInitials = (name: string): string => {
    const parts = name.split(/\s+/).filter(p => p.toLowerCase() !== "fc" && p.toLowerCase() !== "afc" && p.toLowerCase() !== "reserves" && p.toLowerCase() !== "combination");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Deterministic config based on name string hashing (as fallback)
  const getFallbackConfig = (name: string): CrestConfig => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const colors = [
      { primary: "#1E3A8A", secondary: "#F59E0B", border: "#D4AF37", text: "#FFFFFF" }, // Royal & Gold
      { primary: "#991B1B", secondary: "#111827", border: "#F3F4F6", text: "#FFFFFF" }, // Red & Black
      { primary: "#065F46", secondary: "#F3F4F6", border: "#047857", text: "#FFFFFF" }, // Green & White
      { primary: "#3730A3", secondary: "#F59E0B", border: "#6366F1", text: "#FFFFFF" }, // Indigo & Gold
      { primary: "#C2410C", secondary: "#111827", border: "#F97316", text: "#FFFFFF" }, // Orange & Black
      { primary: "#075985", secondary: "#E0F2FE", border: "#0284C7", text: "#FFFFFF" }, // Sky & Light Blue
      { primary: "#1E293B", secondary: "#D1D5DB", border: "#94A3B8", text: "#FFFFFF" }, // Slate & White
      { primary: "#5B21B6", secondary: "#F472B6", border: "#8B5CF6", text: "#FFFFFF" }, // Purple & Pink
      { primary: "#86198F", secondary: "#FAE8FF", border: "#D946EF", text: "#FFFFFF" }, // Magenta & White
      { primary: "#0369A1", secondary: "#FEF08A", border: "#38BDF8", text: "#FFFFFF" }  // Blue & Yellow
    ];

    const shapes: CrestConfig["shape"][] = ["shield", "circle", "stripes", "cross", "diagonal"];
    const symbols: CrestConfig["symbol"][] = ["star", "ball", "shield"];

    const colorScheme = colors[Math.abs(hash) % colors.length];
    const shape = shapes[Math.abs(hash >> 2) % shapes.length];
    const symbol = symbols[Math.abs(hash >> 4) % symbols.length];

    return {
      primaryColor: colorScheme.primary,
      secondaryColor: colorScheme.secondary,
      borderColor: colorScheme.border,
      textColor: colorScheme.text,
      shape,
      initials: getInitials(name),
      symbol
    };
  };

  // Specific custom designs for major CCFL teams
  let config: CrestConfig;

  if (normName.includes("cardiff town")) {
    // Cardiff Town FC - Blue, White, Gold (US)
    config = {
      primaryColor: "#0A2342", // Deep Royal Navy Blue
      secondaryColor: "#FFFFFF", // Crisp White
      borderColor: "#D4AF37", // Elegant Gold
      textColor: "#D4AF37",
      shape: "shield",
      initials: "CT",
      symbol: "dragon"
    };
  } else if (normName.includes("tiger bay")) {
    config = {
      primaryColor: "#111827",
      secondaryColor: "#F97316",
      borderColor: "#F97316",
      textColor: "#FFFFFF",
      shape: "stripes",
      initials: "TB",
      symbol: "tiger"
    };
  } else if (normName.includes("dragons")) {
    config = {
      primaryColor: "#990000",
      secondaryColor: "#E5A93B",
      borderColor: "#E5A93B",
      textColor: "#FFFFFF",
      shape: "shield",
      initials: "CFD",
      symbol: "dragon"
    };
  } else if (normName.includes("aberystwyth")) {
    config = {
      primaryColor: "#047857",
      secondaryColor: "#FFFFFF",
      borderColor: "#047857",
      textColor: "#FFFFFF",
      shape: "diagonal",
      initials: "AE",
      symbol: "exile"
    };
  } else if (normName.includes("treganna")) {
    config = {
      primaryColor: "#DC2626",
      secondaryColor: "#16A34A",
      borderColor: "#FFFFFF",
      textColor: "#FFFFFF",
      shape: "cross",
      initials: "CPDT",
      symbol: "dragon"
    };
  } else if (normName.includes("rumney")) {
    config = {
      primaryColor: "#EF4444",
      secondaryColor: "#FFFFFF",
      borderColor: "#DC2626",
      textColor: "#000000",
      shape: "shield",
      initials: "RUM",
      symbol: "ball"
    };
  } else if (normName.includes("forever young") || normName.includes("k&h")) {
    config = {
      primaryColor: "#6D28D9",
      secondaryColor: "#F59E0B",
      borderColor: "#D97706",
      textColor: "#FFFFFF",
      shape: "star",
      initials: "KH",
      symbol: "star"
    };
  } else if (normName.includes("cosmos")) {
    config = {
      primaryColor: "#0284C7",
      secondaryColor: "#111827",
      borderColor: "#38BDF8",
      textColor: "#FFFFFF",
      shape: "circle",
      initials: "NCC",
      symbol: "star"
    };
  } else if (normName.includes("pumas") || normName.includes("pontprennau")) {
    config = {
      primaryColor: "#1E3A8A",
      secondaryColor: "#FBBF24",
      borderColor: "#FBBF24",
      textColor: "#FFFFFF",
      shape: "shield",
      initials: "PP",
      symbol: "tiger"
    };
  } else if (normName.includes("fairwater")) {
    config = {
      primaryColor: "#2563EB",
      secondaryColor: "#FFFFFF",
      borderColor: "#1D4ED8",
      textColor: "#FFFFFF",
      shape: "diagonal",
      initials: "FW",
      symbol: "shield"
    };
  } else {
    config = getFallbackConfig(teamName);
  }

  // Adjust initials based on the team type (e.g. show 'R' for Reserves)
  if (normName.includes("reserves") || normName.includes("res.")) {
    config.initials = config.initials.substring(0, 2) + "R";
  }

  // Generate paths based on shape
  const renderCrestPattern = () => {
    switch (config.shape) {
      case "stripes":
        return (
          <>
            <path d="M10,4 L10,96 M30,4 L30,96 M50,4 L50,96 M70,4 L70,96 M90,4 L90,96" stroke={config.secondaryColor} strokeWidth="10" opacity="0.3" />
          </>
        );
      case "diagonal":
        return (
          <>
            <path d="M0,0 L100,100 M-20,20 L80,120 M20,-20 L120,80" stroke={config.secondaryColor} strokeWidth="12" opacity="0.4" />
          </>
        );
      case "cross":
        return (
          <>
            <path d="M50,0 L50,100 M0,50 L100,50" stroke={config.secondaryColor} strokeWidth="12" opacity="0.4" />
          </>
        );
      case "star":
        return (
          <>
            <polygon points="50,15 54,35 75,35 58,48 64,70 50,56 36,70 42,48 25,35 46,35" fill={config.secondaryColor} opacity="0.25" />
          </>
        );
      case "circle":
        return (
          <>
            <circle cx="50" cy="50" r="30" stroke={config.secondaryColor} strokeWidth="2" strokeDasharray="4 4" fill="none" opacity="0.5" />
          </>
        );
      default:
        // Shield vertical split
        return (
          <>
            <path d="M50,5 L90,25 L90,55 C90,80 50,95 50,95 Z" fill={config.secondaryColor} opacity="0.15" />
          </>
        );
    }
  };

  const renderSymbol = () => {
    switch (config.symbol) {
      case "dragon":
        return (
          // Welsh dragon simplified path
          <path d="M35,45 C38,40 45,35 55,35 C60,35 63,40 65,45 C60,48 55,48 50,52 C45,55 42,50 35,45 Z M42,45 C45,45 48,45 50,48 M52,42 C54,44 56,44 58,42" stroke={config.borderColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case "crown":
        return (
          <polygon points="35,58 38,42 46,50 50,40 54,50 62,42 65,58" fill="none" stroke={config.borderColor} strokeWidth="3" strokeLinejoin="round" />
        );
      case "tiger":
        return (
          <path d="M38,45 C41,43 45,42 50,42 C55,42 59,43 62,45 C58,48 55,51 50,51 C45,51 42,48 38,45 Z M45,42 L42,38 M55,42 L58,38" stroke={config.borderColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        );
      case "star":
        return (
          <polygon points="50,38 53,44 60,45 55,50 56,57 50,53 44,57 45,50 40,45 47,44" fill={config.borderColor} />
        );
      case "ball":
        return (
          <circle cx="50" cy="48" r="10" stroke={config.borderColor} strokeWidth="2" fill="none" />
        );
      case "exile":
        return (
          <path d="M40,40 L60,56 M60,40 L40,56" stroke={config.borderColor} strokeWidth="3" strokeLinecap="round" />
        );
      default:
        return (
          <path d="M50,38 L50,58 M40,48 L60,48" stroke={config.borderColor} strokeWidth="2.5" strokeLinecap="round" />
        );
    }
  };

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`shrink-0 select-none ${className}`}
      id={`team-logo-${normName.replace(/[^a-z0-9]/g, "-")}`}
    >
      <defs>
        <radialGradient id={`shield-shading-${normName}`} cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
        </radialGradient>
      </defs>

      {/* Main Shield Outline */}
      <path
        d="M10,20 L50,5 L90,20 L90,55 C90,80 50,95 50,95 C50,95 10,80 10,55 Z"
        fill={config.primaryColor}
        stroke={config.borderColor}
        strokeWidth="5"
        strokeLinejoin="round"
      />

      {/* Pattern Overlay */}
      <g clipPath={`url(#shield-clip-${normName})`}>
        {renderCrestPattern()}
      </g>

      {/* Symbol / Crest Centerpiece */}
      <g>{renderSymbol()}</g>

      {/* Team Initials */}
      <text
        x="50"
        y="78"
        fontFamily="sans-serif"
        fontSize="16"
        fontWeight="bold"
        fill={config.textColor}
        textAnchor="middle"
        letterSpacing="0.5"
      >
        {config.initials}
      </text>

      {/* Subtle overlay shading for 3D depth */}
      <path
        d="M10,20 L50,5 L90,20 L90,55 C90,80 50,95 50,95 C50,95 10,80 10,55 Z"
        fill={`url(#shield-shading-${normName})`}
        pointerEvents="none"
      />
    </svg>
  );
}
