"use client";

import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { saveCategory } from "@/app/actions/menu";
import type { MenuCategory } from "./MenuClient";

export function CategoryForm({ open, category, onClose }: { open: boolean; category?: MenuCategory; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    act(() => saveCategory({ id: category?.id, nameRu: String(fd.get("nameRu")), nameTg: String(fd.get("nameTg")) }), {
      success: t.common.saved,
      onOk: onClose,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={category ? t.menu.editCategory : t.menu.addCategory}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" type="submit" form="cat-form" disabled={pending}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="cat-form" onSubmit={submit} className="flex flex-col gap-4 pb-2">
        <Input name="nameRu" label={t.menu.nameRu} defaultValue={category?.nameRu} required maxLength={60} autoFocus />
        <Input name="nameTg" label={t.menu.nameTg} defaultValue={category?.nameTg} required maxLength={60} />
      </form>
    </Modal>
  );
}
