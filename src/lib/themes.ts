// Colour themes. Each has light and dark versions in themes.css; the swatch is for the picker.
export const themes = [
  { id: 'pink', name: 'Pink', swatch: ['#efb7cd', '#482b42'] },
  { id: 'hotpink', name: 'Hot pink', swatch: ['#ff5fa8', '#8a1550'] },
  { id: 'coralblue', name: 'Coral blue', swatch: ['#5cc8d8', '#0e5a6b'] },
  { id: 'productiveblue', name: 'Productive blue', swatch: ['#6f9cff', '#1d3f8f'] },
  { id: 'green', name: 'Green', swatch: ['#6fd39a', '#1f6b45'] },
  { id: 'forest', name: 'Forest', swatch: ['#8fb38f', '#22402c'] },
  { id: 'lavender', name: 'Lavender', swatch: ['#b9a3f0', '#4b3a7a'] },
  { id: 'sunset', name: 'Sunset', swatch: ['#ffa877', '#7a3214'] },
  { id: 'golden', name: 'Golden', swatch: ['#f2c94c', '#6b4e0a'] },
  { id: 'midnight', name: 'Midnight', swatch: ['#8c94d9', '#1e2244'] },
  { id: 'mocha', name: 'Mocha', swatch: ['#c9a48a', '#4a3428'] },
] as const

export type ThemeId = (typeof themes)[number]['id']

export const applyTheme = (theme: string, dark: boolean) => {
  document.body.dataset.theme = theme
  document.body.classList.toggle('dark', dark)
}
