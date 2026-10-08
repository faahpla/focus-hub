import { useEffect, useRef, useState } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import { Fragment, Slice } from '@tiptap/pm/model'
import {
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline
} from 'lucide-react'
import { toEditorHtml } from '@/lib/rich-text'
import { cn } from '@/lib/utils'

/**
 * A text box that takes formatting: select text and a small menu offers bold,
 * italic, underline, strike, highlight, titles, lists and quote. The usual
 * shortcuts work too (Ctrl+B, Ctrl+I, Ctrl+U), and so does Markdown typed at
 * the start of a line — "# " for a title, "- " for a list.
 *
 * Every line is a paragraph with no gap, so it reads like the plain box it
 * replaced and old texts look the same until they get formatted.
 */
export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  autoFocus,
  className,
  style
}: {
  /** Stored value: the editor's HTML, or plain text from before formatting. */
  value: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
  autoFocus?: boolean
  className?: string
  style?: React.CSSProperties
}): JSX.Element {
  // What this editor last handed out, so its own echo is not loaded back in
  // (that would reset the caret on every keystroke).
  const emitted = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onBlurRef = useRef(onBlur)
  onBlurRef.current = onBlur

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
        code: false,
        codeBlock: false,
        // A link would be one click away from navigating the app's window.
        link: false
      }),
      Highlight,
      Placeholder.configure({ placeholder: placeholder ?? '' })
    ],
    content: toEditorHtml(value),
    // Keep runs of spaces as typed; the default squeezes them into one, which
    // would quietly rewrite indented lines the first time a text is edited.
    parseOptions: { preserveWhitespace: 'full' },
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { class: 'rich-text no-drag focus:outline-none' },
      /*
        Plain text pastes one paragraph per line, blank lines included. The
        default merges runs of line breaks, which closed up the spacing of
        every script pasted in.
      */
      clipboardTextParser: (text, _context, _plain, view) => {
        const { schema } = view.state
        const lines = text.split(/\r\n?|\n/)
        const nodes = lines.map((line) =>
          schema.nodes.paragraph.create(null, line ? schema.text(line) : undefined)
        )
        return new Slice(Fragment.from(nodes), 1, 1)
      },
      // And copies back out the same way: one line per paragraph.
      clipboardTextSerializer: (slice) =>
        slice.content.textBetween(0, slice.content.size, '\n', (leaf) =>
          leaf.type.name === 'hardBreak' ? '\n' : ''
        )
    },
    onUpdate: ({ editor: e }) => {
      const html = e.isEmpty ? '' : e.getHTML()
      emitted.current = html
      onChangeRef.current(html)
    },
    onBlur: () => onBlurRef.current?.()
  })

  // A change from outside (the reader, another device) replaces the content.
  useEffect(() => {
    if (!editor || value === emitted.current) return
    emitted.current = value
    editor.commands.setContent(toEditorHtml(value), { emitUpdate: false })
  }, [editor, value])

  // The box scrolls itself, so the menu has to follow that scroll, not the window's.
  const [box, setBox] = useState<HTMLDivElement | null>(null)

  return (
    <div
      ref={setBox}
      className={cn('cursor-text', className)}
      style={style}
      // A click in the empty space below the text lands at its end.
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget || !editor) return
        e.preventDefault()
        editor.commands.focus('end')
      }}
    >
      {editor && box && <FormatMenu editor={editor} scrollTarget={box} />}
      <EditorContent editor={editor} />
    </div>
  )
}

function FormatMenu({
  editor,
  scrollTarget
}: {
  editor: Editor
  scrollTarget: HTMLElement
}): JSX.Element {
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      paragraph: e.isActive('paragraph'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote')
    })
  })
  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus()

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 8,
        flip: true,
        shift: { padding: 8 },
        strategy: 'fixed',
        scrollTarget
      }}
      className="z-[70] flex items-center gap-0.5 rounded-xl border border-border bg-surface-elevated p-1 shadow-elevated"
    >
      <MenuButton
        label="Texto normal"
        on={active.paragraph}
        onClick={() => chain().setParagraph().run()}
      >
        <Pilcrow />
      </MenuButton>
      <MenuButton
        label="Título"
        on={active.h1}
        onClick={() => chain().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 />
      </MenuButton>
      <MenuButton
        label="Subtítulo"
        on={active.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </MenuButton>
      <Divider />
      <MenuButton
        label="Negrito (Ctrl+B)"
        on={active.bold}
        onClick={() => chain().toggleBold().run()}
      >
        <Bold />
      </MenuButton>
      <MenuButton
        label="Itálico (Ctrl+I)"
        on={active.italic}
        onClick={() => chain().toggleItalic().run()}
      >
        <Italic />
      </MenuButton>
      <MenuButton
        label="Sublinhado (Ctrl+U)"
        on={active.underline}
        onClick={() => chain().toggleUnderline().run()}
      >
        <Underline />
      </MenuButton>
      <MenuButton label="Riscado" on={active.strike} onClick={() => chain().toggleStrike().run()}>
        <Strikethrough />
      </MenuButton>
      <MenuButton
        label="Marca-texto"
        on={active.highlight}
        onClick={() => chain().toggleHighlight().run()}
      >
        <Highlighter />
      </MenuButton>
      <Divider />
      <MenuButton label="Lista" on={active.bullet} onClick={() => chain().toggleBulletList().run()}>
        <List />
      </MenuButton>
      <MenuButton
        label="Lista numerada"
        on={active.ordered}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered />
      </MenuButton>
      <MenuButton
        label="Citação"
        on={active.quote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote />
      </MenuButton>
      <Divider />
      <MenuButton
        label="Limpar formatação"
        on={false}
        onClick={() => chain().unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting />
      </MenuButton>
    </BubbleMenu>
  )
}

function MenuButton({
  label,
  on,
  onClick,
  children
}: {
  label: string
  on: boolean
  onClick: () => void
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={on}
      // Keep the selection: a mousedown on the button would otherwise blur it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'no-drag flex h-7 w-7 items-center justify-center rounded-lg transition-colors [&_svg]:h-3.5 [&_svg]:w-3.5',
        on
          ? 'bg-primary/20 text-primary'
          : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function Divider(): JSX.Element {
  return <span className="mx-0.5 h-4 w-px bg-border" />
}
