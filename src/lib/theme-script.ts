/** Compartilhado entre o layout (servidor) e o provider (cliente).
 *  Fica fora de theme.tsx porque um Server Component nao pode importar
 *  valores de um modulo marcado com "use client". */

export const THEME_STORAGE_KEY = "financas:tema";

/** Carimba data-theme no <html> antes da primeira pintura (sem flash). */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var dark = stored ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;
