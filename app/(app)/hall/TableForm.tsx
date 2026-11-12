"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { TABLE_SHAPES } from "@/lib/constants";
import { fmt } from "@/lib/i18n";
import { archiveTable, saveTable } from "@/app/actions/hall";
import type { HallTable } from "@/lib/hall";

export function TableForm({ open, table, nextNumber, onClose }: { open: boolean; table?: HallTable; nextNumber: number; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [confirm, setConfirm] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    act(
      () => saveTable({ id: table?.id, number: Number(fd.get("number")), seats: Number(fd.get("seats")), shape: String(fd.get("shape")) }),
      { success: t.common.saved, onOk: onClose },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={table ? fmt(t.hall.table, { n: table.number }) : t.hall.addTable}
      width={460}
      footer={
        <>
          {table && (
            <Button
              variant={confirm ? "danger" : "ghost"}
              className="mr-auto"
              disabled={pending}
              onClick={() => (confirm ? act(() => archiveTable(table.id), { success: t.common.saved, onOk: onClose }) : setConfirm(true))}
            >
              <Trash2 size={18} strokeWidth={1.75} />
              {confirm ? t.common.areYouSure : t.hall.removeTable}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" type="submit" form="table-form" disabled={pending}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="table-form" onSubmit={submit} className="grid grid-cols-2 gap-4 pb-2">
        <Input name="number" type="number" min={1} max={999} label={t.hall.number} defaultValue={table?.number ?? nextNumber} required className="num" />
        <Input name="seats" type="number" min={1} max={60} label={t.hall.seats} defaultValue={table?.seats ?? 4} required className="num" />
        <div className="col-span-2">
          <FieldLabel label={t.hall.shape}>
            <Select name="shape" defaultValue={table?.shape ?? "square"}>
              {TABLE_SHAPES.map((s) => (
                <option key={s} value={s}>
                  {t.hall.shapes[s]}
                </option>
              ))}
            </Select>
          </FieldLabel>
        </div>
      </form>
    </Modal>
  );
}
