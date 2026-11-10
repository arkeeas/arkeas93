/* ral.js – sdílený výběr odstínu RAL (zábradlí, podnože, stolečky). Běží v prohlížeči i v Node.
   Seznam běžných odstínů + „jiný RAL“ s ověřením (4 číslice, první 1–9). Hex je jen orientační barva náhledu. */
(function (root) {
  'use strict';
  const LIST = [
    { id: '7016', lab: 'RAL 7016', sub: 'antracit', hex: '#383E42' },
    { id: '9005', lab: 'RAL 9005', sub: 'černá', hex: '#0E0E10' },
    { id: '9016', lab: 'RAL 9016', sub: 'bílá', hex: '#F1F0EA' },
    { id: '9006', lab: 'RAL 9006', sub: 'bílý hliník', hex: '#A1A1A0' },
    { id: '7035', lab: 'RAL 7035', sub: 'světle šedá', hex: '#CBD0CC' },
    { id: '8017', lab: 'RAL 8017', sub: 'čokoládově hnědá', hex: '#45322E' },
    { id: '6005', lab: 'RAL 6005', sub: 'mechově zelená', hex: '#2F4538' },
    { id: '3000', lab: 'RAL 3000', sub: 'ohnivě červená', hex: '#AF2B1E' }
  ];
  const OTHER = { id: 'jiny', lab: 'Jiný RAL', sub: 'zadáte číslo', hex: '#808080' };
  const valid = (s) => /^[1-9]\d{3}$/.test(String(s == null ? '' : s).trim());
  const clean = (s) => String(s == null ? '' : s).replace(/^\s*ral\s*/i, '').replace(/\s+/g, '');
  /* vstup (id volby + text pro „jiný“) -> normalizovaná dvojice. U „jiný RAL“ zůstane rozepsané číslo (jen číslice, max 4),
     ať jde psát; jestli je platné, říká valid() – nehotový odstín pak jádro označí jako chybu. Neznámý odstín spadne na výchozí 7016. */
  function norm(id, jiny, def) {
    def = def || '7016';
    const j = clean(jiny).replace(/\D/g, '').slice(0, 4);
    if (id === 'jiny') return { id: 'jiny', jiny: j };
    return { id: LIST.some((x) => x.id === id) ? id : def, jiny: valid(j) ? j : '' };
  }
  /* kód RAL vybraného odstínu (4 číslice) a orientační barva */
  const code = (id, jiny) => (id === 'jiny' ? clean(jiny) : id);
  const label = (id, jiny) => 'RAL ' + code(id, jiny);
  const hex = (id, jiny) => { const x = LIST.find((y) => y.id === code(id, jiny)); return x ? x.hex : OTHER.hex; };
  root.Ral = { LIST, OTHER, valid, clean, norm, code, label, hex };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Ral;
})(typeof window !== 'undefined' ? window : globalThis);
