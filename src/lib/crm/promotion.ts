// Estado da promoção — função pura. Nada de "último dia" hardcoded:
// só é "último dia" quando a data de término cai hoje (no fuso da loja).

export interface PromotionInput {
  promotion_active: boolean;
  promotion_start_at: string | null;
  promotion_end_at: string | null;
  promotion_message: string | null;
}

export interface PromotionState {
  /** ativa agora (flag ligada e dentro da janela de datas, quando definida) */
  active: boolean;
  /** termina hoje (mesmo dia civil no fuso da loja) */
  isLastDay: boolean;
  /** horas restantes até o fim, quando houver data de término */
  hoursLeft: number | null;
  message: string | null;
  endsAt: Date | null;
}

export function getPromotionState(p: PromotionInput, now = new Date(), timeZone = "Europe/London"): PromotionState {
  const start = p.promotion_start_at ? new Date(p.promotion_start_at) : null;
  const end = p.promotion_end_at ? new Date(p.promotion_end_at) : null;
  let active = Boolean(p.promotion_active);
  if (active && start && !Number.isNaN(start.getTime()) && now < start) active = false;
  if (active && end && !Number.isNaN(end.getTime()) && now > end) active = false;

  let isLastDay = false;
  let hoursLeft: number | null = null;
  if (active && end && !Number.isNaN(end.getTime())) {
    hoursLeft = Math.max(0, (end.getTime() - now.getTime()) / 36e5);
    isLastDay = dayKey(end, timeZone) === dayKey(now, timeZone);
  }
  return { active, isLastDay, hoursLeft, message: active ? p.promotion_message?.trim() || null : null, endsAt: active ? end : null };
}

function dayKey(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
