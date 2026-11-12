"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2, X } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select, Textarea } from "@/components/ui/Field";
import { Switch } from "@/components/ui/Switch";
import { pickName } from "@/lib/i18n";
import { archiveDish, saveDish } from "@/app/actions/menu";
import type { MenuCategory, MenuDish } from "./MenuClient";

/** 3550 дирам → "35,50"; 3500 → "35" */
function priceToInput(dirams: number) {
  return dirams % 100 ? (dirams / 100).toFixed(2).replace(".", ",") : String(dirams / 100);
}

/** Ужать фото в браузере до 800px JPEG — быстро грузится и не упирается в лимит запроса. */
async function shrinkImage(file: File, max = 800): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob ? new File([blob], "dish.jpg", { type: "image/jpeg" }) : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function DishForm({
  open,
  dish,
  categories,
  defaultCategoryId,
  onClose,
}: {
  open: boolean;
  dish?: MenuDish;
  categories: MenuCategory[];
  defaultCategoryId?: number;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const [pending, act] = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(dish?.photo ?? null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [stop, setStop] = useState(dish?.inStopList ?? false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    const small = await shrinkImage(f);
    setPhoto(small);
    setPreview(URL.createObjectURL(small));
    setRemovePhoto(false);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (dish) fd.set("id", String(dish.id));
    fd.set("inStopList", String(stop));
    fd.set("removePhoto", String(removePhoto));
    fd.delete("photoInput");
    if (photo) fd.set("photo", photo);
    act(() => saveDish(fd), { success: t.common.saved, onOk: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dish ? t.menu.editDish : t.menu.addDish}
      width={640}
      footer={
        <>
          {dish && (
            <Button
              variant={confirmArchive ? "danger" : "ghost"}
              className="mr-auto"
              disabled={pending}
              onClick={() =>
                confirmArchive ? act(() => archiveDish(dish.id), { success: t.common.saved, onOk: onClose }) : setConfirmArchive(true)
              }
              title={t.menu.archiveHint}
            >
              <Trash2 size={18} strokeWidth={1.75} />
              {confirmArchive ? t.common.areYouSure : t.menu.archive}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" type="submit" form="dish-form" disabled={pending}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <form id="dish-form" onSubmit={submit} className="grid grid-cols-[180px_1fr] gap-5">
        {/* Фото */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">{t.menu.photo}</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-line bg-surface-2 text-muted transition-colors hover:border-saffron hover:text-saffron"
          >
            {preview && !removePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm">
                <ImagePlus size={28} strokeWidth={1.5} />
                {t.menu.choosePhoto}
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            name="photoInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
          />
          {preview && !removePhoto && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRemovePhoto(true);
                setPhoto(null);
              }}
            >
              <X size={16} strokeWidth={1.75} />
              {t.menu.removePhoto}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <FieldLabel label={t.menu.category}>
            <Select name="categoryId" defaultValue={dish?.categoryId ?? defaultCategoryId} required>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickName(c, locale)}
                </option>
              ))}
            </Select>
          </FieldLabel>
          <div className="grid grid-cols-2 gap-4">
            <Input name="nameRu" label={t.menu.nameRu} defaultValue={dish?.nameRu} required maxLength={80} autoFocus={!dish} />
            <Input name="nameTg" label={t.menu.nameTg} defaultValue={dish?.nameTg} required maxLength={80} />
          </div>
          <Input
            name="price"
            label={t.menu.price}
            defaultValue={dish ? priceToInput(dish.price) : ""}
            required
            inputMode="decimal"
            placeholder="35"
            className="num w-40 font-display text-lg"
          />
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-4">
          <FieldLabel label={t.menu.descriptionRu}>
            <Textarea name="descriptionRu" defaultValue={dish?.descriptionRu ?? ""} maxLength={300} />
          </FieldLabel>
          <FieldLabel label={t.menu.descriptionTg}>
            <Textarea name="descriptionTg" defaultValue={dish?.descriptionTg ?? ""} maxLength={300} />
          </FieldLabel>
        </div>

        <div className="col-span-2">
          <Switch checked={stop} onChange={setStop} label={t.menu.inStopList} tone="pomegranate" />
        </div>
      </form>
    </Modal>
  );
}
