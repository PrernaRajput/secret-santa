import type {
  AdventDaySurprise,
  DeliveryStage,
  ElfHidingSpotId,
  GingerbreadDecorationType,
  GingerbreadIcingColor,
  GingerbreadShape,
  ThankYouTemplateId,
  WheelPrizeDefinition,
} from '../types/secretSanta.ts';

export const MAILBOX_SUGGESTED_QUESTIONS: string[] = [
  "What's your favorite chocolate?",
  'Are you more into books or skincare?',
  "What's one thing you really don't want?",
  'Do you prefer practical or cute gifts?',
  'What colors do you love?',
  'Would you rather receive something handmade or store-bought?',
];

export const DETECTIVE_REACTIONS: string[] = [
  'Interesting theory, Detective! 👀',
  'Rudolph refuses to comment. 🦌',
  "Santa's lawyers advised him to stay silent.",
  'Evidence received. Mystery remains!',
  'A bold accusation. The elves are taking notes.',
];

export interface DeliveryStageInfo {
  id: DeliveryStage;
  label: string;
  emoji: string;
  senderPrompt: string;
  recipientMessage: string;
  checkpointPercent: number;
}

export const DELIVERY_STAGES: DeliveryStageInfo[] = [
  {
    id: 'preparing',
    label: 'Preparing Gift',
    emoji: '📝',
    senderPrompt: 'Brainstorming and checking clues',
    recipientMessage: 'Your Secret Santa is plotting a wonderful Christmas surprise! 📝',
    checkpointPercent: 10,
  },
  {
    id: 'shopping',
    label: 'Gift Ordered',
    emoji: '🛍️',
    senderPrompt: 'Gift shopping or online order placed',
    recipientMessage: 'Santa’s elves have ordered your special gift! 🛍️',
    checkpointPercent: 34,
  },
  {
    id: 'wrapped',
    label: 'Gift Wrapped',
    emoji: '🎀',
    senderPrompt: 'The present is wrapped & ready',
    recipientMessage: 'Your Secret Santa has wrapped something special for you! 🎀',
    checkpointPercent: 58,
  },
  {
    id: 'dispatched',
    label: 'Out for Delivery',
    emoji: '🛷',
    senderPrompt: 'Sleigh dispatched — gift is on its way',
    recipientMessage: 'Out for delivery! Your surprise is flying across the North Pole! 🛷',
    checkpointPercent: 82,
  },
  {
    id: 'delivered',
    label: 'Delivered',
    emoji: '🎁',
    senderPrompt: 'Marked as delivered by Santa',
    recipientMessage: 'Santa’s sleigh says your gift has been delivered! Confirm receipt below 🎁',
    checkpointPercent: 100,
  },
];

