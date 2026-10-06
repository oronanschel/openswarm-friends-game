const KEY = 'friends-game-save';
// Bump when the saved shape changes, or when world/item generation changes
// enough that old positions or collected keys no longer mean the same thing.
const VERSION = 1;

// state is { world, player, inventory, items, npcs }.
export function serialize({ world, player, inventory, items, npcs }) {
  return {
    version: VERSION,
    seed: world.seed,
    player: { x: player.x, y: player.y },
    inventory: [...inventory.counts],
    collected: [...items.collected],
    gifted: [...(npcs.gifted || [])],
    tiles: world.changedTiles(),
  };
}

// Copies a saved object into the live state. Returns false, changing nothing,
// if the save is from another version or another world.
export function apply(data, { world, player, inventory, items, npcs }) {
  if (!data || data.version !== VERSION || data.seed !== world.seed) return false;

  // Changed tiles first: the saved position may stand where a tree used to be.
  // Saves from before tiles could change have no list.
  world.restoreTiles(Array.isArray(data.tiles) ? data.tiles : []);
  const { x, y } = data.player || {};
  // Keep the fresh spawn if the saved spot is unusable.
  if (Number.isFinite(x) && Number.isFinite(y) && !player.collides(x, y, world)) {
    player.x = x;
    player.y = y;
  }
  inventory.counts = new Map(data.inventory || []);
  items.collected = new Set(data.collected || []);
  // Loaded regions were spawned without the collected set; respawn them.
  items.regions.clear();
  if (npcs.gifted) npcs.gifted = new Set(data.gifted || []);
  return true;
}

// Storage can be missing or throw (private browsing, quota), so every access is
// guarded; the game just runs without saving.
export function save(storage, state) {
  try {
    storage.setItem(KEY, JSON.stringify(serialize(state)));
    return true;
  } catch {
    return false;
  }
}

export function load(storage, state) {
  try {
    return apply(JSON.parse(storage.getItem(KEY)), state);
  } catch {
    return false;
  }
}

export function clear(storage) {
  try {
    storage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
