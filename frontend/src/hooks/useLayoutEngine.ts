import { useElementSize } from "./useElementSize";

export interface GridConfig {
  columns: number;
  rows: number;
  visibleCount: number;
  overflowCount: number;
}

const TILE_ASPECT = 16 / 9;

// Finds the column count that lets `tileCount` tiles fill the container as
// large as possible without exceeding either dimension. For each candidate
// column count we know the row count follows (ceil(tileCount / columns)),
// which pins down a tile's max width (container width / columns) and max
// height (container height / rows); the tighter of the two — converted to a
// common "effective width" via the fixed 16:9 aspect ratio — is what that
// column count can actually offer. We just take whichever candidate offers
// the largest effective width.
function computeGrid(containerWidth: number, containerHeight: number, tileCount: number): { columns: number; rows: number } {
  if (tileCount <= 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { columns: 1, rows: 1 };
  }
  let bestColumns = 1;
  let bestEffectiveWidth = 0;
  for (let columns = 1; columns <= tileCount; columns++) {
    const rows = Math.ceil(tileCount / columns);
    const widthPerTile = containerWidth / columns;
    const heightPerTile = containerHeight / rows;
    const effectiveWidth = Math.min(widthPerTile, heightPerTile * TILE_ASPECT);
    if (effectiveWidth > bestEffectiveWidth) {
      bestEffectiveWidth = effectiveWidth;
      bestColumns = columns;
    }
  }
  return { columns: bestColumns, rows: Math.ceil(tileCount / bestColumns) };
}

// Drives Tiled mode: how many participant tiles are visible (vs collapsed
// into a single overflow tile) and the rows/columns that best fill the
// measured container for that count.
export function useLayoutEngine(participantCount: number, maxTiles: number) {
  const { ref: containerRef, width, height } = useElementSize<HTMLDivElement>();

  const hasOverflow = participantCount > maxTiles;
  // One slot in the grid is spent on the overflow "+N" tile itself, so only
  // maxTiles - 1 real participants get a slot when there's overflow.
  const visibleCount = hasOverflow ? Math.max(0, maxTiles - 1) : participantCount;
  const overflowCount = hasOverflow ? participantCount - visibleCount : 0;
  const totalTiles = visibleCount + (hasOverflow ? 1 : 0);

  const { columns, rows } = computeGrid(width, height, totalTiles);

  const config: GridConfig = { columns, rows, visibleCount, overflowCount };
  return { containerRef, ...config };
}