export const ADVENT_SURPRISES: AdventDaySurprise[] = [
  {
    day: 1,
    title: 'North Pole Welcome Bell',
    kind: 'ornament',
    emoji: '🔔',
    message: 'Welcome to December! Hang this Jingle Bell inside your Snow Globe!',
    collectibleId: 'orn-jingle-bell',
    collectibleName: 'Jingle Bell Ornament',
    collectibleEmoji: '🔔',
    globeDecorType: 'bell',
  },
  {
    day: 2,
    title: 'Christmas Trivia',
    kind: 'trivia',
    emoji: '🎄',
    message: 'Fun Fact: "Jingle Bells" was the very first song ever played in outer space in 1965!',
  },
  {
    day: 3,
    title: 'Elf Stand-Up Comedy',
    kind: 'joke',
    emoji: '🎤',
    message: 'What do you call an elf who sings? A wrapper! 🎤',
  },
  {
    day: 4,
    title: 'Festive Fortune',
    kind: 'fortune',
    emoji: '🔮',
    message: 'Your holiday fortune: Warm cocoa and an unexpectedly awesome gift are heading your way!',
  },
  {
    day: 5,
    title: 'Candy Cane Collectible',
    kind: 'ornament',
    emoji: '🍬',
    message: 'Unlocked the Peppermint Swirl ornament for your Snow Globe collection!',
    collectibleId: 'orn-candy-cane',
    collectibleName: 'Peppermint Candy Cane',
    collectibleEmoji: '🍬',
    globeDecorType: 'candy',
  },
  {
    day: 6,
    title: 'Mini Holiday Challenge',
    kind: 'challenge',
    emoji: '☕',
    message: 'Mini Challenge: Text a friend a terrible Christmas pun today and refuse to explain it!',
  },
  {
    day: 7,
    title: 'Golden Snowflake Unlock!',
    kind: 'ornament',
    emoji: '❄️',
    message: 'Day 7 Special! You unlocked a rare Golden Snowflake ornament for your Snow Globe!',
    collectibleId: 'orn-golden-snowflake',
    collectibleName: 'Golden Snowflake',
    collectibleEmoji: '❄️',
    globeDecorType: 'snowflake',
  },
  {
    day: 8,
    title: 'Snowman Riddle',
    kind: 'joke',
    emoji: '⛄',
    message: 'What do snowmen eat for breakfast? Frosted Flakes! ⛄',
  },
  {
    day: 9,
    title: 'Cozy Star Badge',
    kind: 'badge',
    emoji: '⭐',
    message: 'You earned the North Pole Stargazer badge! Equip it in your Snow Globe!',
    collectibleId: 'orn-north-star',
    collectibleName: 'North Pole Star',
    collectibleEmoji: '⭐',
    globeDecorType: 'star',
  },
  {
    day: 10,
    title: 'Holiday Trivia',
    kind: 'trivia',
    emoji: '🦌',
    message: 'Did you know? Both male and female reindeer grow antlers — so Santa’s sleigh team can be all-stars!',
  },
  {
    day: 11,
    title: 'Elf Mischief Fortune',
    kind: 'fortune',
    emoji: '🧝',
    message: 'A suspiciously well-wrapped parcel will make you smile twice as big this season.',
  },
  {
    day: 12,
    title: 'Reindeer Dance Party!',
    kind: 'animation',
    emoji: '🕺',
    message: 'Day 12 Bonus! Rudolph breaks out his legendary North Pole moonwalk just for you! 🦌💃',
    collectibleId: 'orn-dancing-reindeer',
    collectibleName: 'Disco Reindeer Charm',
    collectibleEmoji: '🦌',
    globeDecorType: 'reindeer',
  },
  {
    day: 13,
    title: 'Gingerbread Secret',
    kind: 'trivia',
    emoji: '🍪',
    message: 'Queen Elizabeth I is credited with serving the very first gingerbread person cookies!',
  },
  {
    day: 14,
    title: 'Mini Challenge',
    kind: 'challenge',
    emoji: '🎵',
    message: 'Hum a Christmas carol while making tea or coffee today. Bonus points for dramatic jazz hands.',
  },
  {
    day: 15,
    title: 'Crystal Bauble',
    kind: 'ornament',
    emoji: '🔮',
    message: 'Unlocked the Ruby Bauble ornament! Place it on your Snow Globe tree!',
    collectibleId: 'orn-ruby-bauble',
    collectibleName: 'Ruby Bauble',
    collectibleEmoji: '🔴',
    globeDecorType: 'bauble',
  },
  {
    day: 16,
    title: 'Santa Dad Joke',
    kind: 'joke',
    emoji: '🎅',
    message: 'Why does Santa go down the chimney? Because it soots him! 🎅',
  },
  {
    day: 17,
    title: 'Cozy Lantern Unlock',
    kind: 'ornament',
    emoji: '🏮',
    message: 'Unlocked the Warm Workshop Lantern ornament for your Snow Globe!',
    collectibleId: 'orn-workshop-lantern',
    collectibleName: 'Workshop Lantern',
    collectibleEmoji: '🏮',
    globeDecorType: 'lantern',
  },
  {
    day: 18,
    title: 'Secret Santa Fortune',
    kind: 'fortune',
    emoji: '🎁',
    message: 'Beware of rustling wrapping paper — someone has already been plotting your surprise!',
  },
  {
    day: 19,
    title: 'Holiday Challenge',
    kind: 'challenge',
    emoji: '💌',
    message: 'Send an anonymous clue or funny question in Santa’s Secret Mailbox today!',
  },
  {
    day: 20,
    title: 'Cocoa Mug Collectible',
    kind: 'ornament',
    emoji: '☕',
    message: 'Unlocked the Marshmallow Hot Cocoa charm for your Snow Globe!',
    collectibleId: 'orn-hot-cocoa',
    collectibleName: 'Hot Cocoa Charm',
    collectibleEmoji: '☕',
    globeDecorType: 'cocoa',
  },
  {
    day: 21,
    title: 'Winter Solstice Trivia',
    kind: 'trivia',
    emoji: '🌙',
    message: 'Longest night of the year! More moonlight for Santa’s test flights!',
  },
  {
    day: 22,
    title: 'Reindeer Comedy',
    kind: 'joke',
    emoji: '🦌',
    message: 'What do you call a reindeer with bad manners? Rude-olph! 🦌',
  },
  {
    day: 23,
    title: 'Silver Sleigh Bell',
    kind: 'badge',
    emoji: '🛷',
    message: 'Earned the Express Sleigh Crew ornament for your Snow Globe!',
    collectibleId: 'orn-mini-sleigh',
    collectibleName: 'Mini Golden Sleigh',
    collectibleEmoji: '🛷',
    globeDecorType: 'sleigh',
  },
  {
    day: 24,
    title: 'Christmas Eve Magic!',
    kind: 'animation',
    emoji: '✨',
    message: 'Santa’s sleigh is taking off! Listen closely for jingle bells tonight! ✨',
    collectibleId: 'orn-eve-comet',
    collectibleName: 'Christmas Eve Comet',
    collectibleEmoji: '🌠',
    globeDecorType: 'comet',
  },
  {
    day: 25,
    title: 'Merry Christmas Crown!',
    kind: 'ornament',
    emoji: '👑',
    message: 'Merry Christmas! You unlocked the Grand Workshop Crown ornament! 🎄🎁',
    collectibleId: 'orn-christmas-crown',
    collectibleName: 'Grand Workshop Crown',
    collectibleEmoji: '👑',
    globeDecorType: 'crown',
  },
];

