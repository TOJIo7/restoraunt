"use client";

import { useState } from "react";
import { KeyRound, Phone, Plus, UserMinus } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FieldLabel, Select } from "@/components/ui/Field";
import { formatMoney } from "@/lib/money";
import { PAY_TYPES, POSITIONS } from "@/lib/constants";
import { archiveEmployee, saveEmployee } from "@/app/actions/staff";

export type Member = {
  id: number;
  name: string;
  position: string;
  phone: string | null;
  payType: string;
  salary: number;
  rate: number;
  salesPercentBp: number;
  hasLogin: boolean;
};

// цвет кружка-аватара по должности
const POS_TONE: Record<string, string> = {
  WAITER: "bg-saffron/15 text-saffron",
  COOK: "bg-pomegranate/15 text-pomegranate",
  CASHIER: "bg-lapis/15 text-lapis",
  COURIER: "bg-mint/15 text-mint",
  CLEANER: "bg-apricot/15 text-apricot",
  MANAGER: "bg-text/10 text-text",
};

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function Avatar({ name, position, size = 44 }: { name: string; position: string; size?: number }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold ${POS_TONE[position] ?? ""}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function Team({ team, isOwner }: { team: Member[]; isOwner: boolean }) {
  const { t } = useI18n();
  const [form, setForm] = useState<{ open: boolean; m?: Member }>({ open: false });

  const pay = (m: Member) => {
    const parts: string[] = [];
    if (m.payType === "MONTHLY") parts.push(`${formatMoney(m.salary)} / ${t.staff.month.toLowerCase()}`);
    if (m.payType === "PER_SHIFT") parts.push(`${formatMoney(m.rate)} ${t.staff.ratePerShift}`);
    if (m.payType === "HOURLY") parts.push(`${formatMoney(m.rate)} ${t.staff.ratePerHour}`);
    if (m.salesPercentBp) parts.push(`+ ${m.salesPercentBp / 100}% ${t.staff.sales.toLowerCase()}`);
    return parts.join(" ");
  };

  return (
    <>
      {isOwner && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setForm({ open: true })}>
            <Plus size={18} strokeWidth={1.75} />
            {t.staff.add}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {team.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={isOwner ? () => setForm({ open: true, m }) : undefined}
            className={`flex items-start gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 text-left transition-colors ${isOwner ? "hover:bg-surface-2" : "cursor-default"}`}
          >
            <Avatar name={m.name} position={m.position} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{m.name}</div>
              <div className="text-sm text-muted">{t.positions[m.position as "WAITER"]}</div>
              {m.phone && (
                <div className="num mt-2 flex items-center gap-1.5 text-sm text-muted">
                  <Phone size={13} strokeWidth={1.75} />
                  {m.phone}
                </div>
              )}
              {isOwner && <div className="num mt-2 text-sm">{pay(m)}</div>}
            </div>
            {m.hasLogin && (
              <span title={t.staff.hasLogin} className="text-lapis">
                <KeyRound size={16} strokeWidth={1.75} />
              </span>
            )}
          </button>
        ))}
      </div>
      {form.open && <EmployeeForm m={form.m} onClose={() => setForm({ open: false })} />}
    </>
  );
}

const toInput = (d: number) => (d ? (d % 100 ? (d / 100).toFixed(2).replace(".", ",") : String(d / 100)) : "");

function EmployeeForm({ m, onClose }: { m?: Member; onClose: () => void }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [confirm, setConfirm] = useState(false);
  const [v, setV] = useState({
    name: m?.name ?? "",
    position: m?.position ?? "WAITER",
    phone: m?.phone ?? "",
    payType: m?.payType || "MONTHLY",
    salary: toInput(m?.salary ?? 0),
    rate: toInput(m?.rate ?? 0),
    salesPercent: m ? String(m.salesPercentBp / 100).replace(".", ",") : "0",
  });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  return (
    <Modal
      open
      onClose={onClose}
      title={m ? m.name : t.staff.add}
      width={560}
      footer={
        <>
          {m && (
            <Button
              variant={confirm ? "danger" : "ghost"}
              className="mr-auto"
              disabled={pending}
              title={t.staff.fireHint}
              onClick={() => (confirm ? act(() => archiveEmployee(m.id), { success: t.common.saved, onOk: onClose }) : setConfirm(true))}
            >
              <UserMinus size={18} strokeWidth={1.75} />
              {confirm ? t.common.areYouSure : t.staff.fire}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" disabled={pending || !v.name.trim()} onClick={() => act(() => saveEmployee({ id: m?.id, ...v }), { success: t.common.saved, onOk: onClose })}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 pb-2">
        <div className="col-span-2">
          <Input label={t.staff.name} value={v.name} onChange={set("name")} maxLength={80} autoFocus />
        </div>
        <FieldLabel label={t.staff.position}>
          <Select value={v.position} onChange={set("position")}>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {t.positions[p]}
              </option>
            ))}
          </Select>
        </FieldLabel>
        <Input label={t.staff.phone} value={v.phone} onChange={set("phone")} inputMode="tel" placeholder="+992 " maxLength={30} />
        <FieldLabel label={t.staff.payType}>
          <Select value={v.payType} onChange={set("payType")}>
            {PAY_TYPES.map((p) => (
              <option key={p} value={p}>
                {t.payTypes[p]}
              </option>
            ))}
          </Select>
        </FieldLabel>
        {v.payType === "MONTHLY" ? (
          <Input label={t.staff.salary} value={v.salary} onChange={set("salary")} inputMode="decimal" className="num" />
        ) : (
          <Input label={`${t.staff.rate} ${v.payType === "HOURLY" ? t.staff.ratePerHour : t.staff.ratePerShift}`} value={v.rate} onChange={set("rate")} inputMode="decimal" className="num" />
        )}
        <Input label={t.staff.salesPercent} value={v.salesPercent} onChange={set("salesPercent")} inputMode="decimal" className="num" />
      </div>
    </Modal>
  );
}
