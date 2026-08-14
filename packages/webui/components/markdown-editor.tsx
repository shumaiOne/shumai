import React, { useEffect, useRef, useCallback, useState } from 'react'
import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin'
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin'
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type Transformer,
} from '@lexical/markdown'

import {
  HeadingNode,
  QuoteNode,
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@lexical/rich-text'
import {
  ListNode,
  ListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { CodeNode, $createCodeNode } from '@lexical/code'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'
import { AutoLinkNode, LinkNode, $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import { $isAtNodeEnd, $setBlocksType } from '@lexical/selection'
import { $getNearestNodeOfType } from '@lexical/utils'
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
  type EditorThemeClasses,
} from 'lexical'

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

import './markdown-editor.css'

export const EDITOR_TRANSFORMERS: Transformer[] = [
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
]

export const editorTheme: EditorThemeClasses = {
  paragraph: 'editor-paragraph',
  quote: 'editor-quote',
  heading: {
    h1: 'editor-heading-h1',
    h2: 'editor-heading-h2',
    h3: 'editor-heading-h3',
  },
  list: {
    checklist: 'editor-checklist',
    listitem: 'editor-listitem',
    listitemChecked: 'editor-listitem-checked',
    listitemUnchecked: 'editor-listitem-unchecked',
    nested: {
      listitem: 'editor-nested-listitem',
    },
    ol: 'editor-list-ol',
    ul: 'editor-list-ul',
  },
  link: 'editor-link',
  text: {
    bold: 'editor-text-bold',
    italic: 'editor-text-italic',
    underline: 'editor-text-underline',
    strikethrough: 'editor-text-strikethrough',
    underlineStrikethrough: 'editor-text-underlineStrikethrough',
    code: 'editor-text-code',
  },
  code: 'editor-code-block',
}

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

function ToolbarPlugin() {
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
    <div className="shumai-editor-toolbar">
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
  )
}

function MarkdownSyncPlugin({
  value,
  initialContent = '',
  onChange,
}: {
  value?: string
  initialContent?: string
  onChange?: (markdown: string) => void
}) {
  const [editor] = useLexicalComposerContext()
  const isInitializedRef = useRef(false)
  const lastEmittedMarkdownRef = useRef<string>('')

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      const startingContent = value !== undefined ? value : initialContent
      if (startingContent) {
        editor.update(() => {
          $convertFromMarkdownString(startingContent, EDITOR_TRANSFORMERS)
        })
        lastEmittedMarkdownRef.current = startingContent
      }
    }
  }, [editor, initialContent, value])

  useEffect(() => {
    if (
      isInitializedRef.current &&
      value !== undefined &&
      value !== lastEmittedMarkdownRef.current
    ) {
      editor.update(() => {
        $convertFromMarkdownString(value, EDITOR_TRANSFORMERS)
      })
      lastEmittedMarkdownRef.current = value
    }
  }, [editor, value])

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState) => {
        editorState.read(() => {
          const markdown = $convertToMarkdownString(EDITOR_TRANSFORMERS)
          if (markdown !== lastEmittedMarkdownRef.current) {
            lastEmittedMarkdownRef.current = markdown
            onChange?.(markdown)
          }
        })
      }}
    />
  )
}

export interface MarkdownEditorProps {
  initialContent?: string
  value?: string
  onChange?: (markdown: string) => void
  placeholder?: string
  readOnly?: boolean
  autoFocus?: boolean
  className?: string
  hideToolbar?: boolean
}

export function MarkdownEditor({
  initialContent = '',
  value,
  onChange,
  placeholder = 'Write your markdown content here...',
  readOnly = false,
  autoFocus = false,
  className = '',
  hideToolbar = false,
}: MarkdownEditorProps) {
  const initialConfig: InitialConfigType = {
    namespace: 'ShumaiWysiwygMarkdownEditor',
    theme: editorTheme,
    editable: !readOnly,
    onError: (error: Error) => {
      console.error('[MarkdownEditor] Error:', error)
    },
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      TableNode,
      TableCellNode,
      TableRowNode,
      AutoLinkNode,
      LinkNode,
    ],
  }

  return (
    <div className={`shumai-editor-wrapper ${readOnly ? 'read-only' : ''} ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        {!readOnly && !hideToolbar && <ToolbarPlugin />}
        <div className="shumai-editor-content-area">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input" />}
            placeholder={<div className="editor-placeholder">{placeholder}</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <TabIndentationPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
          <MarkdownSyncPlugin value={value} initialContent={initialContent} onChange={onChange} />
          {autoFocus && <AutoFocusPlugin />}
        </div>
      </LexicalComposer>
    </div>
  )
}

export default MarkdownEditor
