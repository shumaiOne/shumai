import React, { useEffect, useRef } from 'react'
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

import { $convertFromMarkdownString, $convertToMarkdownString } from '@lexical/markdown'

import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { CodeNode } from '@lexical/code'
import { TableNode, TableCellNode, TableRowNode } from '@lexical/table'
import { AutoLinkNode, LinkNode } from '@lexical/link'

import { ToolbarPlugin } from './toolbar'
import { editorTheme } from './theme'
import { EDITOR_TRANSFORMERS } from './transformers'
import { ScrollArea } from '@/ui/components/ui/scroll-area'
import './markdown-editor.css'

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
  rightToolbarContent?: React.ReactNode
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
  rightToolbarContent,
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
        {!readOnly && !hideToolbar ? (
          <ToolbarPlugin rightContent={rightToolbarContent} />
        ) : rightToolbarContent ? (
          <div className="shumai-editor-toolbar flex items-center justify-end px-3 py-1.5 border-b">
            {rightToolbarContent}
          </div>
        ) : null}
        <ScrollArea className="shumai-editor-content-area flex-1 min-h-0 w-full">
          <div className="relative min-h-full">
            <RichTextPlugin
              contentEditable={<ContentEditable className="editor-input" />}
              placeholder={<div className="editor-placeholder">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <TabIndentationPlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
          <MarkdownSyncPlugin value={value} initialContent={initialContent} onChange={onChange} />
          {autoFocus && <AutoFocusPlugin />}
        </ScrollArea>
      </LexicalComposer>
    </div>
  )
}

export default MarkdownEditor
