import Link from "next/link";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Gopax home">
      <img src="/logo.svg" width="38" height="38" alt="" />
      {!compact && (
        <span>
          gopax<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}
export function RouteArt({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "route-art small" : "route-art"}
      viewBox="0 0 560 480"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={small ? "hillSmall" : "hill"}
          x1="90"
          y1="200"
          x2="460"
          y2="410"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#e3f2b9" />
          <stop offset="1" stopColor="#8cc79a" />
        </linearGradient>
        <filter
          id={small ? "shadowSmall" : "shadow"}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="14"
            stdDeviation="14"
            floodColor="#183f2c"
            floodOpacity=".12"
          />
        </filter>
      </defs>
      <circle cx="280" cy="240" r="197" fill="#e8efce" opacity=".6" />
      <circle
        cx="280"
        cy="240"
        r="158"
        stroke="#bacda1"
        strokeDasharray="3 10"
      />
      <ellipse cx="290" cy="378" rx="207" ry="57" fill="#d5e5b7" />
      <path
        d="M82 352c13-43 73-48 100-32 39-94 142-121 203-44 71-31 115 24 114 68-102 82-312 92-417 8Z"
        fill={`url(#${small ? "hillSmall" : "hill"})`}
      />
      <path
        d="M130 353c63-69 99 50 176-12 77-62 68-82 134-62"
        stroke="#f8fbec"
        strokeWidth="19"
        strokeLinecap="round"
      />
      <path
        d="M130 353c63-69 99 50 176-12 77-62 68-82 134-62"
        stroke="#b5cba0"
        strokeWidth="2"
        strokeDasharray="8 9"
      />
      <g
        transform="rotate(-10 276 229)"
        filter={`url(#${small ? "shadowSmall" : "shadow"})`}
      >
        <path
          d="M165 121h244a17 17 0 0 1 17 17v59a15 15 0 0 0 0 30v59a17 17 0 0 1-17 17H165a17 17 0 0 1-17-17v-59a15 15 0 0 0 0-30v-59a17 17 0 0 1 17-17Z"
          fill="#fffef6"
        />
        <path
          d="M165 121h244a17 17 0 0 1 17 17v25H148v-25a17 17 0 0 1 17-17Z"
          fill="#1d634b"
        />
        <path
          d="M350 166v124"
          stroke="#c7d4bc"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        <text
          x="168"
          y="149"
          fill="#e2f2b9"
          fontSize="17"
          fontFamily="sans-serif"
          fontWeight="700"
        >
          gopax.
        </text>
        <text
          x="168"
          y="192"
          fill="#7d8a78"
          fontSize="10"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          A LITTLE GREENER
        </text>
        <text
          x="168"
          y="218"
          fill="#244635"
          fontSize="21"
          fontFamily="sans-serif"
          fontWeight="700"
        >
          Every trip counts.
        </text>
        <circle cx="178" cy="250" r="5" fill="#2a7758" />
        <path
          d="M185 250h125"
          stroke="#c9d7b7"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <circle cx="319" cy="250" r="5" fill="#2a7758" />
        <text
          x="168"
          y="278"
          fill="#617359"
          fontSize="10"
          fontFamily="sans-serif"
        >
          YOUR JOURNEY. YOUR IMPACT.
        </text>
        <g stroke="#274b38" strokeWidth="3">
          <path d="M368 185v68m6-68v68m8-68v68m5-68v68m8-68v68m7-68v68" />
        </g>
      </g>
      <g transform="translate(90 236)">
        <rect width="80" height="79" rx="24" fill="#f9fcf0" />
        <path
          d="M24 51V30a7 7 0 0 1 7-7h18a7 7 0 0 1 7 7v21H24Z"
          fill="#479064"
        />
        <path d="M29 28h22v13H29Z" fill="#d7edbc" />
        <circle cx="31" cy="47" r="3" fill="#eef9de" />
        <circle cx="49" cy="47" r="3" fill="#eef9de" />
        <path
          d="m30 53-5 6m25-6 5 6"
          stroke="#479064"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g transform="translate(382 66)">
        <circle cx="27" cy="27" r="27" fill="#d4ed9c" />
        <path d="M16 38c-1-18 7-25 23-24 1 18-8 27-23 24Z" fill="#508459" />
        <path
          d="m15 41 18-20"
          stroke="#f1f9d8"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      <path d="M470 337v-46" stroke="#467f57" strokeWidth="5" />
      <ellipse cx="470" cy="281" rx="20" ry="28" fill="#6aa877" />
      <path d="M111 360v-41" stroke="#467f57" strokeWidth="4" />
      <ellipse cx="111" cy="311" rx="14" ry="24" fill="#689f6c" />
      <circle cx="128" cy="151" r="5" fill="#a2c775" />
      <circle cx="458" cy="214" r="5" fill="#a2c775" />
      <path d="m315 78 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z" fill="#9bbd69" />
    </svg>
  );
}
