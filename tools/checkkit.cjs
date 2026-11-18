// Shared step for the scripted checks (coordinator Nov 17): from the title to the base on a cleared save.
// A first-time player's "Enter the base" now plays the opening, and day 1 shows the one-time "Your job" card.
// toBase(p): clicks Enter the base, skips the opening if it started (a key), then closes the card with its own button. Returns the game state ('base').
// Checks that should not see either can instead open the page with ?film=0 (no opening on a first Enter, no card).
async function toBase(p, wait = 3000) {
  await p.evaluate(() => document.getElementById('enter').click());
  await p.waitForTimeout(wait);
  if (await p.evaluate(() => window.__game.state === 'intro')) { await p.waitForTimeout(800); await p.keyboard.press('KeyX'); await p.waitForTimeout(wait); }
  await p.waitForTimeout(600);
  await p.evaluate(() => { const c = document.getElementById('jobCard'); if (c) c.querySelector('button').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await p.waitForTimeout(300);
  return p.evaluate(() => window.__game.state);
}
module.exports = { toBase };
