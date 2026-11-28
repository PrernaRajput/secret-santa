import { HobbyOption, ImportProvider } from '../types/secretSanta';

export const HOBBY_OPTIONS: HobbyOption[] = [
  { id: 'reading', label: 'Reading', emoji: '📚' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'art', label: 'Art', emoji: '🎨' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'travelling', label: 'Travelling', emoji: '✈️' },
  { id: 'chocolate', label: 'Chocolate', emoji: '🍫' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'fitness', label: 'Fitness', emoji: '🏋️' },
  { id: 'movies', label: 'Movies', emoji: '🎬' },
  { id: 'skincare', label: 'Skincare', emoji: '🧴' },
  { id: 'coffee', label: 'Coffee', emoji: '☕' },
  { id: 'pets', label: 'Pets', emoji: '🐱' },
  { id: 'plants', label: 'Plants', emoji: '🌿' },
  { id: 'photography', label: 'Photography', emoji: '📷' },
  { id: 'technology', label: 'Technology', emoji: '💻' },
  { id: 'collectibles', label: 'Collectibles', emoji: '🧸' },
  { id: 'fashion', label: 'Fashion', emoji: '👗' },
  { id: 'baking', label: 'Baking', emoji: '🍰' },
  { id: 'anime', label: 'Anime', emoji: '✨' },
  { id: 'kdramas', label: 'K-Dramas', emoji: '🍿' },
];

export const RUNAWAY_NO_MESSAGES: string[] = [
  'Nice try! 😜',
  'Santa said NO to your NO! 🎅',
  'Aise kaise? Join karo! 😂',
  'Itna attitude? Gift nahi chahiye kya? 🎁',
  'Even Rudolph is judging you! 🦌',
  'The NO button has left the chat! 💨',
  'Bas kar pagle, join kar le! ❤️',
  "You're still chasing me? Respect the dedication! 😂",
  'Santa is getting impatient! 🎄',
  'Okay, this is getting embarrassing. Just click YES! 🤣',
];

export interface ProviderGuide {
  id: ImportProvider;
  name: string;
  accentBg: string;
  accentText: string;
  steps: string[];
  sampleFormat: string;
}

export const ADDRESS_IMPORT_PROVIDERS: Record<ImportProvider, ProviderGuide> = {
  blinkit: {
    id: 'blinkit',
    name: 'Blinkit',
    accentBg: '#F8CB46',
    accentText: '#1C1917',
    steps: [
      'Open the Blinkit app and tap your delivery location at the top.',
      'Tap the three dots next to your saved address and copy the full address text.',
      'Come back here and tap "Paste from Clipboard" or paste it in the box below.',
    ],
    sampleFormat: 'Flat 402, Tower B, DLF Phase 4, Near Galleria Market, Gurugram, Haryana 122009',
  },
  amazon: {
    id: 'amazon',
    name: 'Amazon',
    accentBg: '#232F3E',
    accentText: '#FFFFFF',
    steps: [
      'Open Amazon → Your Account → Your Addresses.',
      'Long-press and copy your default delivery address block (including PIN & phone).',
      'Return here and paste it below — we will automatically split it into fields.',
    ],
    sampleFormat: 'H-104, Sector 62, Opposite Metro Station, Noida, Uttar Pradesh 201309, 9876543210',
  },
  zomato: {
    id: 'zomato',
    name: 'Zomato',
    accentBg: '#E23744',
    accentText: '#FFFFFF',
    steps: [
      'Open Zomato → Profile → Address Book.',
      'Copy your saved Home or Work delivery address text.',
      'Paste it below and review the auto-filled fields before confirming.',
    ],
    sampleFormat: '14B, Indiranagar 100 Feet Road, Near CMH Metro, Bengaluru, Karnataka 560038',
  },
  flipkart: {
    id: 'flipkart',
    name: 'Flipkart',
    accentBg: '#2874F0',
    accentText: '#FFFFFF',
    steps: [
      'Open Flipkart → Account → Saved Addresses.',
      'Copy your saved delivery address along with the 6-digit PIN code.',
      'Paste it below to populate your delivery form cleanly.',
    ],
    sampleFormat: 'B-205, Powai Vihar, Near Hiranandani Gardens, Mumbai, Maharashtra 400076',
  },
};

const GIFT_IDEAS_MAP: Record<string, string[]> = {
  reading: ['Hardcover bestseller + magnetic bookmark set', 'Warm clip-on book light & cozy reading socks'],
  gaming: ['RGB desk mat or controller stand', 'Retro handheld mini console or Steam gift card'],
  art: ['Premium watercolour brush-pen kit', 'Aesthetic hardbound sketchbook & fine liners'],
  music: ['Mini Bluetooth speaker or vinyl-style coasters', 'Acoustic desk organizer or headphone stand'],
  travelling: ['Personalized leather passport cover & luggage tag', 'Compact travel organizer pouch & neck pillow'],
  chocolate: ['Artisanal Belgian truffle gift hamper', 'Gourmet hot-chocolate bomb & ceramic mug set'],
  cooking: ['Artisan spice-blend jar collection', 'Personalized wooden chopping board or apron'],
  fitness: ['Insulated stainless-steel shaker bottle', 'Resistance band & recovery roller kit'],
  movies: ['Gourmet popcorn seasoning & cinema night box', 'Scratch-off 100 must-watch movies poster'],
  skincare: ['Hydrating sheet-mask & lip-balm festive trio', 'Scented soy candle + silk sleep mask'],
  coffee: ['Single-origin pour-over coffee sampler', 'Temperature-preserving insulated travel tumbler'],
  pets: ['Cute pet-themed ceramic mug & plush keychain', 'Matching festive bandana & treat jar'],
  plants: ['Ceramic self-watering indoor succulent planter', 'Mini brass plant mister & terracotta trio'],
  photography: ['Pocket tripod or vintage film photo album', 'Camera-lens coffee mug & Polaroid clip string lights'],
  technology: ['MagSafe wireless charging pad or cable organizer', 'Mechanical fidget keycap keychain'],
  collectibles: ['Mystery blind-box figurine or enamel pin set', 'Acrylic display stand with fairy lights'],
  fashion: ['Cozy winter knit scarf or satin scrunchie set', 'Minimalist jewelry travel box'],
  baking: ['Silicone baking mat + festive cookie cutters', 'Vanilla bean paste & ceramic mixing bowl'],
  anime: ['Chibi desk figure or manga box volume', 'Anime enamel pins & cozy graphic tote'],
  'k-dramas': ['Korean ramen bowl + chopsticks set', 'Cozy fleece blanket & matcha latte mix'],
};

export function getGiftIdeasForHobbies(hobbies: string[]): string[] {
  const ideas: string[] = [];
  for (const h of hobbies) {
    const key = h.toLowerCase().trim();
    const matched = GIFT_IDEAS_MAP[key];
    if (matched) {
      ideas.push(matched[0]);
    } else {
      ideas.push(`Curated "${h}" starter kit or personalized accessory`);
    }
  }
  if (ideas.length < 3) {
    ideas.push('Festive handwritten card paired with artisanal winter treats');
  }
  return ideas.slice(0, 4);
}