export const WHEEL_PRIZES: WheelPrizeDefinition[] = [
  {
    id: 'wheel-nothing',
    slotIndex: 0,
    label: 'Proudly Nothing',
    shortLabel: 'Nothing 🥹',
    emoji: '🥹',
    kind: 'joke',
    message: "Congratulations! You've won absolutely nothing. Santa is proud. 🥹",
    color: '#ef4444',
    weight: 18,
  },
  {
    id: 'wheel-rectangular',
    slotIndex: 1,
    label: 'Rudolph Prophecy',
    shortLabel: 'Fortune 🦌',
    emoji: '🦌',
    kind: 'fortune',
    message: 'Rudolph says your next gift will be suspiciously rectangular.',
    color: '#f59e0b',
    weight: 18,
  },
  {
    id: 'wheel-chaos-ceo',
    slotIndex: 2,
    label: 'CEO of Christmas Chaos',
    shortLabel: 'Chaos Title 👑',
    emoji: '👑',
    kind: 'title',
    message: "You've earned the title: CEO of Christmas Chaos.",
    color: '#ec4899',
    weight: 14,
    collectibleId: 'badge-chaos-ceo',
    collectibleName: 'CEO of Christmas Chaos',
  },
  {
    id: 'wheel-golden-bell',
    slotIndex: 3,
    label: 'Rare Golden Bell',
    shortLabel: 'Rare Bell 🔔',
    emoji: '🔔',
    kind: 'ornament',
    message: 'Rare cosmetic drop! You won the Sparkling Golden Bell ornament for your Snow Globe!',
    color: '#10b981',
    weight: 8,
    collectibleId: 'orn-wheel-golden-bell',
    collectibleName: 'Sparkling Golden Bell',
  },
  {
    id: 'wheel-cookie-tax',
    slotIndex: 4,
    label: 'Cookie Inspector',
    shortLabel: 'Challenge 🍪',
    emoji: '🍪',
    kind: 'challenge',
    message: 'Holiday Challenge: Decorate a chaotic gingerbread cookie in Gingerbread Studio today!',
    color: '#6366f1',
    weight: 14,
  },
  {
    id: 'wheel-elf-badge',
    slotIndex: 5,
    label: 'Honorary Elf Badge',
    shortLabel: 'Elf Badge 🧝',
    emoji: '🧝',
    kind: 'badge',
    message: 'Official North Pole promotion! You earned the Honorary Chief Elf badge!',
    color: '#0ea5e9',
    weight: 10,
    collectibleId: 'badge-honorary-elf',
    collectibleName: 'Honorary Chief Elf',
  },
  {
    id: 'wheel-dad-joke',
    slotIndex: 6,
    label: 'Certified Groaner',
    shortLabel: 'Joke 🎄',
    emoji: '🎄',
    kind: 'joke',
    message: 'Why was the snowman looking through the carrots? He was picking his nose! 🥕',
    color: '#8b5cf6',
    weight: 12,
  },
  {
    id: 'wheel-disco-santa',
    slotIndex: 7,
    label: 'Disco Santa Dance',
    shortLabel: 'Dance ✨',
    emoji: '🪩',
    kind: 'animation',
    message: 'Secret Unlock! Santa just threw confetti and did a festive twirl for your luck! ✨',
    color: '#f97316',
    weight: 6,
    collectibleId: 'orn-wheel-disco-star',
    collectibleName: 'Disco Santa Star',
  },
];

