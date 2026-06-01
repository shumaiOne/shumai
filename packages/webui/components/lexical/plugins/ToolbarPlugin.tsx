import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useCallback, useEffect, useState } from 'react'
import {
  SELECTION_CHANGE_COMMAND,
  FORMAT_TEXT_COMMAND,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  $createParagraphNode,
} from 'lexical'
import {
  $isListNode,
  ListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  type HeadingTagType,
} from '@lexical/rich-text'
import { $createCodeNode } from '@lexical/code'
import { $setBlocksType } from '@lexical/selection'
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
  Type,
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react'
import { Toggle } from '@/ui/components/ui/toggle'
import { Separator } from '@/ui/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/components/ui/select'

const blockTypeToBlockName = {
  paragraph: 'Normal',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'Bullet List',
  number: 'Numbered List',
  quote: 'Quote',
  code: 'Code Block',
}

export function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext()
  const [activeEditor, setActiveEditor] = useState(editor)
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [isUnderline, setIsUnderline] = useState(false)
  const [isStrikethrough, setIsStrikethrough] = useState(false)
  const [isCode, setIsCode] = useState(false)
  const [blockType, setBlockType] = useState<keyof typeof blockTypeToBlockName>('paragraph')

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection()
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setIsUnderline(selection.hasFormat('underline'))
      setIsStrikethrough(selection.hasFormat('strikethrough'))
      setIsCode(selection.hasFormat('code'))

      const anchorNode = selection.anchor.getNode()
      const element =
        anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow()
      const elementKey = element.getKey()
      const elementDom = activeEditor.getElementByKey(elementKey)

      if (elementDom !== null) {
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType(anchorNode, ListNode)
          const type = parentList ? parentList.getListType() : element.getListType()
          setBlockType(type as keyof typeof blockTypeToBlockName)
        } else {
          const type = $isHeadingNode(element) ? element.getTag() : element.getType()
          if (type in blockTypeToBlockName) {
            setBlockType(type as keyof typeof blockTypeToBlockName)
          }
        }
      }
    }
  }, [activeEditor])

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      (_payload, newEditor) => {
        $updateToolbar()
        setActiveEditor(newEditor)
        return false
      },
      COMMAND_PRIORITY_CRITICAL,
    )
  }, [editor, $updateToolbar])

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        $updateToolbar()
      })
    })
  }, [editor, $updateToolbar])

  const formatParagraph = () => {
    if (blockType !== 'paragraph') {
      activeEditor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode())
        }
      })
    }
  }

  const formatHeading = (headingSize: HeadingTagType) => {
    if (blockType !== headingSize) {
      activeEditor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(headingSize))
        }
      })
    }
  }

  const formatBulletList = () => {
    if (blockType !== 'bullet') {
      activeEditor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    } else {
      activeEditor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatNumberedList = () => {
    if (blockType !== 'number') {
      activeEditor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    } else {
      activeEditor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
    }
  }

  const formatQuote = () => {
    if (blockType !== 'quote') {
      activeEditor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createQuoteNode())
        }
      })
    } else {
      formatParagraph()
    }
  }

  const formatCode = () => {
    if (blockType !== 'code') {
      activeEditor.update(() => {
        const selection = $getSelection()
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createCodeNode())
        }
      })
    } else {
      formatParagraph()
    }
  }

  const handleBlockTypeChange = (value: string) => {
    switch (value) {
      case 'paragraph':
        formatParagraph()
        break
      case 'h1':
        formatHeading('h1')
        break
      case 'h2':
        formatHeading('h2')
        break
      case 'h3':
        formatHeading('h3')
        break
      case 'bullet':
        formatBulletList()
        break
      case 'number':
        formatNumberedList()
        break
      case 'quote':
        formatQuote()
        break
      case 'code':
        formatCode()
        break
    }
  }

  return (
    <div className="toolbar bg-background border-b border-border flex items-center p-1 gap-1 sticky top-0 z-10 flex-wrap">
      <Select value={blockType} onValueChange={handleBlockTypeChange}>
        <SelectTrigger className="h-8 w-[140px] border-none shadow-none focus:ring-0">
          <SelectValue placeholder="Normal" />
        </SelectTrigger>
        <SelectContent
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            activeEditor.focus()
          }}
        >
          <SelectItem value="paragraph">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4" /> Normal
            </div>
          </SelectItem>
          <SelectItem value="h1">
            <div className="flex items-center gap-2">
              <Heading1 className="h-4 w-4" /> Heading 1
            </div>
          </SelectItem>
          <SelectItem value="h2">
            <div className="flex items-center gap-2">
              <Heading2 className="h-4 w-4" /> Heading 2
            </div>
          </SelectItem>
          <SelectItem value="h3">
            <div className="flex items-center gap-2">
              <Heading3 className="h-4 w-4" /> Heading 3
            </div>
          </SelectItem>
          <SelectItem value="number">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4" /> Numbered List
            </div>
          </SelectItem>
          <SelectItem value="bullet">
            <div className="flex items-center gap-2">
              <List className="h-4 w-4" /> Bullet List
            </div>
          </SelectItem>
          <SelectItem value="quote">
            <div className="flex items-center gap-2">
              <Quote className="h-4 w-4" /> Quote
            </div>
          </SelectItem>
          <SelectItem value="code">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4" /> Code Block
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Toggle
        size="sm"
        pressed={isBold}
        onPressedChange={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')
        }}
        aria-label="Format Bold"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={isItalic}
        onPressedChange={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')
        }}
        aria-label="Format Italic"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={isUnderline}
        onPressedChange={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')
        }}
        aria-label="Format Underline"
      >
        <Underline className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={isStrikethrough}
        onPressedChange={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')
        }}
        aria-label="Format Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={isCode}
        onPressedChange={() => {
          activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')
        }}
        aria-label="Insert Code"
      >
        <Code className="h-4 w-4" />
      </Toggle>
    </div>
  )
}
