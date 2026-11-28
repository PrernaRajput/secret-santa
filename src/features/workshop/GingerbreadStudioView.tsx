import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Cookie,
  Minus,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  GingerbreadDecorationItem,
  GingerbreadDecorationType,
  GingerbreadDesign,
  GingerbreadIcingColor,
  GingerbreadShape,
  SecretSantaEvent,
  ThemeId,
} from '../../types/secretSanta';
import { THEME_CONFIGS } from '../../components/themes/ThemeConfig';
import {
  GINGERBREAD_DECORATIONS,
  GINGERBREAD_ICING_COLORS,
  GINGERBREAD_SHAPES,
  GingerbreadDecorationOption,
} from '../../data/workshopContent';
import {
  fetchGingerbreadDesign,
  saveGingerbreadDesign,
} from '../../services/workshopService';
import { playOvenBellSound, playPopSound } from '../../utils/sound';

interface GingerbreadStudioViewProps {
  theme: ThemeId;
  event: SecretSantaEvent;
  participantKey: string;
  liveMode: boolean;
  onSaved?: (design: GingerbreadDesign) => void;
}

type PaletteFilter = 'svg' | 'classic' | 'all';

const DECORATION_MAP: Record<GingerbreadDecorationType, GingerbreadDecorationOption> =
  GINGERBREAD_DECORATIONS.reduce(
    (acc, item) => {
      acc[item.type] = item;
      return acc;
    },
    {} as Record<GingerbreadDecorationType, GingerbreadDecorationOption>
  );

const LEVEL_PLACEMENT_TYPES = new Set<GingerbreadDecorationType>([
  'eye',
  'bowtie',
  'santa-hat',
  'scarf',
  'svg-eye-outline',
  'svg-eye-brown',
  'svg-bow-pink',
  'svg-bowtie-navy',
  'svg-hat-butterfly',
  'svg-hat-fedora',
  'svg-scarf-cozy',
  'svg-scarf-long',
  'svg-glasses-sparkle',
  'svg-glasses-retro',
  'svg-glasses-reading',
  'svg-string-lights',
  'svg-snow-globe',
  'svg-gift-box',
]);

function clampScale(value: number): number {
  return Math.round(Math.max(0.6, Math.min(1.6, value)) * 100) / 100;
}

function clampRotation(value: number): number {
  return Math.round(Math.max(-45, Math.min(45, value)));
}

function renderCookieShapePath(shape: GingerbreadShape, icingHex: string) {
  switch (shape) {
    case 'tree':
      return (
        <g>
          <path
            d="M 100 18 L 152 82 L 132 82 L 166 134 L 140 134 L 176 178 L 24 178 L 60 134 L 34 134 L 68 82 L 48 82 Z"
            fill="#b45309"
            stroke={icingHex}
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <rect x="86" y="176" width="28" height="18" rx="4" fill="#78350f" />
        </g>
      );
    case 'star':
      return (
        <path
          d="M 100 16 L 122 72 L 182 76 L 136 114 L 151 174 L 100 140 L 49 174 L 64 114 L 18 76 L 78 72 Z"
          fill="#b45309"
          stroke={icingHex}
          strokeWidth="6"
          strokeLinejoin="round"
        />
      );
    case 'reindeer':
      return (
        <g>
          <path
            d="M 66 56 L 44 22 M 55 38 L 36 42 M 134 56 L 156 22 M 145 38 L 164 42"
            stroke="#78350f"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <ellipse cx="60" cy="64" rx="18" ry="11" fill="#b45309" stroke={icingHex} strokeWidth="5" />
          <ellipse cx="140" cy="64" rx="18" ry="11" fill="#b45309" stroke={icingHex} strokeWidth="5" />
          <ellipse cx="100" cy="112" rx="56" ry="62" fill="#b45309" stroke={icingHex} strokeWidth="6" />
          <ellipse cx="100" cy="134" rx="30" ry="22" fill="#d97706" />
          <circle cx="100" cy="126" r="10" fill="#dc2626" />
        </g>
      );
    case 'person':
    default:
      return (
        <g>
          {/* Head */}
          <circle cx="100" cy="52" r="30" fill="#b45309" stroke={icingHex} strokeWidth="5.5" />
          {/* Arms & Torso & Legs */}
          <path
            d="M 76 80 L 32 94 C 22 97 22 115 36 117 L 70 112 L 66 146 L 48 180 C 44 190 60 196 68 186 L 94 154 L 106 154 L 132 186 C 140 196 156 190 152 180 L 134 146 L 130 112 L 164 117 C 178 115 178 97 168 94 L 124 80 Z"
            fill="#b45309"
            stroke={icingHex}
            strokeWidth="5.5"
            strokeLinejoin="round"
          />
          {/* Classic Smile */}
          <path
            d="M 88 58 Q 100 68 112 58"
            fill="none"
            stroke={icingHex}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </g>
      );
  }
}

