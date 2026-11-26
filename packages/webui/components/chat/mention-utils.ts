export const MENTION_CHIP_CLASS =
  'inline-block bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded-md text-sm font-medium align-middle select-none mx-0.5'

export function createMentionNode(user: { id: string; name: string }): HTMLSpanElement {
  const mentionNode = document.createElement('span')
  mentionNode.contentEditable = 'false'
  mentionNode.dataset.type = 'mention'
  mentionNode.dataset.id = user.id
  mentionNode.className = MENTION_CHIP_CLASS
  mentionNode.innerText = `@${user.name}`
  return mentionNode
}

function serializeChildNodes(parent: Node): string {
  let result = ''
  parent.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      if (el.dataset.type === 'mention') {
        result += `<@${el.dataset.id}>`
      } else if (el.tagName === 'BR') {
        result += '\n'
      } else if (el.tagName === 'DIV' || el.tagName === 'P') {
        result += '\n' + serializeChildNodes(el)
      } else {
        result += serializeChildNodes(el)
      }
    }
  })
  return result
}

export function serializeEditableContent(editor: HTMLElement): string {
  return serializeChildNodes(editor)
    .replace(/\u00A0/g, ' ')
    .trim()
}

export function hydrateEditableWithMentions(
  editor: HTMLElement,
  text: string,
  resolveUserName: (userId: string) => string,
): void {
  editor.innerHTML = ''
  if (!text) return

  const parts = text.split(/(<@[a-zA-Z0-9_-]+>)/g)
  for (const part of parts) {
    if (!part) continue
    if (/^<@[a-zA-Z0-9_-]+>$/.test(part)) {
      const userId = part.slice(2, -1)
      editor.appendChild(createMentionNode({ id: userId, name: resolveUserName(userId) }))
    } else {
      editor.appendChild(document.createTextNode(part))
    }
  }
}
