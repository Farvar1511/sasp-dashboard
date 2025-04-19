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
    editorProps: {
      attributes: {
        class: 'focus:outline-none', // Prevent default browser outline if needed
      },
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

  // Define common button/select styles using the allowed colors
  const toolbarItemStyle = "px-2 py-1 text-xs rounded border border-[#f3c700]/50 bg-black/70 text-white hover:bg-black/90 hover:border-[#f3c700] focus:outline-none focus:ring-1 focus:ring-[#f3c700] focus:border-[#f3c700] transition-colors duration-150";
  const activeToolbarItemStyle = "bg-[#f3c700] border-[#f3c700] text-black"; // Style for active buttons

  return (
    <div className={`tiptap-editor-container ${editorClassName || ""}`}>
      {/* Container for the toolbar itself */}
      <div className="bg-black/95 p-2 rounded-t-lg border border-b-0 border-[#f3c700] shadow-lg text-white font-inter">
        <div className="flex flex-wrap gap-1"> {/* Reduced gap */}
          {/* Apply new styles to buttons and selects */}
          <button onClick={() => editor.chain().focus().toggleBold().run()} className={`${toolbarItemStyle} ${editor.isActive('bold') ? activeToolbarItemStyle : ''}`}>Bold</button>
          <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`${toolbarItemStyle} ${editor.isActive('italic') ? activeToolbarItemStyle : ''}`}>Italic</button>
          <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`${toolbarItemStyle} ${editor.isActive('underline') ? activeToolbarItemStyle : ''}`}>Underline</button>
          <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`${toolbarItemStyle} ${editor.isActive('strike') ? activeToolbarItemStyle : ''}`}>Strike</button>

          <select
            onChange={(e) => editor.chain().focus().setFontSize(e.target.value || '').run()}
            value={editor.getAttributes('textStyle').fontSize || ''}
            className={toolbarItemStyle}
          >
            <option value="">Size</option>
            <option value="12px">12</option>
            <option value="14px">14</option>
            <option value="16px">16</option>
            <option value="20px">20</option>
            <option value="24px">24</option>
          </select>

          <select
            onChange={(e) => editor.chain().focus().setFontFamily(e.target.value || '').run()}
            value={editor.getAttributes('textStyle').fontFamily || ''}
            className={toolbarItemStyle}
          >
            <option value="">Font</option>
            <option value="Inter">Inter</option>
            <option value="Arial">Arial</option>
            <option value="Verdana">Verdana</option>
            <option value="Georgia">Georgia</option>
            <option value="Courier New">Courier</option>
          </select>

          <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`${toolbarItemStyle} ${editor.isActive('heading', { level: 1 }) ? activeToolbarItemStyle : ''}`}>H1</button>
          <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${toolbarItemStyle} ${editor.isActive('heading', { level: 2 }) ? activeToolbarItemStyle : ''}`}>H2</button>
          <button onClick={() => editor.chain().focus().setParagraph().run()} className={`${toolbarItemStyle} ${editor.isActive('paragraph') ? activeToolbarItemStyle : ''}`}>P</button>
          <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${toolbarItemStyle} ${editor.isActive('bulletList') ? activeToolbarItemStyle : ''}`}>• List</button>
          <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`${toolbarItemStyle} ${editor.isActive('orderedList') ? activeToolbarItemStyle : ''}`}>1. List</button>
          <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`${toolbarItemStyle} ${editor.isActive({ textAlign: 'left' }) ? activeToolbarItemStyle : ''}`}>Left</button>
          <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`${toolbarItemStyle} ${editor.isActive({ textAlign: 'center' }) ? activeToolbarItemStyle : ''}`}>Center</button>
          <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`${toolbarItemStyle} ${editor.isActive({ textAlign: 'right' }) ? activeToolbarItemStyle : ''}`}>Right</button>

          <button
            onClick={() => {
              const url = prompt('Enter link URL:');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            className={`${toolbarItemStyle} ${editor.isActive('link') ? activeToolbarItemStyle : ''}`}
          >
            Link
          </button>
          <button onClick={() => editor.chain().focus().unsetLink().run()} className={toolbarItemStyle} disabled={!editor.isActive('link')}>Unlink</button>

          <button
            onClick={() => setIsColorPickerOpen(true)}
            className={toolbarItemStyle}
          >
            Color
          </button>
          <button onClick={() => editor.chain().focus().unsetColor().run()} className={toolbarItemStyle}>Reset</button>
        </div>
      </div>

      {/* Editor Content Area - Apply border matching the toolbar, add caret color and focus ring */}
      <EditorContent
        editor={editor}
        className={`ProseMirror p-2 bg-black/95 border border-t-0 border-[#f3c700] rounded-b-lg min-h-[150px] focus:outline-none focus:ring-1 focus:ring-[#f3c700] caret-white ${editorClassName}`} // Added caret-white and focus ring
        data-placeholder="Start typing..."
      />

      {/* Color Picker Modal */}
      {isColorPickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          {/* Adjusted modal style */}
          <div className="bg-black/90 p-4 rounded shadow-lg text-white border border-[#f3c700]">
            <h3 className="text-lg font-bold mb-4 text-[#f3c700]">Select Text Color</h3>
            <SketchPicker
              color={selectedColor}
              onChangeComplete={(color) => setSelectedColor(color.hex)}
              // Style picker with dark background
              styles={{ default: { picker: { background: '#1f2937', boxShadow: 'none', border: '1px solid #f3c700' } } }}
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
              {/* Favorite Colors - Adjusted border */}
              <button
                onClick={() => applyColor('#f3c700')}
                className="w-6 h-6 rounded-full bg-[#f3c700] border border-[#f3c700]/50 hover:scale-110 transition-transform"
                title="Favorite Yellow"
              />
              <button
                onClick={() => applyColor('#ffffff')}
                className="w-6 h-6 rounded-full bg-white border border-white/50 hover:scale-110 transition-transform"
                title="Favorite White"
              />
              {/* Add more favorite colors if needed */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TiptapEditor;