function renderDecorationVisual(
  type: GingerbreadDecorationType,
  sizeMode: 'canvas' | 'palette' | 'badge'
) {
  const meta = DECORATION_MAP[type];
  if (meta?.svgUrl) {
    const imgClass =
      sizeMode === 'canvas'
        ? 'w-10 h-10 sm:w-11 sm:h-11 object-contain pointer-events-none select-none'
        : sizeMode === 'palette'
          ? 'w-6 h-6 object-contain pointer-events-none select-none shrink-0'
          : 'w-4 h-4 object-contain pointer-events-none select-none shrink-0';
    return <img src={meta.svgUrl} alt={meta.label} draggable={false} className={imgClass} />;
  }

  const emojiClass =
    sizeMode === 'canvas'
      ? 'text-2xl sm:text-3xl leading-none pointer-events-none select-none'
      : sizeMode === 'palette'
        ? 'text-lg leading-none pointer-events-none select-none shrink-0'
        : 'text-sm leading-none pointer-events-none select-none shrink-0';
  return <span className={emojiClass}>{meta?.emoji ?? '✨'}</span>;
}

export const GingerbreadCookiePreview: React.FC<{
  design: GingerbreadDesign;
  size?: number;
}> = ({ design, size = 64 }) => {
  const icingHex =
    GINGERBREAD_ICING_COLORS.find((c) => c.id === design.icingColor)?.hex || '#fffdf7';
  return (
    <div
      style={{ width: size, height: size }}
      className="relative rounded-2xl bg-amber-100/80 border border-amber-300 overflow-hidden shrink-0 select-none"
      aria-label="Custom Gingerbread Cookie"
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {renderCookieShapePath(design.shape, icingHex)}
      </svg>
      {design.decorations.map((dec) => {
        const meta = DECORATION_MAP[dec.type];
        if (meta?.svgUrl) {
          const basePx = Math.max(10, Math.round(size * 0.16));
          return (
            <img
              key={dec.id}
              src={meta.svgUrl}
              alt={meta.label}
              draggable={false}
              style={{
                left: `${dec.x}%`,
                top: `${dec.y}%`,
                width: basePx,
                height: basePx,
                transform: `translate(-50%, -50%) scale(${dec.scale}) rotate(${dec.rotation}deg)`,
              }}
              className="absolute object-contain pointer-events-none select-none"
            />
          );
        }
        return (
          <span
            key={dec.id}
            style={{
              left: `${dec.x}%`,
              top: `${dec.y}%`,
              transform: `translate(-50%, -50%) scale(${dec.scale * (size / 220)}) rotate(${dec.rotation}deg)`,
            }}
            className="absolute text-2xl pointer-events-none leading-none"
          >
            {meta?.emoji ?? '✨'}
          </span>
        );
      })}
    </div>
  );
};