export interface QuizQuestion {
  id: string;
  question: string;
  options: { label: string; nicePoints: number }[];
}

export const NAUGHTY_NICE_QUIZ_VERSION = 'v1-2026';

export const NAUGHTY_NICE_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'You see the last chocolate on the table. What do you do?',
    options: [
      { label: 'Share it.', nicePoints: 25 },
      { label: 'Eat it immediately.', nicePoints: 10 },
      { label: 'Hide it for later.', nicePoints: 5 },
      { label: 'Pretend you never saw it.', nicePoints: 14 },
    ],
  },
  {
    id: 'q2',
    question: 'How early do you buy Christmas gifts?',
    options: [
      { label: 'Months in advance.', nicePoints: 25 },
      { label: 'A week before.', nicePoints: 19 },
      { label: 'The night before.', nicePoints: 10 },
      { label: "Wait, we're buying gifts?", nicePoints: 3 },
    ],
  },
  {
    id: 'q3',
    question: 'You accidentally spot a gift box with your name on it early. Your move?',
    options: [
      { label: 'Walk away respectfully.', nicePoints: 25 },
      { label: 'Give it one tiny investigative shake.', nicePoints: 13 },
      { label: 'Measure it and run weight calculations.', nicePoints: 8 },
      { label: 'Peek under the tape and blame the cat.', nicePoints: 2 },
    ],
  },
  {
    id: 'q4',
    question: 'How do you wrap presents?',
    options: [
      { label: 'Crisp folds, ribbon, and handmade tag.', nicePoints: 25 },
      { label: 'Cute gift bag + tissue paper saves lives.', nicePoints: 19 },
      { label: '47 pieces of tape and pure hope.', nicePoints: 12 },
      { label: 'Original Amazon cardboard box = rustic chic.', nicePoints: 5 },
    ],
  },
  {
    id: 'q5',
    question: 'Someone sends you an anonymous Secret Santa message. You reply...',
    options: [
      { label: 'With warm festive thanks and helpful clues!', nicePoints: 25 },
      { label: 'With dramatic detective interrogation questions.', nicePoints: 15 },
      { label: 'With cryptic riddles to confuse them back.', nicePoints: 9 },
      { label: 'By asking if they are secretly buying me a yacht.', nicePoints: 6 },
    ],
  },
];

export const ELF_HIDING_SPOTS: {
  id: ElfHidingSpotId;
  label: string;
  hint: string;
  emoji: string;
}[] = [
  {
    id: 'tree',
    label: 'Behind the Christmas Tree',
    hint: 'Check near the twinkling pine branches in Santa’s Workshop!',
    emoji: '🎄',
  },
  {
    id: 'mailbox',
    label: 'Peeking from the Mailbox',
    hint: 'An elf might be reading secret envelopes near the mailbox corner!',
    emoji: '📮',
  },
  {
    id: 'giftbox',
    label: 'Inside a Ribboned Gift Box',
    hint: 'Watch the stacked holiday parcels — one box is blinking!',
    emoji: '🎁',
  },
  {
    id: 'calendar',
    label: 'Behind an Advent Door',
    hint: 'Check around the numbered wooden calendar cottage!',
    emoji: '📅',
  },
  {
    id: 'footer',
    label: 'By the Festive Footer Garland',
    hint: 'Look down near the bottom workshop trim!',
    emoji: '🎀',
  },
  {
    id: 'snowsign',
    label: 'Behind the North Pole Signpost',
    hint: 'Check the frosty signpost near the workshop header!',
    emoji: '🪧',
  },
];

