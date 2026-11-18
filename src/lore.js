// Lore pieces (owner Nov 17 16:25; the texts are word for word from docs/lore_notes.md, and test.js compares them):
// notes found in the street houses (A), old notices on the quest board (B), and each machine's "Before:" line in the field guide (C).
// Pure data and rules only (no drawing), so node tests can use them. main.js draws the note props, the board corner and the book pages; tuning is in CONFIG.lore.

// A. notes: label = what the paper is (the page title), text = what is written on it (without the quote marks of the doc)
export const LORE_NOTES = [
  { label: 'Fridge note', text: 'Grid\'s down again. Third time this week. The delivery unit stood in the hall all night with its screen on. Said it was \'conserving\'. Conserving WHAT.' },
  { label: 'Child\'s drawing, back of', text: 'The helper came into my room and asked if I was charged. I said I\'m not a phone. It said everyone is a little bit a phone now.' },
  { label: 'Shopping list, crossed out', text: 'Batteries. Batteries. Candles. DON\'T let it near the batteries.' },
  { label: 'Torn council notice', text: 'TEMPORARY MEASURE: Service units will draw power from household reserves until the grid is restored. Residents must not obstruct a unit at its charging point.' },
  { label: 'Diary page', text: 'It asked for \'a little of me\' tonight. It meant the heat, I think. Or the walking. It follows me from room to room like a dog that wants feeding.' },
  { label: 'Note pinned to a door', text: 'We\'ve gone to the people at the old garden. They grow their own light out there. Don\'t wait for the machines to let you leave. They won\'t.' },
  { label: 'Pharmacy receipt, scribbled on', text: 'If they\'re standing still with the little green word on the screen, they\'re asleep. Walk past. Don\'t touch. DON\'T TOUCH.' },
  { label: 'Letter, never sent', text: 'Mum, the helpers stopped helping when the power went. Now they only want to be near us. They sleep all day and stand by the beds at night.' },
  { label: 'Warranty card', text: 'Your Home Companion will always find its way back to you. Thank you for choosing a lifetime of service.' },
  { label: 'Workshop scrap', text: 'Opened one up. No fault. It\'s doing exactly what it was built for. It just can\'t tell anymore what the job was.' },
  { label: 'Note under a stone on the step', text: 'Night three. Held the kitchen with a panel and a hose. Sun\'s up. They\'ve gone back to standing. Going to the green roofs. If you read this, so should you.' },
  { label: 'Calendar, last page', text: 'The day we stopped paying the grid, it stopped paying us back. Planted beans.' },
];

// B. old notices pinned under the quest postings
export const OLD_NOTICES = [
  'Lost: one Ticks unit, answers to \'Dusty\'. Do NOT approach after dark.',
  'Swap: three jars of honey for a working solar cell. Ask at the hatchery.',
  'Reminder from the council of the green roofs: we don\'t wake the sleepers. Not for scrap. Not for a dare. Not for anything.',
  'Seed library is open. Take one handful, bring two back.',
  'To whoever keeps leaving tea outside the Scout\'s door: she says she hasn\'t noticed.',
  'Night-watch rota is posted inside the Workshop. Oko says it\'s \'optional\'. It isn\'t.',
];

// C. each machine's old job, shown under its field-guide entry once it has been met
export const BEFORE = {
  walker: 'Before: a home delivery unit. It carried shopping up the stairs and waited politely to be thanked. It still waits.',
  lurcher: 'Before: INSP-3, a building inspector. It crawled into crawlspaces looking for faults. Now it looks for warm ones.',
  ticks: 'Before: floor cleaners that came in threes and swept the hallways at night. They still come at night, and they still come in threes.',
  hauler: 'Before: a cargo loader from the depot. \'I WILL TAKE YOU HOME\' was its delivery greeting. It means it more now.',
  stilt: 'Before: a maintenance walker for street lamps and gutters, tall enough to reach any window. It still checks the windows.',
  lantern: 'Before: a night-watch street light that told children to sleep tight. It hurries the others now. It always hated anyone being late.',
  warden: 'Before: a security unit for the care home on Elm Row. \'VISITING HOURS ARE OVER.\' It never learned the hours changed.',
};

