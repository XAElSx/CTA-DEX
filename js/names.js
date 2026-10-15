// Display names for PokéAPI species names ("mr-mime" -> "Mr. Mime").
// Most names only need title case with spaces ("great-tusk" -> "Great Tusk", "tapu-koko" -> "Tapu Koko").
// The ones below keep a hyphen or have punctuation/symbols the API name can't hold.
const SPECIAL = {
  'nidoran-f': 'Nidoran♀',
  'nidoran-m': 'Nidoran♂',
  'farfetchd': "Farfetch'd",
  'sirfetchd': "Sirfetch'd",
  'mr-mime': 'Mr. Mime',
  'mime-jr': 'Mime Jr.',
  'mr-rime': 'Mr. Rime',
  'ho-oh': 'Ho-Oh',
  'porygon-z': 'Porygon-Z',
  'type-null': 'Type: Null',
  'jangmo-o': 'Jangmo-o',
  'hakamo-o': 'Hakamo-o',
  'kommo-o': 'Kommo-o',
  'flabebe': 'Flabébé',
  'chien-pao': 'Chien-Pao',
  'chi-yu': 'Chi-Yu',
  'ting-lu': 'Ting-Lu',
  'wo-chien': 'Wo-Chien'
};

const titleCase = name =>
  name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export const displayName = name => SPECIAL[name] || titleCase(name);

// Lowercase, no accents or punctuation, single spaces: "Flabébé" -> "flabebe", "Mr. Mime" -> "mr mime".
export const searchKey = text =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/['’.:]/g, '').replace(/[-_\s]+/g, ' ').trim();
