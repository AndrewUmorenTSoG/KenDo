const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'INPUT', 'SPAN', 'H1', 'H2', 'H3'])

// Keeps only basic formatting tags from the note editor, and checkboxes for checklists.
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild!

  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (!ALLOWED.has(child.tagName)) {
        child.replaceWith(...child.childNodes)
        continue
      }
      for (const attr of [...child.attributes]) {
        const keep = child.tagName === 'INPUT' && (attr.name === 'type' || attr.name === 'checked')
        if (!keep) child.removeAttribute(attr.name)
      }
      if (child.tagName === 'INPUT') child.setAttribute('type', 'checkbox')
      walk(child)
    }
  }
  walk(root)
  return root.innerHTML
}