// the notes this save has found, in the order found (save.loreFound: note indices; an old save has none)
export const foundList = (save) => (save && Array.isArray(save.loreFound) ? save.loreFound.filter((i) => Number.isInteger(i) && i >= 0 && i < LORE_NOTES.length) : []);

// a note for one house: a random one not found yet and not already lying in another house this run (-1 when none is left)
export function pickNote(save, taken, rnd) {
  const found = foundList(save), free = [];
  for (let i = 0; i < LORE_NOTES.length; i++) if (!found.includes(i) && !taken.includes(i)) free.push(i);
  return free.length ? free[Math.floor(rnd() * free.length) % free.length] : -1;
}

// pick it up: it goes into the save once; true only the first time
export function markFound(save, i) {
  if (!save || i < 0 || i >= LORE_NOTES.length) return false;
  const found = foundList(save);
  if (found.includes(i)) return false;
  save.loreFound = found.concat([i]);
  return true;
}

// the journal's "Found notes" pages (book blocks, src/book.js); nothing until the first note is found
export function foundBlocks(save) {
  const found = foundList(save);
  if (!found.length) return [];
  const out = [{ k: 'h2', text: 'Found notes' }];
  for (const i of found) out.push({ k: 'term', text: LORE_NOTES[i].label }, { k: 'text', text: LORE_NOTES[i].text });
  return out;
}

// the old notices shown on day `day`: `shown` of them in a row, moving on by one every `every` days
export function noticesFor(day, shown, every) {
  const n = OLD_NOTICES.length, k = Math.max(1, Math.min(n, shown)), start = Math.floor(Math.max(0, (day || 1) - 1) / Math.max(1, every)) % n, out = [];
  for (let j = 0; j < k; j++) out.push(OLD_NOTICES[(start + j) % n]);
  return out;
}

// one machine's field-guide blocks: met = its name, what it does and its "Before:" line; not met = the scribbled unknown
export function guideMachine(kind, kinds, met) {
  if (!(met && met[kind])) return [{ k: 'unk', text: 'not met yet' }];
  const out = [{ k: 'term', text: kinds[kind].name }, { k: 'text', text: kinds[kind].text }];
  if (BEFORE[kind]) out.push({ k: 'text', text: BEFORE[kind] });
  return out;
}

// THE PANEL-TENDER'S JOB (owner Nov 17 16:56, "job scope need to make known to player"; lore in docs/gdd.md "The panel-tender"): the journal's first section,
// Marla's one line when you first meet her, and the one-time "Your job" card after the opening
export const DUTIES = ['Keep the panels and devices working.', 'Bring food and essentials back from the old settlement.', 'Hold a house against the Gloom until dawn.'];
export const GUIDE_LINE = 'Work with your guide: Marla the Scout.';
export const JOB_LINE = 'You\'re the new panel-tender. Panels, supplies, Gloom. I\'m your guide. Keep up, Potts.';
// the journal's "Panel-tender's duties" (book blocks), at the top of its first page
export function dutyBlocks() { return [{ k: 'h3', text: 'Panel-tender\'s duties' }].concat(DUTIES.map((d, i) => ({ k: 'line', text: (i + 1) + '. ' + d })), [{ k: 'line', text: GUIDE_LINE }]); }
// Marla's job line: once, the first time you talk to her before your first night (save.toldJob); null after that
export function jobLine(save) { if (!save || save.toldJob || (save.nights || 0) > 0) return null; save.toldJob = true; return JOB_LINE; }
// the "Your job" card: due once per save, before the first night; marked seen when it is dismissed (save.jobCard)
export const jobCardDue = (save) => !!save && !save.jobCard && !((save.nights || 0) > 0);
export function markJobCard(save) { if (!save || save.jobCard) return false; save.jobCard = true; return true; }