export const ELF_DAILY_REWARDS: {
  title: string;
  emoji: string;
  collectibleId: string;
  joke: string;
}[] = [
  {
    title: 'Mischievous Elf Hat Ornament',
    emoji: '🧝',
    collectibleId: 'orn-elf-hat',
    joke: "You found me! I was supposed to be working. Don't tell Santa. 🤫",
  },
  {
    title: 'Tiny Toy Train Charm',
    emoji: '🚂',
    collectibleId: 'orn-toy-train',
    joke: "Busted! Here's a shiny Toy Train ornament — pretend you saw nothing! 🤫",
  },
  {
    title: 'Frosty Mitten Badge',
    emoji: '🧤',
    collectibleId: 'orn-frosty-mitten',
    joke: "Okay okay, I was sneaking extra marshmallows! Take this ornament! 🧤",
  },
  {
    title: 'Peppermint Star Ornament',
    emoji: '🌟',
    collectibleId: 'orn-peppermint-star',
    joke: "My stealth training failed! You earned a Peppermint Star for your Snow Globe! 🌟",
  },
];

export const GINGERBREAD_SHAPES: { id: GingerbreadShape; label: string; emoji: string }[] = [
  { id: 'person', label: 'Gingerbread Buddy', emoji: '🍪' },
  { id: 'tree', label: 'Christmas Tree', emoji: '🎄' },
  { id: 'star', label: 'Festive Star', emoji: '⭐' },
  { id: 'reindeer', label: 'Reindeer Cookie', emoji: '🦌' },
];

export const GINGERBREAD_ICING_COLORS: {
  id: GingerbreadIcingColor;
  label: string;
  hex: string;
}[] = [
  { id: 'white', label: 'Snow White', hex: '#fffdf7' },
  { id: 'pink', label: 'Berry Pink', hex: '#f472b6' },
  { id: 'red', label: 'Candy Red', hex: '#ef4444' },
  { id: 'green', label: 'Holly Green', hex: '#22c55e' },
  { id: 'chocolate', label: 'Fudge Cocoa', hex: '#451a03' },
];

export interface GingerbreadDecorationOption {
  type: GingerbreadDecorationType;
  label: string;
  emoji: string;
  svgUrl?: string;
  category: 'svg' | 'classic';
  defaultScale?: number;
}

