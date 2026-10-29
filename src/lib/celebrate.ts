export type Celebration = { kind: 'recap'; percent: number } | { kind: 'hundred' } | { kind: 'thousand' }

export const CELEBRATE = 'kendo-celebrate'

// Shown by the Celebrations component in the layout.
export function celebrate(detail: Celebration) {
  window.dispatchEvent(new CustomEvent(CELEBRATE, { detail }))
}
