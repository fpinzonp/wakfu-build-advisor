import type { Lang } from '../i18n';
import type { Cell } from '../sim/formulas';

export type L10n = Record<Lang, string>;
export type PieceKind = 'boss' | 'mob' | 'special' | 'char';
export type TileColor = 'red' | 'blue' | 'white' | 'dark';
export type ZoneKind = 'explosion' | 'glyph' | 'collision' | 'path' | 'hit';

export interface Piece { id: string; kind: PieceKind; name: L10n; role?: L10n; cell: Cell; invulnerable?: boolean; label?: string }
export interface Zone { kind: ZoneKind; cells?: Cell[]; center?: Cell; radius?: number }

export type Change =
  | { type: 'move'; piece: string; to: Cell; path?: Cell[] } // path: casillas intermedias, se pintan como zona 'path' en ese paso
  | { type: 'aura'; piece: string; on: boolean }
  | { type: 'label'; piece: string; label: string | null }
  | { type: 'remove'; piece: string }
  | { type: 'add'; piece: Piece }
  | { type: 'zone'; zone: Zone } // solo dura ese paso
  | { type: 'tiles'; cells: Cell[]; color: TileColor | null } // persiste; null las limpia
  | { type: 'counter'; id: string; name: L10n; value: string | null }; // persiste; null lo quita

export interface Step { text: L10n; actor?: string; changes: Change[] }
export interface Room { id: string; name: L10n; size: { w: number; h: number }; pieces: Piece[]; tiles?: { cells: Cell[]; color: TileColor }[]; condition: L10n; duration: L10n; steps: Step[] }
export interface Dungeon { id: string; tier: [number, number]; name: L10n; guide: string; rooms: Room[] }
export interface Excluded { id: string; name: string; reason: string }
