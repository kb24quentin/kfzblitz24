"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useImperativeHandle, forwardRef } from "react";
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

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }, ref) {
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
      onUpdate: ({ editor }) => onChange(editor.getHTML()),
      editorProps: {
        attributes: {
          class: "prose prose-sm max-w-none focus:outline-none px-4 py-3",
          style: `min-height: ${minHeight}px;`,
        },
      },
    });

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
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    };

    return (
      <div className="border border-border rounded-lg overflow-hidden bg-white">
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
      </div>
    );
  }
);

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
