import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import FontSize from '@tiptap/extension-font-size';
import Color from '@tiptap/extension-color';
import { SketchPicker } from 'react-color'; // Import SketchPicker for color selection

interface TiptapEditorProps {
  content: string;
  onChange: (html: string) => void;
  editorClassName?: string; // <-- Add this line
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content,
  onChange,
  editorClassName, // <-- Accept the new prop
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#f3c700'); // Default to favorite color

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      FontFamily,
      FontSize,
      Color,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]);

  const applyColor = (color: string) => {
    editor?.chain().focus().setColor(color).run();
    setIsColorPickerOpen(false); // Close the modal after applying the color
  };

  if (!editor) return null;

  return (
    <div className={`tiptap-editor-container ${editorClassName || ""}`}>
      <div className="bg-black/95 p-4 rounded-lg border border-[#f3c700] shadow-lg text-white font-inter">
        <div className="flex flex-wrap gap-2 mb-2">
          <button onClick={() => editor.chain().focus().toggleBold().run()} className="btn">Bold</button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className="btn">Italic</button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className="btn">Underline</button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className="btn">Strike</button>
          <select onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()} className="btn">
            <option value="">Font Size</option>
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="16px">16</option>
            <option value="20px">20</option>
            <option value="24px">24</option>
          </select>
          <select onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()} className="btn">
            <option value="">Font</option>
            <option value="Inter">Inter</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier New</option>
          </select>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="btn">H1</button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="btn">H2</button>
          <button onClick={() => editor.chain().focus().setParagraph().run()} className="btn">P</button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className="btn">• List</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className="btn">1. List</button>
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className="btn">Left</button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className="btn">Center</button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className="btn">Right</button>
          <button
            onClick={() => {
              const url = prompt('Enter link:')
              if (url) editor.chain().focus().setLink({ href: url }).run()
            }}
            className="btn"
          >
            Link
          </button>
          <button onClick={() => editor.chain().focus().unsetLink().run()} className="btn">Unlink</button>
          <button
            onClick={() => setIsColorPickerOpen(true)}
            className="btn"
          >
            Text Color
          </button>
          <button onClick={() => editor.chain().focus().unsetColor().run()} className="btn">Reset Color</button>
        </div>

        <EditorContent
          editor={editor}
          className="ProseMirror"
          data-placeholder="Start typing your bulletin..."
        />

        {/* Color Picker Modal */}
        {isColorPickerOpen && (
          <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
            <div className="bg-black bg-opacity-90 p-4 rounded shadow-lg text-white">
              <h3 className="text-lg font-bold mb-4">Select Text Color</h3>
              <SketchPicker
                color={selectedColor}
                onChangeComplete={(color) => setSelectedColor(color.hex)}
              />
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => applyColor(selectedColor)}
                  className="button-primary"
                >
                  Apply
                </button>
                <button
                  onClick={() => setIsColorPickerOpen(false)}
                  className="button-secondary"
                >
                  Cancel
                </button>
              </div>
              <div className="flex gap-2 mt-4">
                {/* Favorite Colors */}
                <button
                  onClick={() => applyColor('#f3c700')}
                  className="w-8 h-8 rounded-full bg-[#f3c700] border border-gray-600"
                  title="Favorite Yellow"
                />
                <button
                  onClick={() => applyColor('#ffffff')}
                  className="w-8 h-8 rounded-full bg-white border border-gray-600"
                  title="Favorite White"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TiptapEditor;
