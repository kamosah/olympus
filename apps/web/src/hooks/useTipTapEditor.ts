/**
 * Custom hook for TipTap editor initialization and management
 *
 * Following ADR-003: Mentions Implementation with TipTap
 * Provides editor instance with configured extensions and event handlers
 */

import {
  getEditorExtensions,
  type EditorExtensionsConfig,
} from '@/lib/tiptap/extensions';
import { useEditor, type Editor } from '@tiptap/react';
import { useEffect } from 'react';

export interface UseTipTapEditorOptions extends EditorExtensionsConfig {
  /**
   * Initial content of the editor (plain text or HTML)
   */
  content?: string;

  /**
   * Callback when editor content changes
   */
  onUpdate?: (content: string) => void;

  /**
   * Callback when user presses Enter (to submit)
   */
  onSubmit?: (content: string) => void;

  /**
   * Whether the editor is disabled
   */
  disabled?: boolean;

  /**
   * Whether to auto-focus the editor on mount
   */
  autofocus?: boolean;
}

/**
 * Custom hook for initializing and managing a TipTap editor instance
 *
 * @param options - Configuration options for the editor
 * @returns TipTap editor instance
 *
 * @example
 * ```tsx
 * const editor = useTipTapEditor({
 *   placeholder: 'Ask a question...',
 *   onSubmit: (content) => console.log('Submitted:', content),
 *   onUpdate: (content) => console.log('Content:', content),
 * });
 * ```
 */
export function useTipTapEditor(
  options: UseTipTapEditorOptions = {}
): Editor | null {
  const {
    content = '',
    onUpdate,
    onSubmit,
    disabled = false,
    autofocus = false,
    placeholder,
  } = options;

  const editor = useEditor(
    {
      extensions: getEditorExtensions({ placeholder }),
      content,
      autofocus,
      editable: !disabled,
      immediatelyRender: false, // Required for Next.js SSR to avoid hydration mismatches

      // Handle content updates
      onUpdate: ({ editor }) => {
        const text = editor.getText();
        onUpdate?.(text);
      },

      // Custom keyboard shortcuts
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none focus:outline-none p-4',
        },
        handleKeyDown: (view, event) => {
          const { state } = view;
          const text = state.doc.textContent.trim();
          // Handle Enter key for submission (without Shift)
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (text) {
              onSubmit?.(text);
              // Clear content using the live view
              view.dispatch(state.tr.delete(0, state.doc.content.size));
            }
            return true;
          }

          // Shift+Enter creates a hard break (new line)
          // This is handled by the HardBreak extension
          return false;
        },
      },
    },
    // Empty dependency array - editor created once on mount
    // Placeholder is part of extension config and doesn't need to trigger recreation
    []
  );

  // Update editable state when disabled changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  return editor;
}

/**
 * Helper to get plain text content from editor
 */
export function getEditorText(editor: Editor | null): string {
  return editor?.getText() || '';
}

/**
 * Helper to clear editor content
 */
export function clearEditorContent(editor: Editor | null): void {
  editor?.commands.clearContent();
}

/**
 * Helper to set editor content
 */
export function setEditorContent(editor: Editor | null, content: string): void {
  editor?.commands.setContent(content);
}

/**
 * Helper to focus the editor
 */
export function focusEditor(editor: Editor | null): void {
  editor?.commands.focus();
}
