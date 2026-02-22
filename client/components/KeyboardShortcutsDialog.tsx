/**
 * KeyboardShortcutsDialog - Shows available keyboard shortcuts
 */

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KEYBOARD_SHORTCUTS } from "@/hooks/useKeyboardShortcuts";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {KEYBOARD_SHORTCUTS.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                {category.category}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          {keyIdx > 0 && (
                            <span className="text-xs text-muted-foreground">
                              then
                            </span>
                          )}
                          <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded border border-border min-w-[24px] text-center">
                            {key === "Cmd" ? "⌘" : key.toUpperCase()}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">?</kbd> anytime to show this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsDialog;