export const GINGERBREAD_DECORATIONS: GingerbreadDecorationOption[] = [
  // 21 Uploaded SVG Stickers
  {
    type: 'svg-eye-outline',
    label: 'Line Eye',
    emoji: '👁️',
    svgUrl: '/assets/aistudio/eye-svgrepo-com_c89e0e15.svg',
    category: 'svg',
    defaultScale: 0.75,
  },
  {
    type: 'svg-eye-brown',
    label: 'Cute Eye',
    emoji: '👀',
    svgUrl: '/assets/aistudio/eye-svgrepo-com__1__2caff33d.svg',
    category: 'svg',
    defaultScale: 0.75,
  },
  {
    type: 'svg-bow-pink',
    label: 'Pink Bow',
    emoji: '🎀',
    svgUrl: '/assets/aistudio/bow-svgrepo-com_bf459028.svg',
    category: 'svg',
    defaultScale: 1.0,
  },
  {
    type: 'svg-bowtie-navy',
    label: 'Navy Bow Tie',
    emoji: '🎀',
    svgUrl: '/assets/aistudio/bow-fashion-hipster-svgrepo-com_d68f23aa.svg',
    category: 'svg',
    defaultScale: 1.0,
  },
  {
    type: 'svg-hat-butterfly',
    label: 'Sun Hat',
    emoji: '👒',
    svgUrl: '/assets/aistudio/hat-svgrepo-com_692c8bd2.svg',
    category: 'svg',
    defaultScale: 1.25,
  },
  {
    type: 'svg-hat-fedora',
    label: 'Classic Hat',
    emoji: '🎩',
    svgUrl: '/assets/aistudio/hat-svgrepo-com__1__75515b80.svg',
    category: 'svg',
    defaultScale: 1.2,
  },
  {
    type: 'svg-scarf-cozy',
    label: 'Short Scarf',
    emoji: '🧣',
    svgUrl: '/assets/aistudio/scarf-svgrepo-com_62233f08.svg',
    category: 'svg',
    defaultScale: 1.15,
  },
  {
    type: 'svg-scarf-long',
    label: 'Winter Scarf',
    emoji: '🧣',
    svgUrl: '/assets/aistudio/scarf-svgrepo-com__1__3369cf98.svg',
    category: 'svg',
    defaultScale: 1.2,
  },
  {
    type: 'svg-glasses-sparkle',
    label: 'Sparkle Specs',
    emoji: '👓',
    svgUrl: '/assets/aistudio/glasses-svgrepo-com_c0d4bb49.svg',
    category: 'svg',
    defaultScale: 1.1,
  },
  {
    type: 'svg-glasses-retro',
    label: 'Retro Glasses',
    emoji: '🕶️',
    svgUrl: '/assets/aistudio/glasses-svgrepo-com__1__c44bab10.svg',
    category: 'svg',
    defaultScale: 1.1,
  },
  {
    type: 'svg-glasses-reading',
    label: 'Reading Specs',
    emoji: '👓',
    svgUrl: '/assets/aistudio/glasses-reading-glasses-svgrepo-com_f42cec95.svg',
    category: 'svg',
    defaultScale: 1.1,
  },
  {
    type: 'svg-snow-globe',
    label: 'Snow Globe',
    emoji: '🔮',
    svgUrl: '/assets/aistudio/christmas-snow-globe-svgrepo-com_089cc80b.svg',
    category: 'svg',
    defaultScale: 1.0,
  },
  {
    type: 'svg-holly',
    label: 'Holly Berries',
    emoji: '🌿',
    svgUrl: '/assets/aistudio/christmas-plant-svgrepo-com_e0dd61bd.svg',
    category: 'svg',
    defaultScale: 0.95,
  },
  {
    type: 'svg-candy-cane',
    label: 'Candy Cane',
    emoji: '🍬',
    svgUrl: '/assets/aistudio/candy-cane-svgrepo-com_5ac3bf2b.svg',
    category: 'svg',
    defaultScale: 1.05,
  },
  {
    type: 'svg-gift-box',
    label: 'Gift Box',
    emoji: '🎁',
    svgUrl: '/assets/aistudio/christmas-gift-svgrepo-com_93cb1e28.svg',
    category: 'svg',
    defaultScale: 1.0,
  },
  {
    type: 'svg-string-lights',
    label: 'String Lights',
    emoji: '💡',
    svgUrl: '/assets/aistudio/christmas-string-lights-svgrepo-com_4383a4e4.svg',
    category: 'svg',
    defaultScale: 1.35,
  },
  {
    type: 'svg-gold-star',
    label: 'Gold Star',
    emoji: '⭐',
    svgUrl: '/assets/aistudio/christmas-star-svgrepo-com_be2a3d81.svg',
    category: 'svg',
    defaultScale: 1.0,
  },
  {
    type: 'svg-ball-star',
    label: 'Star Bauble',
    emoji: '🎄',
    svgUrl: '/assets/aistudio/ball-svgrepo-com_1235ff65.svg',
    category: 'svg',
    defaultScale: 0.95,
  },
  {
    type: 'svg-ball-red',
    label: 'Red Ornament',
    emoji: '🔴',
    svgUrl: '/assets/aistudio/xmas-ball-svgrepo-com_6075f150.svg',
    category: 'svg',
    defaultScale: 0.95,
  },
  {
    type: 'svg-bauble-green-red',
    label: 'Holly Bauble',
    emoji: '🎄',
    svgUrl: '/assets/aistudio/bauble-ornament-svgrepo-com_1110db89.svg',
    category: 'svg',
    defaultScale: 0.95,
  },
  {
    type: 'svg-bauble-gold-red',
    label: 'Gold Bauble',
    emoji: '✨',
    svgUrl: '/assets/aistudio/bauble-ornament-svgrepo-com__1__df1071c3.svg',
    category: 'svg',
    defaultScale: 0.95,
  },
  // Classic Emoji Toppings
  { type: 'sprinkles', label: 'Sprinkles', emoji: '✨', category: 'classic', defaultScale: 1.0 },
  { type: 'button', label: 'Candy Buttons', emoji: '🔴', category: 'classic', defaultScale: 0.9 },
  { type: 'eye', label: 'Candy Eyes', emoji: '👀', category: 'classic', defaultScale: 0.9 },
  { type: 'bowtie', label: 'Bow Tie', emoji: '🎀', category: 'classic', defaultScale: 1.0 },
  { type: 'santa-hat', label: 'Santa Hat', emoji: '🎅', category: 'classic', defaultScale: 1.1 },
  { type: 'scarf', label: 'Cozy Scarf', emoji: '🧣', category: 'classic', defaultScale: 1.0 },
  { type: 'choco-chip', label: 'Choco Chips', emoji: '🍫', category: 'classic', defaultScale: 0.9 },
  { type: 'heart', label: 'Sugar Heart', emoji: '❤️', category: 'classic', defaultScale: 0.95 },
  { type: 'snowflake', label: 'Snowflake', emoji: '❄️', category: 'classic', defaultScale: 0.95 },
];

