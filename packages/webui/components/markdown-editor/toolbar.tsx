import React, { useCallback, useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  type RangeSelection,
  type TextNode,
  type ElementNode,
} from 'lexical'
import {
  $isListNode,
  ListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@lexical/rich-text'
import { $createCodeNode } from '@lexical/code'
import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $isAtNodeEnd, $setBlocksType } from '@lexical/selection'
import { $getNearestNodeOfType } from '@lexical/utils'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
  ListTodo,
  Heading1,
  Heading2,
  Heading3,
  Link as LinkIcon,
  RemoveFormatting,
  Undo2,
  Redo2,
} from 'lucide-react'

const blockTypes = {
  paragraph: 'Normal',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'Bullet List',
  number: 'Numbered List',
  check: 'Check List',
  quote: 'Quote',
  code: 'Code Block',
} as const

type BlockType = keyof typeof blockTypes

function getSelectedNode(selection: RangeSelection): TextNode | ElementNode {
  const anchor = selection.anchor
  const focus = selection.focus
  const anchorNode = selection.anchor.getNode()
  const focusNode = selection.focus.getNode()
  if (anchorNode === focusNode) {
    return anchorNode
  }
  const isBackward = selection.isBackward()
  if (isBackward) {
    return $isAtNodeEnd(focus) ? anchorNode : focusNode
  } else {
    return $isAtNodeEnd(anchor) ? focusNode : anchorNode
  }
}

export function ToolbarPlugin({ rightContent }: { rightContent?: React.ReactNode } = {}) {
  const [editor] = useLexicalComposerContext()
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [blockType, setBlockType] = useState<BlockType>('paragraph')
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [isLink, setIsLink] = useState(false)

  const updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
      setIsCode(selection.hasFormat('code'))

      // Update link state
      const node = getSelectedNode(selection)
      const parent = node.getParent()
      setIsLink($isLinkNode(parent) || $isLinkNode(node))

      // Update block type
      const anchorNode = selection.anchor.getNode()
      const element =
        anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()
      const elementKey = element.getKey()
      const elementDom = editor.getElementByKey(elementKey)

      if (elementDom !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getListType() : element.getListType()
          setBlockType(type as BlockType)
        } else if ($isHeadingNode(element)) {
          setBlockType(element.getTag() as BlockType)
        } else {
          const type = element.getType()
          if (type in blockTypes) {
            setBlockType(type as BlockType)
          } else {
            setBlockType('paragraph')
          }
        }
      }
    }
  }, [editor])

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbar()
        return false
      },
      COMMAND_PRIORITY_CRITICAL,
    )
  }, [editor, updateToolbar])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        updateToolbar()
      })
    })
  }, [editor, updateToolbar])

  useEffect(() => {
    const unregisterUndo = editor.registerCommand(
      CAN_UNDO_COMMAND,
      (payload: boolean) => {
        setCanUndo(payload)
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    const unregisterRedo = editor.registerCommand(
      CAN_REDO_COMMAND,
      (payload: boolean) => {
        setCanRedo(payload)
        return false
      },
      COMMAND_PRIORITY_LOW,
    )
    return () => {
      unregisterUndo()
      unregisterRedo()
    }
  }, [editor])

  const formatParagraph = () => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }

  const formatHeading = (headingSize: HeadingTagType) => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        $setBlocksType(selection, () => $createHeadingNode(headingSize))
      }
    })
  }

  const formatBulletList = () => {
    if (blockType !== 'bullet') {
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatNumberedList = () => {
    if (blockType !== 'number') {
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatCheckList = () => {
    if (blockType !== 'check') {
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)
    } else {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatQuote = () => {
    if (blockType !== 'quote') {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      })
    } else {
      formatParagraph()
    }
  }

  const formatCodeBlock = () => {
    if (blockType !== 'code') {
      editor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode())
        }
      })
    } else {
      formatParagraph()
    }
  }

  const insertLink = useCallback(() => {
    if (!isLink) {
      const url = prompt('Enter link URL (e.g., https://example.com):')
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    }
  }, [editor, isLink])

  const clearFormatting = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) {
        selection.setFormat(0)
        $setBlocksType(selection, () => $createParagraphNode())
      }
    })
  }, [editor])

  const handleBlockTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as BlockType
    switch (value) {
      case 'paragraph':
        formatParagraph()
        break
      case 'h1':
      case 'h2':
      case 'h3':
        formatHeading(value)
        break
      case 'bullet':
        formatBulletList()
        break
      case 'number':
        formatNumberedList()
        break
      case 'check':
        formatCheckList()
        break
      case 'quote':
        formatQuote()
        break
      case 'code':
        formatCodeBlock()
        break
    }
  }

  return (
    <div className="shumai-editor-toolbar flex items-center justify-between">
      <div className="flex items-center flex-wrap gap-1">
        {/* Undo / Redo */}
        <button
          type="button"
          disabled={!canUndo}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
          title="Undo"
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canRedo}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
          title="Redo"
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="toolbar-divider" />

        {/* Block Type Dropdown */}
        <select value={blockType} onChange={handleBlockTypeChange} aria-label="Block formatting">
          <option value="paragraph">Normal</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="bullet">Bullet List</option>
          <option value="number">Numbered List</option>
          <option value="check">Check List</option>
          <option value="quote">Quote</option>
          <option value="code">Code Block</option>
        </select>

        <div className="toolbar-divider" />

        {/* Inline Styles */}
        <button
          type="button"
          className={isBold ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={isItalic ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={isUnderline ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
        >
          <Underline className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={isStrikethrough ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
          title="Strikethrough"
          aria-label="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={isCode ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
          title="Inline Code"
          aria-label="Inline Code"
        >
          <Code className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={isLink ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertLink}
          title="Insert Link"
          aria-label="Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>

        <div className="toolbar-divider" />

        {/* Quick Insert / Block shortcuts */}
        <button
          type="button"
          className={blockType === 'h1' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatHeading('h1')}
          title="H1"
          aria-label="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={blockType === 'h2' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatHeading('h2')}
          title="H2"
          aria-label="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={blockType === 'h3' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => formatHeading('h3')}
          title="H3"
          aria-label="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={blockType === 'bullet' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={formatBulletList}
          title="Bullet List"
          aria-label="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={blockType === 'number' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={formatNumberedList}
          title="Numbered List"
          aria-label="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={blockType === 'check' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={formatCheckList}
          title="Check List"
          aria-label="Check List"
        >
          <ListTodo className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={blockType === 'quote' ? 'active' : ''}
          onMouseDown={(e) => e.preventDefault()}
          onClick={formatQuote}
          title="Quote"
          aria-label="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className="toolbar-divider" />

        {/* Clear formatting */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={clearFormatting}
          title="Clear Formatting"
          aria-label="Clear Formatting"
        >
          <RemoveFormatting className="h-4 w-4" />
        </button>
      </div>

      {rightContent && (
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">{rightContent}</div>
      )}
    </div>
  )
}
