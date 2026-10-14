"use client";

import { useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import { isValidNickname } from "@/lib/validation";

interface Props {
  open: boolean;
  /** Shown inline, e.g. the API's nickname_taken message. */
  error?: string | null;
  onSave: (nickname: string) => void;
  onClose: () => void;
}

/** Asks for the public nickname once; it is saved in this browser by the caller. */
export function NicknameDialog({ open, error, onSave, onClose }: Props) {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = isValidNickname(value);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (valid) onSave(value.trim());
  };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <form onSubmit={submit} noValidate>
        <DialogTitle>Pick a nickname</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Nickname"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={(touched && !valid) || Boolean(error)}
            helperText={error ?? (touched && !valid ? "2–20 letters, numbers, spaces, dots, dashes or underscores." : "Shown next to your chat messages and comments.")}
            slotProps={{ htmlInput: { maxLength: 20 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
