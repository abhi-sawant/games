// What the how-to page shows for each game. A guide is plain text (steps may use <b>) and one small example
// drawn from the shared pieces in art.ts, so a player can see the rule before trying it.

export type Ink = 'blue' | 'orange' | 'lilac' | 'sky' | 'olive' | 'berry' | 'plum' | 'cocoa';

export interface Guide {
  name: string;
  /** The game's category ink, from DESIGN.md. */
  ink: Ink;
  /** One or two sentences: what winning looks like. */
  goal: string;
  steps: string[];
  controls: string[];
  tips: string[];
  example?: { html: string; caption: string };
}

import { arcade } from './guides/arcade';
import { cards } from './guides/cards';
import { dice } from './guides/dice';
import { logic } from './guides/logic';
import { tiles } from './guides/tiles';
import { number } from './guides/number';
import { versus } from './guides/versus';
import { words } from './guides/words';

export const GUIDES: Record<string, Guide> = { ...number, ...logic, ...tiles, ...versus, ...cards, ...words, ...dice, ...arcade };
