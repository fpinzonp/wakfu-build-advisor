// Parser mínimo de literales de tabla Lua (`return { ... }`), suficiente para los módulos de datos
// de wakfu.wiki.gg: tablas, claves [n] / ['x'] / x, cadenas '...' "..." [[...]], números, true/false/nil.
export function parseLuaTable(src) {
  let i = src.indexOf('{');
  if (i < 0) throw new Error('No hay tabla Lua');

  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('--[[', i)) { i = src.indexOf(']]', i) + 2; continue; }
      if (src.startsWith('--', i)) { while (i < src.length && src[i] !== '\n') i++; continue; }
      return;
    }
  };

  const str = () => {
    if (src.startsWith('[[', i)) {
      const end = src.indexOf(']]', i);
      const s = src.slice(i + 2, end);
      i = end + 2;
      return s;
    }
    const q = src[i++];
    let out = '';
    while (src[i] !== q) {
      if (src[i] === '\\') {
        const c = src[i + 1];
        out += c === 'n' ? '\n' : c === 't' ? '\t' : c;
        i += 2;
      } else out += src[i++];
    }
    i++;
    return out;
  };

  const value = () => {
    skip();
    const c = src[i];
    if (c === '{') return table();
    if (c === '"' || c === "'" || src.startsWith('[[', i)) return str();
    const m = /^(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?|[A-Za-z_]\w*)/.exec(src.slice(i, i + 40));
    if (!m) throw new Error(`Valor Lua no reconocido en ${i}: ${src.slice(i, i + 30)}`);
    i += m[0].length;
    if (m[0] === 'true') return true;
    if (m[0] === 'false') return false;
    // nil, o una variable suelta (errores de edición de la wiki): sin valor.
    return /^-?\d/.test(m[0]) ? Number(m[0]) : null;
  };

  const table = () => {
    i++; // {
    const obj = {};
    let n = 1;
    for (;;) {
      skip();
      if (src[i] === '}') { i++; return obj; }
      let key;
      if (src[i] === '[' && !src.startsWith('[[', i)) {
        i++;
        key = value();
        skip();
        i++; // ]
        skip();
        i++; // =
      } else {
        const m = /^([A-Za-z_]\w*)\s*=(?!=)/.exec(src.slice(i, i + 80));
        if (m) { key = m[1]; i += m[0].length; } else key = n++;
      }
      obj[key] = value();
      skip();
      if (src[i] === ',' || src[i] === ';') i++;
    }
  };

  return table();
}
