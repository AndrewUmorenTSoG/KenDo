const SAFE = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'P', 'BR', 'DIV', 'UL', 'OL', 'LI'])
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH'])

const escapeText = (v: string) =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// Rebuilds note HTML from scratch, keeping only basic formatting tags and no attributes.
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as Element
    if (DROP.has(el.tagName)) return ''
    const children = [...el.childNodes].map(walk).join('')
    if (!SAFE.has(el.tagName)) return children
    const tag = el.tagName.toLowerCase()
    return tag === 'br' ? '<br>' : `<${tag}>${children}</${tag}>`
  }
  return [...doc.body.childNodes].map(walk).join('')
}

export function htmlToText(html: string) {
  const el = document.createElement('div')
  el.innerHTML = sanitizeHtml(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '</p>\n'))
  return (el.textContent ?? '').trim()
}
