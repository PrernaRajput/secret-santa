import React from 'react';
import { getAvatarById } from '../../data/avatars';

interface AvatarGraphicProps {
  avatarId: string;
  size?: number;
  className?: string;
  hasGoldenCrown?: boolean;
}

/**
 * Renders 20 distinct, glossy 3D-shaded cartoon Christmas character portraits.
 * Each character has unique headwear, hair silhouette, expression, and winter attire.
 * Supports the permanent rare Golden Detective Crown cosmetic from The 1% Santa Secret.
 */
export const AvatarGraphic: React.FC<AvatarGraphicProps> = ({
  avatarId,
  size = 76,
  className = '',
  hasGoldenCrown = false,
}) => {
  const av = getAvatarById(avatarId);
  const uid = `av-${av.id}-${size}${hasGoldenCrown ? '-crown' : ''}`;
  const isGingerbread = av.hatStyle === 'gingerbread';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={av.name}
    >
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={av.bgFrom} />
          <stop offset="100%" stopColor={av.bgTo} />
        </linearGradient>
        <radialGradient id={`${uid}-face`} cx="45%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </radialGradient>
        <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {hasGoldenCrown && (
          <>
            <linearGradient id={`${uid}-gold-crown`} x1="28" y1="4" x2="92" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef9c3" />
              <stop offset="32%" stopColor="#facc15" />
              <stop offset="68%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id={`${uid}-gold-rim`} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <radialGradient id={`${uid}-gold-halo`} cx="50%" cy="18%" r="48%">
              <stop offset="0%" stopColor="#fde047" stopOpacity="0.48" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </>
        )}
      </defs>

      {/* Soft rounded 3D tile background */}
      <rect width="120" height="120" rx="28" fill={`url(#${uid}-bg)`} />
      <ellipse cx="60" cy="24" rx="44" ry="18" fill={`url(#${uid}-gloss)`} />

      {/* Back Hair Layer */}
      {av.hairStyle === 'long' && (
        <path
          d="M24 58 C22 82, 26 104, 34 114 L86 114 C94 104, 98 82, 96 58 C95 34, 80 24, 60 24 C40 24, 25 34, 24 58 Z"
          fill={av.hairColor}
        />
      )}
      {av.hairStyle === 'curly' && (
        <g fill={av.hairColor}>
          <circle cx="30" cy="54" r="14" />
          <circle cx="90" cy="54" r="14" />
          <circle cx="28" cy="74" r="12" />
          <circle cx="92" cy="74" r="12" />
          <circle cx="42" cy="34" r="14" />
          <circle cx="78" cy="34" r="14" />
          <circle cx="60" cy="28" r="15" />
        </g>
      )}
      {av.hairStyle === 'bun' && (
        <circle cx="60" cy="22" r="16" fill={av.hairColor} />
      )}
      {av.hairStyle === 'twin-buns' && (
        <g fill={av.hairColor}>
          <circle cx="26" cy="40" r="15" />
          <circle cx="94" cy="40" r="15" />
          {/* Golden star clips */}
          <circle cx="36" cy="44" r="5" fill="#facc15" />
          <circle cx="84" cy="44" r="5" fill="#facc15" />
        </g>
      )}
      {av.hairStyle === 'braids' && (
        <g fill={av.hairColor}>
          <ellipse cx="32" cy="86" rx="8" ry="14" />
          <ellipse cx="88" cy="86" rx="8" ry="14" />
          <circle cx="32" cy="100" r="5" fill="#dc2626" />
          <circle cx="88" cy="100" r="5" fill="#dc2626" />
        </g>
      )}

      {/* Penguin or Reindeer Hoodie Outer Shell */}
      {av.hatStyle === 'penguin' && (
        <path
          d="M20 72 C20 34, 38 22, 60 22 C82 22, 100 34, 100 72 L100 116 L20 116 Z"
          fill="#1e293b"
        />
      )}
      {av.hatStyle === 'reindeer' && (
        <g>
          <path
            d="M24 72 C24 38, 40 26, 60 26 C80 26, 96 38, 96 72 L96 112 L24 112 Z"
            fill="#d97706"
          />
          {/* Hoodie antlers & ears */}
          <path d="M34 32 L24 14 M24 22 L16 20 M28 18 L34 12" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M86 32 L96 14 M96 22 L104 20 M92 18 L86 12" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" />
          <ellipse cx="26" cy="40" rx="8" ry="5" transform="rotate(-25 26 40)" fill="#b45309" />
          <ellipse cx="94" cy="40" rx="8" ry="5" transform="rotate(25 94 40)" fill="#b45309" />
        </g>
      )}

      {/* Shoulders / Cozy Sweater */}
      <path
        d="M22 120 C24 94, 40 88, 60 88 C80 88, 96 94, 98 120 Z"
        fill={av.sweaterColor}
      />
      {/* Sweater Snowflake / Festive Trim */}
      <circle cx="44" cy="106" r="2.5" fill="#ffffff" fillOpacity="0.8" />
      <circle cx="60" cy="104" r="3" fill="#fde047" fillOpacity="0.9" />
      <circle cx="76" cy="106" r="2.5" fill="#ffffff" fillOpacity="0.8" />

      {/* Scarf if present */}
      {av.scarfColor && (
        <g>
          <rect x="36" y="84" width="48" height="14" rx="7" fill={av.scarfColor} />
          <rect x="70" y="92" width="12" height="22" rx="5" fill={av.scarfColor} />
          <line x1="42" y1="91" x2="78" y2="91" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="4 4" />
        </g>
      )}

      {/* Hijab drape */}
      {av.hatStyle === 'hijab-santa' && (
        <path
          d="M26 64 C26 36, 40 28, 60 28 C80 28, 94 36, 94 64 C94 86, 82 96, 60 96 C38 96, 26 86, 26 64 Z"
          fill="#fef3c7"
        />
      )}

      {/* Ears */}
      {av.hatStyle !== 'hijab-santa' && av.hatStyle !== 'penguin' && (
        <g>
          <circle cx="32" cy="64" r="7" fill={av.skin} />
          <circle cx="88" cy="64" r="7" fill={av.skin} />
          {av.hatStyle === 'elf' && (
            <>
              <path d="M28 60 L14 54 L26 68 Z" fill={av.skin} />
              <path d="M92 60 L106 54 L94 68 Z" fill={av.skin} />
            </>
          )}
        </g>
      )}

      {/* Face Base */}
      <ellipse cx="60" cy="62" rx="28" ry="26" fill={av.skin} />
      <ellipse cx="60" cy="62" rx="28" ry="26" fill={`url(#${uid}-face)`} />

      {/* Gingerbread Icing Detail */}
      {isGingerbread && (
        <path
          d="M36 48 Q42 54 48 48 Q54 54 60 48 Q66 54 72 48 Q78 54 84 48"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Rosy 3D Cheeks */}
      <ellipse cx="43" cy="69" rx="6.5" ry="4" fill="#fb7185" fillOpacity="0.45" />
      <ellipse cx="77" cy="69" rx="6.5" ry="4" fill="#fb7185" fillOpacity="0.45" />

      {/* Beard if present */}
      {av.hasBeard && (
        <path
          d="M35 66 C35 84, 46 92, 60 92 C74 92, 85 84, 85 66 C80 72, 72 74, 60 74 C48 74, 40 72, 35 66 Z"
          fill={av.hairColor}
        />
      )}

      {/* Eyes & Expressions */}
      {av.expression === 'wink' ? (
        <g>
          <path d="M43 60 Q48 54 53 60" stroke="#291711" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <circle cx="72" cy="59" r="3.6" fill="#291711" />
          <circle cx="73.2" cy="57.8" r="1.2" fill="#ffffff" />
        </g>
      ) : av.expression === 'happy' || av.expression === 'excited' ? (
        <g>
          <path d="M43 60 Q48 54 53 60" stroke="#291711" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M67 60 Q72 54 77 60" stroke="#291711" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        </g>
      ) : (
        <g>
          <circle cx="48" cy="59" r="3.6" fill="#291711" />
          <circle cx="49.2" cy="57.8" r="1.2" fill="#ffffff" />
          <circle cx="72" cy="59" r="3.6" fill="#291711" />
          <circle cx="73.2" cy="57.8" r="1.2" fill="#ffffff" />
        </g>
      )}

      {/* Cute Nose / Rudolph Red Nose */}
      {av.hasRedNose ? (
        <g>
          <circle cx="60" cy="66" r="5" fill="#ef4444" />
          <circle cx="58.5" cy="64.5" r="1.6" fill="#fecaca" />
        </g>
      ) : (
        <ellipse cx="60" cy="65" rx="2.6" ry="1.8" fill="#d97757" fillOpacity="0.6" />
      )}

      {/* Smile */}
      {av.expression === 'excited' ? (
        <path d="M51 72 Q60 83 69 72 Z" fill="#9f1239" />
      ) : (
        <path d="M52 72 Q60 79 68 72" stroke="#5c2418" strokeWidth="3" strokeLinecap="round" fill="none" />
      )}

      {/* Glasses if present */}
      {av.hasGlasses && (
        <g stroke="#291711" strokeWidth="2.4" fill="#ffffff" fillOpacity="0.16">
          <circle cx="48" cy="60" r="9" />
          <circle cx="72" cy="60" r="9" />
          <line x1="57" y1="60" x2="63" y2="60" />
        </g>
      )}

      {/* Front Bangs / Hair */}
      {!isGingerbread && av.hatStyle !== 'hijab-santa' && av.hatStyle !== 'penguin' && (
        <path
          d="M32 52 C36 36, 52 32, 60 36 C68 32, 84 36, 88 52 C80 42, 70 42, 60 45 C50 42, 40 42, 32 52 Z"
          fill={av.hairColor}
        />
      )}

      {/* Festive Headwear & Accessories */}
      {(av.hatStyle === 'santa' || av.hatStyle === 'hijab-santa') && (
        <g>
          <path d="M30 42 C34 16, 78 10, 92 34 L88 44 L30 42 Z" fill="#dc2626" />
          <rect x="28" y="36" width="64" height="11" rx="5.5" fill="#ffffff" />
          <circle cx="94" cy="34" r="7" fill="#ffffff" />
        </g>
      )}

      {av.hatStyle === 'beanie' && (
        <g>
          <path d="M30 44 C32 20, 88 20, 90 44 Z" fill={av.scarfColor || '#f59e0b'} />
          <rect x="28" y="38" width="64" height="10" rx="5" fill="#fef3c7" />
          <circle cx="60" cy="18" r="7" fill="#fef3c7" />
        </g>
      )}

      {av.hatStyle === 'elf' && (
        <g>
          <path d="M28 42 C42 12, 78 12, 92 42 Z" fill="#16a34a" />
          <path d="M28 42 L36 35 L44 43 L52 35 L60 43 L68 35 L76 43 L84 35 L92 42 Z" fill="#dc2626" />
          <circle cx="94" cy="30" r="5" fill="#facc15" />
        </g>
      )}

      {av.hatStyle === 'earmuffs' && (
        <g>
          <path d="M28 60 C28 24, 92 24, 92 60" stroke="#e11d48" strokeWidth="5" fill="none" />
          <circle cx="27" cy="62" r="10" fill="#ffffff" stroke="#fda4af" strokeWidth="2" />
          <circle cx="93" cy="62" r="10" fill="#ffffff" stroke="#fda4af" strokeWidth="2" />
        </g>
      )}

      {av.hatStyle === 'headphones' && (
        <g>
          <path d="M26 60 C26 22, 94 22, 94 60" stroke="#7c3aed" strokeWidth="6" fill="none" />
          <rect x="19" y="50" width="11" height="22" rx="5.5" fill="#5b21b6" />
          <rect x="90" y="50" width="11" height="22" rx="5.5" fill="#5b21b6" />
        </g>
      )}

      {av.hatStyle === 'bow' && (
        <g>
          <ellipse cx="52" cy="31" rx="8" ry="5" fill="#e11d48" />
          <ellipse cx="68" cy="31" rx="8" ry="5" fill="#e11d48" />
          <circle cx="60" cy="31" r="4" fill="#fb7185" />
        </g>
      )}

      {av.hatStyle === 'holly' && (
        <g>
          <ellipse cx="38" cy="40" rx="8" ry="4" transform="rotate(-30 38 40)" fill="#16a34a" />
          <ellipse cx="46" cy="36" rx="8" ry="4" transform="rotate(20 46 36)" fill="#15803d" />
          <circle cx="42" cy="41" r="3.2" fill="#dc2626" />
          <circle cx="47" cy="42" r="3" fill="#ef4444" />
        </g>
      )}

      {av.hatStyle === 'antlers' && (
        <g stroke="#78350f" strokeWidth="5" strokeLinecap="round">
          <path d="M40 34 L30 14 M33 22 L24 20 M36 18 L43 13" />
          <path d="M80 34 L90 14 M87 22 L96 20 M84 18 L77 13" />
        </g>
      )}

      {av.hatStyle === 'goggles' && (
        <g>
          <path d="M30 42 C32 20, 88 20, 90 42 Z" fill="#f59e0b" />
          <rect x="34" y="29" width="22" height="13" rx="6" fill="#38bdf8" stroke="#1e293b" strokeWidth="2.5" />
          <rect x="64" y="29" width="22" height="13" rx="6" fill="#38bdf8" stroke="#1e293b" strokeWidth="2.5" />
          <line x1="56" y1="35" x2="64" y2="35" stroke="#1e293b" strokeWidth="3" />
        </g>
      )}

      {av.hatStyle === 'penguin' && (
        <g>
          {/* Cute penguin eyes & orange beak on top of hood */}
          <circle cx="48" cy="31" r="3" fill="#ffffff" />
          <circle cx="72" cy="31" r="3" fill="#ffffff" />
          <circle cx="48" cy="31" r="1.5" fill="#0f172a" />
          <circle cx="72" cy="31" r="1.5" fill="#0f172a" />
          <path d="M55 34 L65 34 L60 40 Z" fill="#f97316" />
        </g>
      )}

      {/* Permanent Rare Cosmetic: Golden Detective Crown (The 1% Santa Secret) */}
      {hasGoldenCrown && (
        <g aria-label="Golden Detective Crown">
          {/* Warm golden halo behind crown */}
          <ellipse cx="60" cy="18" rx="34" ry="16" fill={`url(#${uid}-gold-halo)`} />

          {/* Brushed gold rare border frame */}
          <rect
            x="2.2"
            y="2.2"
            width="115.6"
            height="115.6"
            rx="26"
            fill="none"
            stroke={`url(#${uid}-gold-rim)`}
            strokeWidth="4.4"
          />

          {/* Sculpted Royal Golden Detective Crown */}
          <g transform="translate(0, 1)">
            {/* Subtle crown drop shadow */}
            <path
              d="M35 28 L31 12 L46 20 L60 6 L74 20 L89 12 L85 28 Z"
              fill="#78350f"
              fillOpacity="0.35"
              transform="translate(0, 2)"
            />
            {/* Main metallic gold crown body */}
            <path
              d="M35 28 L31 12 L46 20 L60 6 L74 20 L89 12 L85 28 Z"
              fill={`url(#${uid}-gold-crown)`}
              stroke="#78350f"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Crown specular ridge highlight */}
            <path
              d="M37 25 L35 15 L47 22 L60 9 L73 22 L85 15 L83 25 Z"
              fill="#fef9c3"
              fillOpacity="0.35"
            />
            {/* Crown velvet-gold band */}
            <rect
              x="34"
              y="25"
              width="52"
              height="6.5"
              rx="3.2"
              fill="#b45309"
              stroke="#fef08a"
              strokeWidth="1.1"
            />
            {/* Crown spire pearls */}
            <circle cx="31" cy="11.5" r="2.7" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
            <circle cx="60" cy="5.8" r="3.2" fill="#fef9c3" stroke="#92400e" strokeWidth="1" />
            <circle cx="89" cy="11.5" r="2.7" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
            {/* Center detective crest emblem (ruby gem + golden lens glint) */}
            <circle cx="60" cy="28.2" r="3.4" fill="#dc2626" stroke="#fef08a" strokeWidth="1.1" />
            <circle cx="59.1" cy="27.3" r="1" fill="#fecaca" />
            <circle cx="46" cy="28.2" r="2" fill="#10b981" stroke="#fef08a" strokeWidth="0.8" />
            <circle cx="74" cy="28.2" r="2" fill="#10b981" stroke="#fef08a" strokeWidth="0.8" />
            {/* Subtle 4-point gold starlight sparkles */}
            <path d="M21 15 L22.5 11 L24 15 L28 16.5 L24 18 L22.5 22 L21 18 L17 16.5 Z" fill="#fef08a" />
            <path d="M96 14 L97.2 11 L98.4 14 L101.4 15.2 L98.4 16.4 L97.2 19.4 L96 16.4 L93 15.2 Z" fill="#fde047" />
          </g>
        </g>
      )}
    </svg>
  );
};