export const DISLIKE_CATEGORY_SUGGESTIONS: string[] = [
  'Scented candles',
  'Coffee mugs',
  'Dark chocolate',
  'Strong perfumes',
  'Keychains',
  'Showpieces',
  'Spicy snacks',
  'Notebooks',
  'Soft toys',
  'Jewelry',
];

export const DISLIKE_COLOR_SUGGESTIONS: string[] = [
  'Neon Yellow',
  'Bright Orange',
  'Hot Pink',
  'Brown',
  'Grey',
  'Purple',
];

export const THANK_YOU_TEMPLATES: {
  id: ThankYouTemplateId;
  title: string;
  emoji: string;
  gradient: string;
  description: string;
}[] = [
  {
    id: 'santa-heart',
    title: 'Santa Holding a Heart',
    emoji: '🎅💝',
    gradient: 'from-rose-500 via-red-500 to-amber-500',
    description: 'Warm North Pole hugs from Santa himself',
  },
  {
    id: 'reindeer-hug',
    title: 'Reindeer Hugging a Gift',
    emoji: '🦌🎁',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    description: 'Rudolph approved your gift choice 10/10',
  },
  {
    id: 'snowman-wave',
    title: 'Snowman Waving',
    emoji: '⛄❄️',
    gradient: 'from-sky-500 via-indigo-500 to-purple-500',
    description: 'Frosty cheers & snowy sparkles',
  },
  {
    id: 'gingerbread-dance',
    title: 'Gingerbread Dancing',
    emoji: '🍪🕺',
    gradient: 'from-amber-700 via-amber-600 to-yellow-500',
    description: 'Sweet victory wiggle straight from the oven',
  },
  {
    id: 'choco-hearts',
    title: 'Chocolate Hearts Falling',
    emoji: '🍫❤️',
    gradient: 'from-[#5c2d0c] via-[#92400e] to-rose-600',
    description: 'Rich cocoa love raining from the sky',
  },
];

export const THANK_YOU_SUGGESTED_MESSAGES: string[] = [
  'This gift absolutely made my day! 🎁',
  'Whoever you are, you understood the assignment! 😂',
  'Santa, you have excellent taste.',
  '10/10 would get surprised again.',
];

export const THANK_YOU_REACTIONS: string[] = ['🎉', '❤️', '🥹', '🎁', '✨', '🙌', '🍫', '🎅'];

export const BUDGET_PRESETS = [
  { label: '₹500', min: 500, max: 500, mode: 'fixed' as const },
  { label: '₹1,000', min: 1000, max: 1000, mode: 'fixed' as const },
  { label: '₹1,500', min: 1500, max: 1500, mode: 'fixed' as const },
  { label: '₹2,000', min: 2000, max: 2000, mode: 'fixed' as const },
  { label: '₹500–₹1,000', min: 500, max: 1000, mode: 'range' as const },
];
