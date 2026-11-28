import React from 'react';
import { motion } from 'motion/react';
import { ThemeId } from '../../types/secretSanta';

interface FestiveCharactersProps {
  theme: ThemeId;
  mood?: 'happy' | 'laughing' | 'checklist' | 'celebrating' | 'fainting';
  compact?: boolean;
}

/**
 * Animated 3D-cartoon Santa & buddies topper that adapts expression and accessories
 * to each theme (Snowy Santa, Chocolate Wonderland, Desi Santa Dhamaka) and user actions.
 */
export const FestiveCharacters: React.FC<FestiveCharactersProps> = ({
  theme,
  mood = 'happy',
  compact = false,
}) => {
  const isLaughing = mood === 'laughing';
  const isCelebrating = mood === 'celebrating';
  const isFainting = mood === 'fainting';
  const isDesi = theme === 'funny';
  const hasShades = isDesi || isLaughing;

  return (
    <div
      className={`relative mx-auto flex items-end justify-center pointer-events-none select-none ${
        compact ? 'h-24 w-64' : 'h-32 sm:h-36 w-72 sm:w-80'
      }`}
      aria-hidden="true"
    >
      {/* Left Buddy: Cool Indian Bhaisa (Water Buffalo) in Funny Desi theme, else Reindeer */}
      <motion.div
        animate={
          isLaughing
            ? { rotate: [-12, 12, -10, 10, 0], y: [0, -6, 0] }
            : isCelebrating
              ? { y: [0, -12, 0], rotate: [-6, 6, -6] }
              : isDesi
                ? { y: [0, -7, 0], rotate: [-5, 5, -5] }
                : { y: [0, -4, 0], rotate: [-3, 3, -3] }
        }
        transition={{
          repeat: Infinity,
          duration: isLaughing ? 0.8 : isDesi ? 1.5 : 2.6,
          ease: 'easeInOut',
        }}
        className="w-20 sm:w-24 -mr-5 z-10 drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)]"
      >
        {isDesi ? (
          <svg viewBox="0 0 110 110" fill="none">
            {/* Curved Bhaisa Horns */}
            <path
              d="M34 38 C16 32, 10 14, 24 10 C20 20, 26 28, 38 32 Z"
              fill="#334155"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <path
              d="M76 38 C94 32, 100 14, 86 10 C90 20, 84 28, 72 32 Z"
              fill="#334155"
              stroke="#0f172a"
              strokeWidth="2"
            />
            {/* Festive Horn Tassels */}
            <circle cx="19" cy="18" r="3.5" fill="#ec4899" />
            <circle cx="18" cy="24" r="3" fill="#facc15" />
            <circle cx="91" cy="18" r="3.5" fill="#14b8a6" />
            <circle cx="92" cy="24" r="3" fill="#f97316" />
            {/* Ears */}
            <ellipse cx="22" cy="48" rx="11" ry="6" transform="rotate(-18 22 48)" fill="#1e293b" />
            <ellipse cx="88" cy="48" rx="11" ry="6" transform="rotate(18 88 48)" fill="#1e293b" />
            {/* Buffalo Head */}
            <ellipse cx="55" cy="57" rx="30" ry="27" fill="#1e293b" />
            <ellipse cx="55" cy="54" rx="24" ry="20" fill="#334155" />
            {/* Embroidered Forehead Patch */}
            <path
              d="M40 34 Q55 27 70 34 L66 42 Q55 37 44 42 Z"
              fill="#db2777"
              stroke="#facc15"
              strokeWidth="1.5"
            />
            <circle cx="55" cy="36" r="2.8" fill="#facc15" />
            {/* Snout */}
            <ellipse cx="55" cy="70" rx="22" ry="14" fill="#475569" />
            <circle cx="46" cy="68" r="3.2" fill="#0f172a" />
            <circle cx="64" cy="68" r="3.2" fill="#0f172a" />
            {/* Cool Golden-Rimmed Sunglasses */}
            <rect
              x="33"
              y="45"
              width="19"
              height="12"
              rx="4.5"
              fill="#090d16"
              stroke="#facc15"
              strokeWidth="1.8"
            />
            <rect
              x="58"
              y="45"
              width="19"
              height="12"
              rx="4.5"
              fill="#090d16"
              stroke="#facc15"
              strokeWidth="1.8"
            />
            <line x1="52" y1="50" x2="58" y2="50" stroke="#facc15" strokeWidth="2.5" />
            <line x1="37" y1="48" x2="43" y2="54" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.8" />
            <line x1="62" y1="48" x2="68" y2="54" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.8" />
            {/* Cheesy Grin */}
            <path d="M45 77 Q55 85 65 77" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" />
            {/* Marigold Garland & Golden Bell */}
            <circle cx="34" cy="86" r="6" fill="#f97316" />
            <circle cx="44" cy="90" r="6.5" fill="#facc15" />
            <circle cx="55" cy="92" r="6.5" fill="#f97316" />
            <circle cx="66" cy="90" r="6.5" fill="#facc15" />
            <circle cx="76" cy="86" r="6" fill="#f97316" />
            <path d="M49 95 L61 95 L63 105 L47 105 Z" fill="#facc15" stroke="#b45309" strokeWidth="1.5" />
            <circle cx="55" cy="105" r="2.5" fill="#b45309" />
          </svg>
        ) : (
          <svg viewBox="0 0 110 110" fill="none">
            {/* Antlers */}
            <path d="M36 32 L24 10 M29 20 L17 18 M32 18 L39 10" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
            <path d="M74 32 L86 10 M81 20 L93 18 M78 18 L71 10" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
            {/* Ears */}
            <ellipse cx="24" cy="46" rx="12" ry="7" transform="rotate(-22 24 46)" fill="#b45309" />
            <ellipse cx="86" cy="46" rx="12" ry="7" transform="rotate(22 86 46)" fill="#b45309" />
            {/* Head */}
            <ellipse cx="55" cy="58" rx="30" ry="27" fill="#d97706" />
            <ellipse cx="55" cy="68" rx="22" ry="16" fill="#fde68a" />
            {/* Eyes */}
            <path d="M39 52 Q44 45 49 52" stroke="#291711" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M61 52 Q66 45 71 52" stroke="#291711" strokeWidth="3.5" strokeLinecap="round" />
            {/* Glowing Red Nose */}
            <circle cx="55" cy="62" r="7.5" fill="#ef4444" />
            <circle cx="52.5" cy="59.5" r="2.2" fill="#fecaca" />
            {/* Happy mouth */}
            <path d="M46 72 Q55 82 64 72 Z" fill="#9f1239" />
            {/* Festive scarf + bell */}
            <rect x="30" y="82" width="50" height="14" rx="7" fill={theme === 'chocolate' ? '#5c2d0c' : '#dc2626'} />
            <circle cx="55" cy="94" r="6" fill="#facc15" stroke="#b45309" strokeWidth="1.5" />
          </svg>
        )}
      </motion.div>

      {/* Center 3D Santa (Desi Santa Ji with Rajasthani Pagdi, Sherwani & Bhangra Bounce in Funny theme) */}
      <motion.div
        animate={
          isFainting
            ? { rotate: [0, -25, 22, -18, 90], y: [0, -8, 12] }
            : isLaughing
              ? { y: [0, -10, 0], scale: [1, 1.07, 1] }
              : isCelebrating
                ? { y: [0, -14, 0], rotate: [-4, 4, -4] }
                : isDesi
                  ? { y: [0, -8, 0, -6, 0], rotate: [-3.5, 3.5, -3.5] }
                  : { y: [0, -5, 0] }
        }
        transition={{
          repeat: isFainting ? 0 : Infinity,
          duration: isLaughing ? 0.55 : isCelebrating ? 0.9 : isDesi ? 1.45 : 2.8,
          ease: 'easeInOut',
        }}
        className="w-28 sm:w-32 z-20 drop-shadow-[0_14px_20px_rgba(0,0,0,0.42)]"
      >
        <svg viewBox="0 0 140 130" fill="none">
          {/* Raised Hands / Bhangra Hands */}
          {isDesi ? (
            <>
              <circle cx="20" cy="68" r="12" fill="#fed7aa" stroke="#ea580c" strokeWidth="2.5" />
              <circle cx="120" cy="68" r="12" fill="#fed7aa" stroke="#ea580c" strokeWidth="2.5" />
              <rect x="13" y="76" width="14" height="4" rx="2" fill="#facc15" />
              <rect x="113" y="76" width="14" height="4" rx="2" fill="#facc15" />
            </>
          ) : (
            <>
              <circle cx="22" cy="76" r="13" fill="#dc2626" />
              <circle cx="118" cy="76" r="13" fill="#dc2626" />
            </>
          )}

          {/* Body: Royal Sherwani & Marigold Garland for Desi Santa, else Classic Suit */}
          {isDesi ? (
            <>
              <path d="M26 126 C28 90, 46 82, 70 82 C94 82, 112 90, 114 126 Z" fill="#b91c1c" />
              <path d="M54 84 L86 84 L90 126 L50 126 Z" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
              <line x1="70" y1="86" x2="70" y2="126" stroke="#d97706" strokeWidth="2" strokeDasharray="3 4" />
              <circle cx="70" cy="96" r="2.6" fill="#dc2626" />
              <circle cx="70" cy="106" r="2.6" fill="#dc2626" />
              <circle cx="70" cy="116" r="2.6" fill="#dc2626" />
              {/* Marigold Genda Phool Garland */}
              <circle cx="44" cy="93" r="6" fill="#f97316" />
              <circle cx="52" cy="102" r="6.5" fill="#facc15" />
              <circle cx="62" cy="109" r="6.5" fill="#f97316" />
              <circle cx="70" cy="111" r="6.5" fill="#ec4899" />
              <circle cx="78" cy="109" r="6.5" fill="#f97316" />
              <circle cx="88" cy="102" r="6.5" fill="#facc15" />
              <circle cx="96" cy="93" r="6" fill="#f97316" />
            </>
          ) : (
            <>
              <path d="M26 126 C28 92, 46 84, 70 84 C94 84, 112 92, 114 126 Z" fill="#dc2626" />
              <rect x="64" y="88" width="12" height="38" fill="#ffffff" />
              <rect x="30" y="106" width="80" height="10" fill="#1e293b" />
              <rect x="60" y="103" width="20" height="16" rx="3" fill="#facc15" stroke="#b45309" strokeWidth="2" />
            </>
          )}

          {/* Santa Face */}
          <ellipse cx="70" cy="60" rx="31" ry="27" fill="#fbcfe8" />
          <ellipse cx="70" cy="60" rx="30" ry="26" fill={isDesi ? '#f6bd8e' : '#fed7aa'} />
          {/* Rosy cheeks */}
          <ellipse cx="48" cy="64" rx="7" ry="4.5" fill="#fb7185" fillOpacity="0.55" />
          <ellipse cx="92" cy="64" rx="7" ry="4.5" fill="#fb7185" fillOpacity="0.55" />

          {/* Tilak mark in Desi Santa theme */}
          {isDesi && (
            <path d="M70 40 L72.5 46 L70 48 L67.5 46 Z" fill="#dc2626" stroke="#facc15" strokeWidth="0.9" />
          )}

          {/* Fluffy Beard */}
          <path
            d="M37 64 C36 92, 52 106, 70 106 C88 106, 104 92, 103 64 C94 74, 82 76, 70 76 C58 76, 46 74, 37 64 Z"
            fill="#ffffff"
          />
          {/* Moustache — Twirly Bollywood Mustache for Desi Santa */}
          {isDesi ? (
            <g>
              <path
                d="M70 71 C58 64, 44 65, 34 74 C30 77, 27 72, 31 68 C34 65, 38 69, 36 71 C45 62, 58 60, 70 67 Z"
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
              <path
                d="M70 71 C82 64, 96 65, 106 74 C110 77, 113 72, 109 68 C106 65, 102 69, 104 71 C95 62, 82 60, 70 67 Z"
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            </g>
          ) : (
            <>
              <ellipse cx="58" cy="70" rx="14" ry="7" transform="rotate(-10 58 70)" fill="#f8fafc" />
              <ellipse cx="82" cy="70" rx="14" ry="7" transform="rotate(10 82 70)" fill="#f8fafc" />
            </>
          )}

          {/* Eyes or Cool Bollywood Aviator Sunglasses */}
          {hasShades ? (
            <g>
              <rect
                x="44"
                y="47"
                width="22"
                height="13"
                rx="5"
                fill="#0f172a"
                stroke={isDesi ? '#facc15' : 'none'}
                strokeWidth={isDesi ? '2' : '0'}
              />
              <rect
                x="74"
                y="47"
                width="22"
                height="13"
                rx="5"
                fill="#0f172a"
                stroke={isDesi ? '#facc15' : 'none'}
                strokeWidth={isDesi ? '2' : '0'}
              />
              <line
                x1="66"
                y1="53"
                x2="74"
                y2="53"
                stroke={isDesi ? '#facc15' : '#0f172a'}
                strokeWidth="3.2"
              />
              <line x1="48" y1="50" x2="54" y2="56" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
              <line x1="78" y1="50" x2="84" y2="56" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="2" />
            </g>
          ) : (
            <g>
              <path d="M50 55 Q56 48 62 55" stroke="#291711" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M78 55 Q84 48 90 55" stroke="#291711" strokeWidth="3.5" strokeLinecap="round" />
            </g>
          )}

          {/* Nose & Joyful Laugh */}
          <circle cx="70" cy="63" r="6" fill="#f87171" />
          <path d="M61 75 Q70 86 79 75 Z" fill="#9f1239" />

          {/* Headwear: Royal Rajasthani Pagdi Turban + Golden Kalgi in Desi theme, else Santa Hat */}
          {isDesi ? (
            <g>
              <path d="M34 44 C32 22, 52 10, 70 12 C88 10, 108 22, 106 44 Z" fill="#dc2626" />
              <path d="M36 39 Q68 20 102 32" stroke="#facc15" strokeWidth="5" strokeLinecap="round" />
              <path d="M38 30 Q72 15 104 40" stroke="#ec4899" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M35 42 Q70 30 105 42" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" />
              <path
                d="M70 16 C75 4, 88 2, 92 12 C84 14, 78 18, 74 22 Z"
                fill="#fef3c7"
                stroke="#f59e0b"
                strokeWidth="1.5"
              />
              <circle cx="70" cy="22" r="6" fill="#facc15" stroke="#b45309" strokeWidth="1.8" />
              <circle cx="70" cy="22" r="2.5" fill="#dc2626" />
              <path d="M104 34 Q114 38 115 47" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
              <circle cx="115" cy="49" r="5" fill="#ffffff" />
            </g>
          ) : (
            <>
              <path d="M36 42 C42 10, 96 6, 114 34 L104 44 L36 42 Z" fill="#dc2626" />
              <rect x="33" y="34" width="74" height="13" rx="6.5" fill="#ffffff" />
              <circle cx="116" cy="36" r="9" fill="#ffffff" />
            </>
          )}

          {/* Chocolate bar prop in Chocolate theme */}
          {theme === 'chocolate' && (
            <g transform="translate(96 76) rotate(12)">
              <rect width="24" height="28" rx="4" fill="#5c2d0c" stroke="#f59e0b" strokeWidth="2" />
              <line x1="12" y1="3" x2="12" y2="25" stroke="#7c3b11" strokeWidth="2" />
              <line x1="3" y1="14" x2="21" y2="14" stroke="#7c3b11" strokeWidth="2" />
            </g>
          )}

          {/* Checklist prop on Countdown screen */}
          {mood === 'checklist' && (
            <g transform="translate(8 74) rotate(-10)">
              <rect width="26" height="32" rx="4" fill="#fef3c7" stroke="#b45309" strokeWidth="2" />
              <line x1="6" y1="10" x2="20" y2="10" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="17" x2="18" y2="17" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="6" y1="24" x2="16" y2="24" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
      </motion.div>

      {/* Right Buddy: Desi Reindeer with Pagdi & Kulhad Chai (Funny), Gingerbread (Chocolate), or Reindeer (Santa) */}
      <motion.div
        animate={
          isLaughing
            ? { rotate: [12, -12, 10, -10, 0], y: [0, -6, 0] }
            : isCelebrating
              ? { y: [0, -11, 0], rotate: [6, -6, 6] }
              : isDesi
                ? { y: [0, -7, 0], rotate: [5, -5, 5] }
                : { y: [0, -4, 0], rotate: [3, -3, 3] }
        }
        transition={{
          repeat: Infinity,
          duration: isLaughing ? 0.75 : isDesi ? 1.55 : 2.9,
          ease: 'easeInOut',
        }}
        className="w-20 sm:w-24 -ml-5 z-10 drop-shadow-[0_10px_14px_rgba(0,0,0,0.35)]"
      >
        {theme === 'chocolate' ? (
          <svg viewBox="0 0 110 110" fill="none">
            <circle cx="55" cy="48" r="28" fill="#b45309" />
            <ellipse cx="55" cy="92" rx="26" ry="20" fill="#b45309" />
            <path d="M32 36 Q40 42 48 36 Q55 42 62 36 Q70 42 78 36" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            <circle cx="44" cy="48" r="4" fill="#291711" />
            <circle cx="66" cy="48" r="4" fill="#291711" />
            <path d="M44 60 Q55 69 66 60" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
            <ellipse cx="47" cy="76" rx="8" ry="5" fill="#dc2626" />
            <ellipse cx="63" cy="76" rx="8" ry="5" fill="#dc2626" />
            <circle cx="55" cy="76" r="4" fill="#ef4444" />
            <circle cx="55" cy="92" r="4.5" fill="#22c55e" />
          </svg>
        ) : (
          <svg viewBox="0 0 110 110" fill="none">
            <path d="M36 32 L24 10 M29 20 L17 18 M32 18 L39 10" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
            <path d="M74 32 L86 10 M81 20 L93 18 M78 18 L71 10" stroke="#78350f" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="24" cy="46" rx="12" ry="7" transform="rotate(-22 24 46)" fill="#b45309" />
            <ellipse cx="86" cy="46" rx="12" ry="7" transform="rotate(22 86 46)" fill="#b45309" />
            <ellipse cx="55" cy="58" rx="30" ry="27" fill="#d97706" />
            <ellipse cx="55" cy="68" rx="22" ry="16" fill="#fde68a" />
            {isDesi && (
              <g>
                <path d="M36 37 C38 22, 72 22, 74 37 Z" fill="#f97316" />
                <path d="M38 34 Q55 26 72 34" stroke="#facc15" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="55" cy="27" r="3.5" fill="#ec4899" stroke="#facc15" strokeWidth="1.2" />
              </g>
            )}
            <path d="M39 52 Q44 45 49 52" stroke="#291711" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M61 52 Q66 45 71 52" stroke="#291711" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="55" cy="62" r="7.5" fill="#ef4444" />
            <circle cx="52.5" cy="59.5" r="2.2" fill="#fecaca" />
            <path d="M46 72 Q55 82 64 72 Z" fill="#9f1239" />
            {isDesi ? (
              <g>
                <rect x="30" y="82" width="50" height="14" rx="7" fill="#db2777" />
                <circle cx="38" cy="89" r="4.5" fill="#facc15" />
                <circle cx="49" cy="89" r="4.5" fill="#f97316" />
                <circle cx="61" cy="89" r="4.5" fill="#facc15" />
                <circle cx="72" cy="89" r="4.5" fill="#f97316" />
                {/* Cute Steaming Kulhad Chai Cup */}
                <path d="M84 74 L98 74 L95 94 L87 94 Z" fill="#b45309" stroke="#78350f" strokeWidth="1.5" />
                <path d="M88 68 Q90 63 88 59 M94 68 Q96 63 94 59" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" />
              </g>
            ) : (
              <>
                <rect x="30" y="82" width="50" height="14" rx="7" fill="#16a34a" />
                <circle cx="55" cy="94" r="6" fill="#facc15" stroke="#b45309" strokeWidth="1.5" />
              </>
            )}
          </svg>
        )}
      </motion.div>
    </div>
  );
};

/**
 * Decorative top edge for cards: Melting chocolate drips (Chocolate),
 * snowy frosting cap (Santa), or festive Indian marigold & mango-leaf toran (Desi Funny).
 */
export const ThemeCardTrim: React.FC<{ theme: ThemeId }> = ({ theme }) => {
  if (theme === 'chocolate') {
    return (
      <svg
        viewBox="0 0 400 28"
        preserveAspectRatio="none"
        className="w-full h-5 -mt-0.5 block pointer-events-none select-none rounded-t-[20px]"
        aria-hidden="true"
      >
        <path
          d="M0,0 L400,0 L400,10 C384,10 380,26 368,26 C356,26 352,12 336,12 C320,12 316,22 302,22 C288,22 282,10 264,10 C246,10 242,27 226,27 C210,27 204,12 186,12 C168,12 162,21 146,21 C130,21 124,10 106,10 C88,10 84,25 68,25 C52,25 46,12 28,12 C14,12 10,18 0,14 Z"
          fill="#5c2d0c"
        />
      </svg>
    );
  }

  if (theme === 'santa') {
    return (
      <div
        className="h-2.5 w-full rounded-t-[20px] bg-gradient-to-r from-sky-100 via-white to-sky-100 opacity-90"
        aria-hidden="true"
      />
    );
  }

  // Indian Marigold Flower & Mango-Leaf Toran (Bandarwal) Trim
  return (
    <svg
      viewBox="0 0 400 26"
      preserveAspectRatio="none"
      className="w-full h-6 -mt-0.5 block pointer-events-none select-none rounded-t-[20px]"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="400" height="7" fill="#be185d" />
      <line x1="0" y1="6.5" x2="400" y2="6.5" stroke="#facc15" strokeWidth="1.5" strokeDasharray="6 4" />
      {[0, 80, 160, 240, 320].map((x) => (
        <g key={x}>
          <path d={`M${x + 14} 7 Q${x + 20} 21 ${x + 26} 7 Z`} fill="#15803d" />
          <path d={`M${x + 54} 7 Q${x + 60} 21 ${x + 66} 7 Z`} fill="#16a34a" />
          <path d={`M${x} 8 Q${x + 40} 24 ${x + 80} 8`} stroke="#f59e0b" strokeWidth="2.5" fill="none" />
          <circle cx={x + 14} cy="11" r="4.5" fill="#f97316" />
          <circle cx={x + 27} cy="15" r="4.5" fill="#facc15" />
          <circle cx={x + 40} cy="17" r="5.5" fill="#f97316" />
          <circle cx={x + 40} cy="17" r="2.2" fill="#dc2626" />
          <circle cx={x + 53} cy="15" r="4.5" fill="#facc15" />
          <circle cx={x + 66} cy="11" r="4.5" fill="#f97316" />
        </g>
      ))}
    </svg>
  );
};
