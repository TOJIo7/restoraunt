"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useAction, useI18n } from "@/components/Providers";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { changePin, saveSettings } from "@/app/actions/settings";

type Settings = { restaurantName: string; serviceChargeBp: number; soundEnabled: boolean };
type U = { id: number; name: string; role: "OWNER" | "CASHIER" };

export function SettingsClient({ settings, users }: { settings: Settings; users: U[] }) {
  const { t } = useI18n();
  const [pending, act] = useAction();
  const [sound, setSound] = useState(settings.soundEnabled);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    act(
      () =>
        saveSettings({
          restaurantName: String(fd.get("restaurantName")),
          servicePercent: String(fd.get("servicePercent")),
          soundEnabled: sound,
        }),
      { success: t.common.saved },
    );
  };

  return (
    <>
      <PageHeader title={t.nav.settings} />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-5 font-display text-lg font-semibold">{t.settings.restaurant}</h2>
          <form onSubmit={submit} className="flex flex-col gap-5">
            <Input name="restaurantName" label={t.settings.restaurantName} defaultValue={settings.restaurantName} required maxLength={80} />
            <div>
              <Input
                name="servicePercent"
                label={t.settings.serviceCharge}
                defaultValue={String(settings.serviceChargeBp / 100).replace(".", ",")}
                inputMode="decimal"
                className="num w-32 font-display text-lg"
                required
              />
              <p className="mt-1.5 text-xs text-muted">{t.settings.serviceHint}</p>
            </div>
            <Switch checked={sound} onChange={setSound} label={t.settings.sound} />
            <div>
              <Button variant="primary" type="submit" disabled={pending}>
                {t.common.save}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg font-semibold">{t.settings.pins}</h2>
          <p className="mb-5 mt-1 text-sm text-muted">{t.settings.pinsHint}</p>
          <div className="flex flex-col gap-4">
            {users.map((u) => (
              <PinRow key={u.id} user={u} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function PinRow({ user }: { user: U }) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [pending, act] = useAction();
  return (
    <div className="flex items-end gap-3 rounded-[var(--radius-btn)] border border-line bg-surface-2/50 p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{user.name}</div>
        <div className="text-xs text-muted">{t.roles[user.role]}</div>
      </div>
      <input
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        type="password"
        autoComplete="new-password"
        placeholder="••••"
        aria-label={t.settings.newPin}
        className="num h-12 w-24 rounded-[var(--radius-btn)] border border-line bg-surface px-3 text-center text-lg tracking-[0.3em] focus:border-saffron focus:outline-none"
      />
      <Button
        disabled={pending || pin.length !== 4}
        onClick={() => act(() => changePin(user.id, pin), { success: t.settings.pinChanged, onOk: () => setPin("") })}
      >
        <KeyRound size={16} strokeWidth={1.75} />
        {t.settings.changePin}
      </Button>
    </div>
  );
}
