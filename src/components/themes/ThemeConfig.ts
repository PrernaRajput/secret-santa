import { ThemeId } from '../../types/secretSanta';

export interface ThemeTokens {
  id: ThemeId;
  name: string;
  tagline: string;
  emoji: string;
  backdropImage: string;
  backdropFallback: string;
  scrimClass: string;
  cardClass: string;
  cardText: string;
  mutedText: string;
  titleGradient: string;
  titleShadowClass: string;
  primaryBtnClass: string;
  secondaryBtnClass: string;
  chipSelectedClass: string;
  chipIdleClass: string;
  inputClass: string;
  footerClass: string;
  confettiColors: string[];
  scratchPrimary: string;
  scratchSecondary: string;
  scratchTextColor: string;
  scratchLabel: string;
  carouselDockClass: string;
}

export const THEME_CONFIGS: Record<ThemeId, ThemeTokens> = {
  santa: {
    id: 'santa',
    name: "Santa's Snowy Christmas",
    tagline: 'Snowflakes, sleigh bells & midnight magic',
    emoji: '🎅',
    backdropImage: '/src/assets/images/theme_santa_snow_bg_1795638738590.jpg',
    backdropFallback: 'linear-gradient(180deg, #1e1b4b 0%, #312e81 45%, #4c1d95 100%)',
    scrimClass: 'bg-gradient-to-b from-indigo-950/65 via-indigo-950/45 to-slate-950/75',
    cardClass:
      'bg-white/92 backdrop-blur-xl border-2 border-white/80 shadow-[0_24px_60px_-15px_rgba(30,27,75,0.55)]',
    cardText: 'text-indigo-950',
    mutedText: 'text-indigo-900/70',
    titleGradient: 'from-white via-amber-100 to-amber-300',
    titleShadowClass: 'title-3d-snow',
    primaryBtnClass: 'btn-3d-red text-white',
    secondaryBtnClass:
      'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border border-indigo-200',
    chipSelectedClass:
      'bg-rose-600 text-white border-rose-700 shadow-md shadow-rose-500/30',
    chipIdleClass:
      'bg-indigo-50/90 hover:bg-rose-50 text-indigo-950 border-indigo-200/80',
    inputClass:
      'bg-white border-indigo-200 text-indigo-950 placeholder:text-indigo-400 focus:border-rose-500 focus:ring-rose-500/20',
    footerClass: 'text-indigo-100/90 drop-shadow-[0_1px_6px_rgba(165,180,252,0.75)]',
    confettiColors: ['#ef4444', '#facc15', '#ffffff', '#38bdf8', '#22c55e'],
    scratchPrimary: '#cbd5e1',
    scratchSecondary: '#94a3b8',
    scratchTextColor: '#1e293b',
    scratchLabel: 'SCRATCH SILVER FOIL',
    carouselDockClass:
      'bg-white/85 backdrop-blur-xl border-t-2 border-x-2 border-white shadow-[0_-10px_35px_rgba(30,27,75,0.35)]',
  },
  chocolate: {
    id: 'chocolate',
    name: 'Chocolate Wonderland',
    tagline: 'Melted cocoa, golden truffles & gingerbread',
    emoji: '🍫',
    backdropImage: '/src/assets/images/theme_chocolate_bg_1795638738005.jpg',
    backdropFallback: 'linear-gradient(180deg, #2b1409 0%, #4a2311 50%, #241007 100%)',
    scrimClass: 'bg-gradient-to-b from-[#1f0d05]/65 via-[#2e1509]/45 to-[#1a0a03]/80',
    cardClass:
      'bg-[#fdf3e3]/95 backdrop-blur-xl border-[3px] border-[#6b3410] shadow-[0_24px_60px_-15px_rgba(26,10,3,0.75)]',
    cardText: 'text-[#3d1c06]',
    mutedText: 'text-[#6b3a19]',
    titleGradient: 'from-[#fff7ed] via-[#fde68a] to-[#f59e0b]',
    titleShadowClass: 'title-3d-choco',
    primaryBtnClass: 'btn-3d-choco text-[#fff7ed]',
    secondaryBtnClass:
      'bg-[#f5e3c6] hover:bg-[#ecd3ad] text-[#3d1c06] border border-[#c69563]',
    chipSelectedClass:
      'bg-[#5c2d0c] text-[#fef3c7] border-[#3d1c06] shadow-md shadow-[#3d1c06]/30',
    chipIdleClass:
      'bg-[#fff8ec] hover:bg-[#f7e5c8] text-[#4a2311] border-[#d8b48a]',
    inputClass:
      'bg-[#fffaf2] border-[#cfa375] text-[#3d1c06] placeholder:text-[#9c6b43] focus:border-[#7c3b11] focus:ring-[#92400e]/20',
    footerClass: 'text-[#fde68a] drop-shadow-[0_1px_6px_rgba(45,20,6,0.9)]',
    confettiColors: ['#f59e0b', '#78350f', '#fef3c7', '#d97706', '#ef4444'],
    scratchPrimary: '#f59e0b',
    scratchSecondary: '#b45309',
    scratchTextColor: '#451a03',
    scratchLabel: 'PEEL GOLDEN WRAPPER',
    carouselDockClass:
      'bg-[#4a2311]/92 backdrop-blur-xl border-t-2 border-x-2 border-[#c69563] shadow-[0_-10px_35px_rgba(26,10,3,0.65)]',
  },
  funny: {
    id: 'funny',
    name: 'Desi Santa Dhamaka',
    tagline: 'Bhangra bells, Bhaisa sleigh & full Bollywood drama!',
    emoji: '🤪',
    backdropImage: '/src/assets/images/theme_desi_funny_bg_1795678538015.jpg',
    backdropFallback: 'linear-gradient(180deg, #0c4a6e 0%, #701a75 55%, #450a0a 100%)',
    scrimClass: 'bg-gradient-to-b from-teal-950/55 via-fuchsia-950/35 to-rose-950/75',
    cardClass:
      'bg-[#fffaf0]/95 backdrop-blur-xl border-[3px] border-amber-500 shadow-[0_24px_60px_-15px_rgba(112,26,117,0.6)]',
    cardText: 'text-[#431407]',
    mutedText: 'text-[#7c2d12]',
    titleGradient: 'from-yellow-200 via-amber-300 to-pink-300',
    titleShadowClass: 'title-3d-chaos',
    primaryBtnClass: 'btn-3d-chaos text-[#431407]',
    secondaryBtnClass:
      'bg-amber-100 hover:bg-amber-200 text-[#431407] border border-amber-400',
    chipSelectedClass:
      'bg-pink-600 text-white border-pink-700 shadow-md shadow-pink-500/30',
    chipIdleClass:
      'bg-[#fffdf7] hover:bg-amber-50 text-[#431407] border-amber-300/90',
    inputClass:
      'bg-white border-amber-300 text-[#431407] placeholder:text-amber-800/45 focus:border-pink-600 focus:ring-pink-500/20',
    footerClass: 'text-amber-200 drop-shadow-[0_1px_6px_rgba(112,26,117,0.95)]',
    confettiColors: ['#f59e0b', '#ec4899', '#14b8a6', '#facc15', '#ef4444'],
    scratchPrimary: '#f59e0b',
    scratchSecondary: '#db2777',
    scratchTextColor: '#fffbeb',
    scratchLabel: 'SCRATCH DHAMAKA FOIL',
    carouselDockClass:
      'bg-gradient-to-r from-[#581c87]/92 via-[#831843]/92 to-[#7c2d12]/92 backdrop-blur-xl border-t-2 border-x-2 border-amber-400 shadow-[0_-10px_35px_rgba(112,26,117,0.65)]',
  },
};

export const THEME_ORDER: ThemeId[] = ['santa', 'chocolate', 'funny'];
