"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  useEffect,
  useImperativeHandle,
  forwardRef,
  useState,
  useRef,
  useMemo,
} from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";

export type RichTextEditorHandle = {
  insertText: (text: string) => void;
  getHTML: () => string;
};

/**
 * A shortcode choice offered by the `::` autocomplete dropdown.
 * The parent is responsible for variable substitution — `html` is inserted
 * verbatim into the editor when the user picks the entry.
 */
export type ShortcodeChoice = {
  shortcode: string;
  label: string;
  category?: string | null;
  html: string;
};

type MenuState = {
  filter: string;
  active: number;
  from: number; // start of `::…` range in editor
  to: number;   // end of `::…` range (== cursor)
  x: number;
  y: number;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  /** Templates available via `::code` autocomplete. */
  shortcodes?: ShortcodeChoice[];
};

const MAX_RESULTS = 8;

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  function RichTextEditor(
    { value, onChange, placeholder, minHeight = 200, shortcodes = [] },
    ref
  ) {
    const [menu, setMenu] = useState<MenuState | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const shortcodesRef = useRef(shortcodes);
    useEffect(() => {
      shortcodesRef.current = shortcodes;
    }, [shortcodes]);

    const filtered = useMemo(() => {
      if (!menu) return [];
      const f = menu.filter.toLowerCase();
      const all = shortcodesRef.current;
      const startsWith = all.filter((s) => s.shortcode.toLowerCase().startsWith(f));
      const contains = all.filter(
        (s) => !startsWith.includes(s) && s.shortcode.toLowerCase().includes(f)
      );
      return [...startsWith, ...contains].slice(0, MAX_RESULTS);
    }, [menu]);
    const filteredRef = useRef(filtered);
    useEffect(() => {
      filteredRef.current = filtered;
    }, [filtered]);

    const menuRef = useRef(menu);
    useEffect(() => {
      menuRef.current = menu;
    }, [menu]);

    const detectMenu = (ed: Editor) => {
      if (shortcodesRef.current.length === 0) {
        setMenu(null);
        return;
      }
      const { from } = ed.state.selection;
      const before = ed.state.doc.textBetween(Math.max(0, from - 40), from, "\n", "\n");
      const match = before.match(/::([a-zA-Z0-9_]*)$/);
      if (!match) {
        setMenu(null);
        return;
      }
      let coords;
      try {
        coords = ed.view.coordsAtPos(from);
      } catch {
        return;
      }
      setMenu((prev) => ({
        filter: match[1],
        active: prev && prev.filter === match[1] ? prev.active : 0,
        from: from - match[0].length,
        to: from,
        x: coords.left,
        y: coords.bottom,
      }));
    };

    const insertChoice = (choice: ShortcodeChoice) => {
      const ed = editorRef.current;
      const m = menuRef.current;
      if (!ed || !m) return;
      ed.chain()
        .focus()
        .deleteRange({ from: m.from, to: m.to })
        .insertContent(choice.html)
        .run();
      setMenu(null);
    };

    const editor = useEditor({
      extensions: [
        StarterKit,
        Link.configure({
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          HTMLAttributes: {
            target: "_blank",
            rel: "noopener noreferrer",
            class: "text-accent underline",
          },
        }),
      ],
      content: value || "",
      immediatelyRender: false,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
        detectMenu(editor);
      },
      onSelectionUpdate: ({ editor }) => detectMenu(editor),
      onBlur: () => {
        // Close menu on blur, but with a slight delay so click-on-menu-item still lands.
        setTimeout(() => setMenu(null), 150);
      },
      editorProps: {
        attributes: {
          class: "prose prose-sm max-w-none focus:outline-none px-4 py-3",
          style: `min-height: ${minHeight}px;`,
        },
        handleKeyDown(view, event) {
          const m = menuRef.current;
          if (!m) return false;
          const items = filteredRef.current;
          if (items.length === 0) {
            if (event.key === "Escape") {
              setMenu(null);
              return true;
            }
            return false;
          }
          if (event.key === "ArrowDown") {
            setMenu((prev) => (prev ? { ...prev, active: (prev.active + 1) % items.length } : prev));
            event.preventDefault();
            return true;
          }
          if (event.key === "ArrowUp") {
            setMenu((prev) =>
              prev ? { ...prev, active: (prev.active - 1 + items.length) % items.length } : prev
            );
            event.preventDefault();
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            const chosen = items[m.active];
            if (chosen) {
              event.preventDefault();
              insertChoice(chosen);
              return true;
            }
          }
          if (event.key === "Escape") {
            setMenu(null);
            event.preventDefault();
            return true;
          }
          return false;
        },
      },
    });

    useEffect(() => {
      editorRef.current = editor;
    }, [editor]);

    useImperativeHandle(
      ref,
      () => ({
        insertText: (text: string) => {
          editor?.chain().focus().insertContent(text).run();
        },
        getHTML: () => editor?.getHTML() ?? "",
      }),
      [editor]
    );

    // Sync external value resets (e.g. after successful submit)
    useEffect(() => {
      if (editor && value !== editor.getHTML()) {
        editor.commands.setContent(value || "", { emitUpdate: false });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    if (!editor) {
      return (
        <div
          className="border border-border rounded-lg bg-bg-secondary"
          style={{ minHeight: minHeight + 40 }}
        />
      );
    }

    const setLink = () => {
      const previousUrl = editor.getAttributes("link").href as string | undefined;
      const url = window.prompt("Link URL", previousUrl || "https://");
      if (url === null) return;
      if (url === "") {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        return;
      }
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    return (
      <div className="border border-border rounded-lg overflow-hidden bg-white relative">
        <Toolbar editor={editor} onSetLink={setLink} />
        {editor.isEmpty && placeholder && (
          <div
            className="absolute pointer-events-none text-text-light/60 px-4 py-3 text-sm"
            aria-hidden
          >
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
        {menu && filtered.length > 0 && (
          <ShortcodeMenu
            items={filtered}
            active={menu.active}
            x={menu.x}
            y={menu.y}
            onPick={(i) => insertChoice(filtered[i])}
            onHover={(i) =>
              setMenu((prev) => (prev ? { ...prev, active: i } : prev))
            }
          />
        )}
      </div>
    );
  }
);

function ShortcodeMenu({
  items,
  active,
  x,
  y,
  onPick,
  onHover,
}: {
  items: ShortcodeChoice[];
  active: number;
  x: number;
  y: number;
  onPick: (i: number) => void;
  onHover: (i: number) => void;
}) {
  return (
    <div
      className="fixed z-50 bg-white border border-border rounded-lg shadow-xl overflow-hidden"
      style={{ top: y + 4, left: x, minWidth: 280, maxWidth: 380 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="px-3 py-1.5 bg-bg-secondary/60 border-b border-border text-xs text-text-light">
        Template einfügen · <kbd className="px-1 py-0.5 bg-white border border-border rounded text-[10px]">↑↓</kbd> navigieren · <kbd className="px-1 py-0.5 bg-white border border-border rounded text-[10px]">Enter</kbd> wählen
      </div>
      <ul className="max-h-64 overflow-y-auto">
        {items.map((s, i) => (
          <li key={s.shortcode}>
            <button
              type="button"
              onMouseEnter={() => onHover(i)}
              onClick={() => onPick(i)}
              className={`w-full text-left px-3 py-2 transition-colors ${
                i === active
                  ? "bg-accent/10 text-text"
                  : "text-text-light hover:bg-bg-secondary"
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs text-accent">::{s.shortcode}</span>
                <span className="text-sm truncate flex-1">{s.label}</span>
              </div>
              {s.category && (
                <div className="text-[11px] text-text-light mt-0.5">{s.category}</div>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Toolbar({ editor, onSetLink }: { editor: Editor; onSetLink: () => void }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-bg-secondary/60">
      <Btn
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Fett (Cmd+B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Kursiv (Cmd+I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </Btn>
      <Sep />
      <Btn
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Liste"
      >
        <List className="w-3.5 h-3.5" />
      </Btn>
      <Btn
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Nummerierte Liste"
      >
        <ListOrdered className="w-3.5 h-3.5" />
      </Btn>
      <Sep />
      <Btn active={editor.isActive("link")} onClick={onSetLink} title="Link einfügen">
        <LinkIcon className="w-3.5 h-3.5" />
      </Btn>
      {editor.isActive("link") && (
        <Btn
          onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}
          title="Link entfernen"
        >
          <Unlink className="w-3.5 h-3.5" />
        </Btn>
      )}
      <div className="flex-1" />
      <span className="text-xs text-text-light font-mono pr-1">
        <kbd className="px-1.5 py-0.5 bg-white border border-border rounded">::</kbd> für Templates
      </span>
    </div>
  );
}

function Btn({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded text-text-light hover:bg-bg-card hover:text-text transition-colors ${
        active ? "bg-bg-card text-accent" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="w-px h-5 bg-border mx-1 self-center" />;
}