export const GingerbreadStudioView: React.FC<GingerbreadStudioViewProps> = ({
  theme,
  event,
  participantKey,
  liveMode,
  onSaved,
}) => {
  const cfg = THEME_CONFIGS[theme];
  const [shape, setShape] = useState<GingerbreadShape>('person');
  const [icingColor, setIcingColor] = useState<GingerbreadIcingColor>('white');
  const [decorations, setDecorations] = useState<GingerbreadDecorationItem[]>([
    { id: 'init-1', type: 'svg-eye-brown', x: 44, y: 24, scale: 0.72, rotation: 0 },
    { id: 'init-2', type: 'svg-eye-brown', x: 56, y: 24, scale: 0.72, rotation: 0 },
    { id: 'init-3', type: 'svg-bowtie-navy', x: 50, y: 42, scale: 1.0, rotation: 0 },
    { id: 'init-4', type: 'svg-ball-red', x: 50, y: 58, scale: 0.85, rotation: 0 },
  ]);
  const [paletteFilter, setPaletteFilter] = useState<PaletteFilter>('svg');
  const [activeTool, setActiveTool] = useState<GingerbreadDecorationType>('svg-candy-cane');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPublicProfileDecor, setIsPublicProfileDecor] = useState(true);
  const [undoStack, setUndoStack] = useState<GingerbreadDecorationItem[][]>([]);
  const [redoStack, setRedoStack] = useState<GingerbreadDecorationItem[][]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dragSnapshotRef = useRef<GingerbreadDecorationItem[] | null>(null);
  const dragMovedRef = useRef(false);

  const svgCount = useMemo(
    () => GINGERBREAD_DECORATIONS.filter((d) => d.category === 'svg').length,
    []
  );
  const classicCount = useMemo(
    () => GINGERBREAD_DECORATIONS.filter((d) => d.category === 'classic').length,
    []
  );
  const visibleDecorations = useMemo(() => {
    if (paletteFilter === 'all') return GINGERBREAD_DECORATIONS;
    return GINGERBREAD_DECORATIONS.filter((d) => d.category === paletteFilter);
  }, [paletteFilter]);

  const selectedDecoration = useMemo(
    () => decorations.find((d) => d.id === selectedId) ?? null,
    [decorations, selectedId]
  );

  useEffect(() => {
    let active = true;
    fetchGingerbreadDesign(participantKey, event.id, liveMode).then((existing) => {
      if (active && existing) {
        setShape(existing.shape);
        setIcingColor(existing.icingColor);
        setDecorations(existing.decorations);
        setIsPublicProfileDecor(existing.isPublicProfileDecor);
        setSelectedId(null);
      }
    });
    return () => {
      active = false;
    };
  }, [participantKey, event.id, liveMode]);

  const commitDecorations = (next: GingerbreadDecorationItem[]) => {
    setUndoStack((prev) => [...prev.slice(-15), decorations]);
    setRedoStack([]);
    setDecorations(next);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingId || dragMovedRef.current || !boardRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (decorations.length >= 24) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    playPopSound();
    const toolMeta = DECORATION_MAP[activeTool];
    const defaultRotation = LEVEL_PLACEMENT_TYPES.has(activeTool)
      ? 0
      : Math.round((Math.random() - 0.5) * 16);
    const item: GingerbreadDecorationItem = {
      id: `dec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: activeTool,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      scale: clampScale(toolMeta?.defaultScale ?? 1),
      rotation: defaultRotation,
    };
    commitDecorations([...decorations, item]);
    setSelectedId(item.id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingId || !boardRef.current) return;
    dragMovedRef.current = true;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
    setDecorations((prev) =>
      prev.map((d) =>
        d.id === draggingId ? { ...d, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 } : d
      )
    );
  };

  const finishDragging = () => {
    if (draggingId && dragMovedRef.current && dragSnapshotRef.current) {
      const snapshot = dragSnapshotRef.current;
      setUndoStack((prev) => [...prev.slice(-15), snapshot]);
      setRedoStack([]);
    }
    dragSnapshotRef.current = null;
    setDraggingId(null);
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
  };

  const adjustSelectedDecoration = (
    updater: (item: GingerbreadDecorationItem) => GingerbreadDecorationItem
  ) => {
    if (!selectedId) return;
    playPopSound();
    commitDecorations(decorations.map((item) => (item.id === selectedId ? updater(item) : item)));
  };

  const removeSelectedDecoration = () => {
    if (!selectedId) return;
    playPopSound();
    commitDecorations(decorations.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r, decorations]);
    setUndoStack((u) => u.slice(0, -1));
    setDecorations(previous);
    setSelectedId(null);
    playPopSound();
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u, decorations]);
    setRedoStack((r) => r.slice(0, -1));
    setDecorations(next);
    setSelectedId(null);
    playPopSound();
  };

  const handleClear = () => {
    if (decorations.length === 0) return;
    commitDecorations([]);
    setSelectedId(null);
    playPopSound();
  };

  const handleSaveBake = async () => {
    setSaving(true);
    try {
      const saved = await saveGingerbreadDesign(
        {
          eventId: event.id,
          participantKey,
          shape,
          icingColor,
          decorations,
          isPublicProfileDecor,
        },
        liveMode
      );
      onSaved?.(saved);
      playOvenBellSound();
      setSavedNotice(true);
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#ef4444', '#ffffff'],
      });
      window.setTimeout(() => setSavedNotice(false), 3200);
    } finally {
      setSaving(false);
    }
  };

  const icingHex =
    GINGERBREAD_ICING_COLORS.find((c) => c.id === icingColor)?.hex || '#fffdf7';
  const activeToolMeta = DECORATION_MAP[activeTool];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-700 inline-flex items-center gap-1.5">
            <Cookie className="w-3.5 h-3.5" />
            Santa&apos;s Cozy Bakery
          </p>
          <h2 className={`font-display text-2xl sm:text-3xl font-bold ${cfg.cardText}`}>
            Gingerbread Studio 🍪
          </h2>
          <p className={`text-xs sm:text-sm ${cfg.mutedText}`}>
            Tap the cookie to place stickers, drag to move, tap a sticker to resize/tilt, or double-tap to remove!
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            aria-label="Undo topping"
            className="min-h-[38px] px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            aria-label="Redo topping"
            className="min-h-[38px] px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
          >
            <Redo2 className="w-3.5 h-3.5" />
            Redo
          </button>
          <button
            type="button"
            disabled={decorations.length === 0}
            onClick={handleClear}
            aria-label="Clear toppings"
            className="min-h-[38px] px-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1 text-xs font-bold"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Interactive Baking Tray Canvas */}
        <div className="md:col-span-6 space-y-3">
          <div
            ref={boardRef}
            onClick={handleCanvasClick}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDragging}
            onPointerCancel={finishDragging}
            onPointerLeave={finishDragging}
            className="relative aspect-square w-full max-w-[340px] mx-auto rounded-3xl bg-gradient-to-br from-[#fef3c7] via-[#fde68a]/60 to-[#f5d0a9] border-4 border-amber-800/30 shadow-inner overflow-hidden cursor-crosshair select-none touch-none"
          >
            {/* Subtle parchment grid */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(#92400e 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
            />

            <svg viewBox="0 0 200 200" className="w-full h-full p-4 pointer-events-none drop-shadow-md">
              {renderCookieShapePath(shape, icingHex)}
            </svg>

            {decorations.map((dec) => {
              const isSelected = dec.id === selectedId;
              return (
                <motion.button
                  key={dec.id}
                  type="button"
                  initial={{ scale: 0.4, opacity: 0, rotate: dec.rotation }}
                  animate={{ scale: dec.scale, opacity: 1, rotate: dec.rotation }}
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(dec.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    playPopSound();
                    commitDecorations(decorations.filter((item) => item.id !== dec.id));
                    if (selectedId === dec.id) setSelectedId(null);
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setSelectedId(dec.id);
                    dragSnapshotRef.current = decorations;
                    dragMovedRef.current = false;
                    setDraggingId(dec.id);
                  }}
                  style={{
                    left: `${dec.x}%`,
                    top: `${dec.y}%`,
                    x: '-50%',
                    y: '-50%',
                  }}
                  title="Drag to move · Tap to resize/tilt · Double-click to remove"
                  className={`absolute p-0.5 rounded-xl cursor-grab active:cursor-grabbing leading-none select-none drop-shadow flex items-center justify-center ${
                    isSelected
                      ? 'ring-2 ring-rose-500/80 bg-white/35 z-10'
                      : 'hover:ring-1 hover:ring-amber-700/40'
                  }`}
                >
                  {renderDecorationVisual(dec.type, 'canvas')}
                </motion.button>
              );
            })}

            <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-between text-[11px] font-bold text-amber-950/80 pointer-events-none">
              <span className="px-2 py-0.5 rounded-full bg-amber-50/85 border border-amber-200/80">
                Toppings: {decorations.length}/24
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-50/85 border border-amber-200/80 inline-flex items-center gap-1.5">
                <span>Active:</span>
                {renderDecorationVisual(activeTool, 'badge')}
                <span className="max-w-[90px] truncate">{activeToolMeta?.label}</span>
              </span>
            </div>
          </div>

          {/* Selected Topping Fine-Tune Bar */}
          {selectedDecoration && (
            <div className="max-w-[340px] mx-auto rounded-2xl bg-white/95 border border-amber-200 px-3 py-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 min-w-0">
                {renderDecorationVisual(selectedDecoration.type, 'badge')}
                <span className="truncate max-w-[96px]">
                  {DECORATION_MAP[selectedDecoration.type]?.label}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    adjustSelectedDecoration((item) => ({
                      ...item,
                      scale: clampScale(item.scale - 0.15),
                    }))
                  }
                  aria-label="Make topping smaller"
                  title="Smaller"
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 inline-flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    adjustSelectedDecoration((item) => ({
                      ...item,
                      scale: clampScale(item.scale + 0.15),
                    }))
                  }
                  aria-label="Make topping bigger"
                  title="Bigger"
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 inline-flex items-center justify-center cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    adjustSelectedDecoration((item) => ({
                      ...item,
                      rotation: clampRotation(item.rotation - 15),
                    }))
                  }
                  aria-label="Rotate topping left"
                  title="Tilt left"
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 inline-flex items-center justify-center cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    adjustSelectedDecoration((item) => ({
                      ...item,
                      rotation: clampRotation(item.rotation + 15),
                    }))
                  }
                  aria-label="Rotate topping right"
                  title="Tilt right"
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-amber-100 text-slate-700 inline-flex items-center justify-center cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={removeSelectedDecoration}
                  aria-label="Remove selected topping"
                  title="Remove"
                  className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 inline-flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bakery Controls */}
        <div className="md:col-span-6 space-y-4">
          {/* Cookie Shape */}
          <div className="space-y-1.5">
            <p className={`text-xs font-bold ${cfg.cardText}`}>1. Cookie Cutter Shape</p>
            <div className="grid grid-cols-2 gap-2">
              {GINGERBREAD_SHAPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setShape(s.id);
                  }}
                  className={`min-h-[42px] px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                    shape === s.id
                      ? 'bg-amber-200 border-amber-500 text-amber-950 shadow-sm'
                      : 'bg-white/85 border-slate-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="text-base">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Icing Color */}
          <div className="space-y-1.5">
            <p className={`text-xs font-bold ${cfg.cardText}`}>2. Piping Icing Trim</p>
            <div className="flex flex-wrap gap-2">
              {GINGERBREAD_ICING_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setIcingColor(c.id);
                  }}
                  className={`min-h-[38px] px-3 py-1.5 rounded-full border text-xs font-bold inline-flex items-center gap-2 cursor-pointer ${
                    icingColor === c.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-800 border-slate-200'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-black/20"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topping Palette */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={`text-xs font-bold ${cfg.cardText}`}>
                3. Pick a Decoration &amp; Tap the Cookie
              </p>
              <div className="inline-flex rounded-xl bg-amber-100/70 p-0.5 border border-amber-200">
                {(
                  [
                    { id: 'svg', label: `Stickers (${svgCount})` },
                    { id: 'classic', label: `Classic (${classicCount})` },
                    { id: 'all', label: `All (${svgCount + classicCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPaletteFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      paletteFilter === tab.id
                        ? 'bg-white text-amber-950 shadow-sm'
                        : 'text-amber-900/70 hover:text-amber-950'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 max-h-[240px] overflow-y-auto pr-1">
              {visibleDecorations.map((d) => (
                <button
                  key={d.type}
                  type="button"
                  onClick={() => {
                    playPopSound();
                    setActiveTool(d.type);
                  }}
                  title={d.label}
                  className={`min-h-[44px] px-2 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition ${
                    activeTool === d.type
                      ? 'bg-rose-50 border-rose-500 text-rose-950 ring-2 ring-rose-300/60'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50'
                  }`}
                >
                  {renderDecorationVisual(d.type, 'palette')}
                  <span className="truncate text-[11px]">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Public Profile Decor Opt-In */}
          <label className="flex items-start gap-2.5 rounded-2xl bg-amber-50/80 border border-amber-200 p-3 text-xs text-amber-950 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublicProfileDecor}
              onChange={(e) => setIsPublicProfileDecor(e.target.checked)}
              className="mt-0.5 rounded border-amber-400 text-rose-600"
            />
            <span>
              <strong>Show on my festive profile card</strong> (optional profile decoration inside Santa&apos;s Workshop)
            </span>
          </label>

          {/* Bake & Save Button */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSaveBake()}
              className={`flex-1 min-h-[46px] px-5 py-2.5 rounded-full font-display font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 ${cfg.primaryBtnClass}`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Baking Cookie...' : 'Bake & Save Cookie 🔔'}
            </button>

            <button
              type="button"
              onClick={() => {
                playPopSound();
                setShape('person');
                setIcingColor('white');
                setSelectedId(null);
                commitDecorations([
                  { id: 'r1', type: 'svg-hat-fedora', x: 50, y: 12, scale: 1.2, rotation: -6 },
                  { id: 'r2', type: 'svg-eye-brown', x: 44, y: 24, scale: 0.72, rotation: 0 },
                  { id: 'r3', type: 'svg-eye-brown', x: 56, y: 24, scale: 0.72, rotation: 0 },
                  { id: 'r4', type: 'svg-scarf-long', x: 50, y: 44, scale: 1.15, rotation: 0 },
                  { id: 'r5', type: 'svg-candy-cane', x: 75, y: 54, scale: 0.95, rotation: 14 },
                  { id: 'r6', type: 'svg-bauble-gold-red', x: 50, y: 63, scale: 0.85, rotation: 0 },
                ]);
              }}
              className={`min-h-[46px] px-4 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${cfg.secondaryBtnClass}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Starter Preset
            </button>
          </div>

          {savedNotice && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Ding! Freshly baked &amp; saved to your Secret Santa Workshop! ✨</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        Saved as lightweight vector coordinates so your cookie loads crisply on every device!
      </p>
    </div>
  );
};
