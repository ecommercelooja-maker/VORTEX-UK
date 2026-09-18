import Link from "next/link";
import type { ReactNode } from "react";
import { overviewData } from "@/lib/crm/overview";
import { Badge, Notice, fmtDate, fmtMoney } from "../ui";
import ActionButton from "../action-button";
import AutoRefresh from "./auto-refresh";
import { reprocessWebhookAction, runAutomationsNowAction, runCartsNowAction } from "../actions";
import { isEmailConfigured } from "@/lib/crm/providers/email";
import { isWhatsAppConfigured, whatsappMissing, whatsappPhoneNumber, whatsappTemplatesMissing } from "@/lib/crm/providers/whatsapp";
import { getStoreSettings } from "@/lib/crm/settings";
import { getPromotionState } from "@/lib/crm/promotion";
import { SITE_URL } from "@/lib/site";
import { AI_MODEL, isAiConfigured } from "@/lib/crm/ai";
import { STORE_NAME } from "@/lib/crm/config";

export const dynamic = "force-dynamic";

// Paleta dos gráficos (mesma da aba Ao vivo: azul aprovado / laranja recusado, validada para daltonismo)
const C_PAID = "#2563eb";
const C_REFUSED = "#f97316";

const WA_SHORT: Record<string, string> = { "WHATSAPP_PROVIDER=meta": "WHATSAPP_PROVIDER=meta", WHATSAPP_ACCESS_TOKEN: "token", WHATSAPP_PHONE_NUMBER_ID: "Phone number ID" };
function whatsappHint(): string {
  const number = whatsappPhoneNumber();
  if (!isWhatsAppConfigured()) return `${number ? number + " · " : ""}falta ${whatsappMissing().map((m) => WA_SHORT[m] ?? m).join(" e ")}`;
  const tpl = whatsappTemplatesMissing();
  return `${number ?? "configurado"}${tpl.length ? ` · ${tpl.length} template(s) pendente(s)` : " · templates OK"}`;
}

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} %`;
}
function delta(cur: number, prev: number): { text: string; up: boolean | null } | null {
  if (!prev && !cur) return null;
  if (!prev) return { text: "novo", up: null };
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return { text: "igual a ontem", up: null };
  return { text: `${d > 0 ? "▲" : "▼"} ${Math.abs(d)} % vs ontem`, up: d > 0 };
}
function londonNow(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "Europe/London", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date());
}
function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hour12: false }).format(new Date()));
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}
const TYPE_LABEL: Record<string, string> = {
  abandoned_cart: "Carrinho abandonado",
  purchase_confirmation: "Confirmação de compra",
  promotion_reminder: "Lembrete de promoção",
  tracking_notification: "Rastreio",
  manual_followup: "Manual / I.A.",
};
const WEBHOOK_LABEL: Record<string, { label: string; tone: "green" | "red" | "yellow" | "gray" | "blue" }> = {
  PAYMENT_PAID: { label: "pagos", tone: "green" },
  PAYMENT_REFUSED: { label: "recusados", tone: "red" },
  PAYMENT_PENDING: { label: "pendentes", tone: "yellow" },
  CHECKOUT_ABANDONED: { label: "abandonos", tone: "gray" },
  CHARGEBACK: { label: "chargebacks", tone: "red" },
  TRACKING_FOUND: { label: "rastreios", tone: "blue" },
};

export default async function OverviewPage() {
  const [data, settings] = await Promise.all([overviewData(), getStoreSettings()]);
  const { live, funnel7d, traffic7d, carts, automations, customers, webhooks, orders } = data;
  const P = live.periods;
  const promo = getPromotionState(settings);
  const cur = live.currency;

  const checks = [
    { label: "Supabase", ok: true, hint: "conectado" },
    { label: "E-mail (Resend)", ok: isEmailConfigured(), hint: isEmailConfigured() ? "configurado" : "defina RESEND_API_KEY e EMAIL_FROM" },
    { label: "WhatsApp (Meta)", ok: isWhatsAppConfigured(), hint: whatsappHint() },
    { label: "Webhook Umpi", ok: Boolean(process.env.WEBHOOK_SECRET), hint: process.env.WEBHOOK_SECRET ? `${SITE_URL.replace(/^https?:\/\//, "")}/api/webhooks/umpi` : "defina WEBHOOK_SECRET" },
    { label: "Cron", ok: Boolean(process.env.CRON_SECRET), hint: process.env.CRON_SECRET ? "a cada 10 min via tráfego + 1×/dia Vercel" : "defina CRON_SECRET" },
    { label: "Assistente I.A. (Claude)", ok: isAiConfigured(), hint: isAiConfigured() ? `modelo ${AI_MODEL}` : "defina ANTHROPIC_API_KEY" },
  ];

  // "O que fazer agora": pendências concretas com link
  const todos: { tone: "red" | "amber" | "blue" | "green"; text: ReactNode; href?: string; cta?: string }[] = [];
  if (live.insights.refusedStreak >= 3) todos.push({ tone: "red", text: <>Os últimos <b>{live.insights.refusedStreak}</b> pagamentos foram recusados em sequência. Verifique o antifraude no painel do Umpi.</>, href: "/admin/vendas", cta: "Ver ao vivo" });
  if (orders.paidWithoutTracking) todos.push({ tone: "amber", text: <><b>{orders.paidWithoutTracking}</b> pedido(s) pago(s) ainda sem código de rastreio.</>, href: "/admin/pedidos?s=sem_rastreio", cta: "Adicionar rastreio" });
  if (webhooks.errors) todos.push({ tone: "red", text: <><b>{webhooks.errors}</b> webhook(s) com erro aguardando reprocessamento.</>, href: "#webhooks", cta: "Ver abaixo" });
  if (automations.failed) todos.push({ tone: "amber", text: <><b>{automations.failed}</b> automação(ões) falharam nos últimos 30 dias.</>, href: "/admin/automacoes", cta: "Reprocessar" });
  if (automations.pending) todos.push({ tone: "blue", text: <><b>{automations.pending}</b> automação(ões) na fila para envio.</>, href: "/admin/automacoes", cta: "Ver fila" });
  if (carts.withContactOpen) todos.push({ tone: "blue", text: <><b>{carts.withContactOpen}</b> carrinho(s) abandonado(s) com e-mail ou telefone conhecido, somando {fmtMoney(carts.withContactValue, cur)}.</>, href: "/admin/carrinhos", cta: "Ver carrinhos" });
  if (!isWhatsAppConfigured()) todos.push({ tone: "blue", text: <>WhatsApp ainda não ativado: falta cadastrar o token e o Phone number ID da Meta na Vercel.</> });
  if (!isAiConfigured()) todos.push({ tone: "blue", text: <>Assistente I.A. desativada: falta a chave da Anthropic na Vercel.</> });
  if (!todos.length) todos.push({ tone: "green", text: <>Nada pendente. A loja está rodando sozinha.</> });

  const revenueDelta = delta(P.today.revenue, P.yesterday.revenue);
  const paidDelta = delta(P.today.paid, P.yesterday.paid);
  const maxFunnel = Math.max(1, ...funnel7d.map((s) => s.value));
  const wh24Total = Object.values(webhooks.last24h).reduce((s, n) => s + n, 0);

  return (
    <>
      {/* Cabeçalho */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-black/50">
            {greeting()} · {londonNow()} (Londres)
          </p>
          <h1 className="font-heading text-4xl">Visão geral · {STORE_NAME}</h1>
          <p className="mt-1 text-sm text-black/60">Dados reais desta loja no Supabase. Vendas, funil, carrinhos, automações e integrações em um só lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefresh seconds={60} />
          <ActionButton action={runCartsNowAction} label="Processar carrinhos agora" pendingLabel="Processando…" />
          <ActionButton action={runAutomationsNowAction} label="Enviar automações pendentes" pendingLabel="Enviando…" />
        </div>
      </div>

      {/* Hero: hoje + 30 dias */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="relative overflow-hidden rounded-3xl bg-black p-6 text-white lg:col-span-1">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" aria-hidden />
          <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-white/5" aria-hidden />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Hoje</span>
              <Link href="/admin/vendas" className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20">
                🔴 Ao vivo →
              </Link>
            </div>
            <div className="mt-3 font-heading text-6xl leading-none">{fmtMoney(P.today.revenue, cur)}</div>
            <div className={`mt-2 text-sm ${revenueDelta?.up === true ? "text-green-400" : revenueDelta?.up === false ? "text-red-300" : "text-white/60"}`}>{revenueDelta?.text ?? "sem vendas ontem nem hoje"}</div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <HeroStat label="Aprovados" value={P.today.paid} sub={paidDelta?.text} />
              <HeroStat label="Recusados" value={P.today.refused} sub={P.today.pending ? `${P.today.pending} pendente(s)` : undefined} />
              <HeroStat label="Aprovação" value={pct(P.today.rate)} sub={`geral ${pct(P.all.rate)}`} />
            </div>
            <div className="mt-4 text-xs text-white/50">
              Última venda {relative(live.insights.lastPaidAt)} · ticket médio {P.today.avgTicket ? fmtMoney(P.today.avgTicket, cur) : "—"}
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          <Kpi label="Receita · 30 dias" value={fmtMoney(P.month.revenue, cur)} sub={`${P.month.paid} pedido(s) pago(s) · ticket médio ${P.month.avgTicket ? fmtMoney(P.month.avgTicket, cur) : "—"}`}>
            <Sparkline values={live.days.map((d) => d.revenue)} color={C_PAID} />
          </Kpi>
          <Kpi label="Taxa de aprovação · 30 dias" value={pct(P.month.rate)} sub={`${P.month.paid} aprovados · ${P.month.refused} recusados · 7 dias ${pct(P.week.rate)}`} tone={P.month.rate === null ? "" : P.month.rate >= 50 ? "text-green-700" : "text-red-700"}>
            <Bars values={live.days.map((d) => [d.paid, d.refused])} colors={[C_PAID, C_REFUSED]} />
          </Kpi>
          <Kpi label="Carrinhos · 7 dias" value={`${carts.recovered7d} / ${carts.abandoned7d}`} sub={`recuperados / abandonados · taxa ${pct(carts.recoveryRate7d)} · ${fmtMoney(carts.openValue, cur)} em aberto (${carts.withContactOpen} com contato)`}>
            <Meter value={carts.recoveryRate7d ?? 0} color={C_PAID} />
          </Kpi>
          <Kpi label="Automações · 7 dias" value={automations.sent7d} sub={`${automations.sent30d} em 30 d · ${automations.failed} falha(s) · ${automations.pending} na fila · última ${relative(automations.lastSentAt)}`}>
            <TypeBars byType={automations.byType7d} />
          </Kpi>
        </div>
      </div>

      {/* Funil + O que fazer agora + Clientes */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Funil · 7 dias" subtitle="do checkout até o pagamento">
          <ol className="flex flex-col gap-2.5">
            {funnel7d.map((s, i) => (
              <li key={s.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={i === funnel7d.length - 1 ? "font-semibold" : "text-black/80"}>{s.label}</span>
                  <span className="text-xs text-black/50">
                    <b className="text-sm text-black">{s.value.toLocaleString("pt-BR")}</b>
                    {s.fromPrev !== null && <span className="ml-2">{pct(s.fromPrev)} do anterior</span>}
                  </span>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-black/5">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, (s.value / maxFunnel) * 100)}%`, background: s.key === "paid" ? C_PAID : "#94a3b8" }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px] leading-relaxed text-black/45">
            No site: {traffic7d.pageViews.toLocaleString("pt-BR")} páginas vistas · {traffic7d.productViews.toLocaleString("pt-BR")} vezes o produto · {traffic7d.addToCart.toLocaleString("pt-BR")} cliques em comprar · {traffic7d.contacts} contato(s) capturado(s). No Umpi: {traffic7d.abandonEvents.toLocaleString("pt-BR")} avisos de abandono (um carrinho pode gerar vários). Visitas só contam para quem aceitou cookies; cliques e checkouts contam sempre.
          </p>
        </Panel>

        <Panel title="O que fazer agora" subtitle={`${todos.length} item(ns)`}>
          <ul className="flex flex-col gap-2">
            {todos.map((t, i) => (
              <li key={i} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${TODO_TONE[t.tone]}`}>
                <span className="mt-0.5 shrink-0" aria-hidden>
                  {t.tone === "red" ? "🚨" : t.tone === "amber" ? "⚠️" : t.tone === "green" ? "✅" : "💡"}
                </span>
                <span className="flex-1 leading-snug">{t.text}</span>
                {t.href && (
                  <Link href={t.href} className="shrink-0 rounded-full bg-black px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-black/80">
                    {t.cta}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Clientes" subtitle={`${customers.total} no total`}>
          <div className="grid grid-cols-2 gap-3">
            <Mini label="Novos · 7 dias" value={customers.new7d} />
            <Mini label="Com telefone" value={customers.withPhone} sub={customers.total ? `${Math.round((customers.withPhone / customers.total) * 100)} %` : undefined} />
            <Mini label="Opt-in e-mail" value={customers.emailOptIn} />
            <Mini label="Opt-in WhatsApp" value={customers.whatsappOptIn} />
          </div>
          <div className="mt-4 rounded-xl bg-surface p-3 text-xs text-black/60">
            <div className="flex items-center justify-between">
              <span>Promoção</span>
              <Badge tone={promo.active ? (promo.isLastDay ? "yellow" : "green") : "gray"}>{promo.active ? (promo.isLastDay ? "Último dia" : "Ativa") : "Inativa"}</Badge>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Timeout de abandono</span>
              <b className="text-black">{settings.abandoned_cart_timeout_minutes} min</b>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Pedidos em trânsito</span>
              <b className="text-black">{orders.shipped}</b>
            </div>
            <Link href="/admin/configuracoes" className="mt-2 inline-block underline underline-offset-2">
              Configurações →
            </Link>
          </div>
        </Panel>
      </div>

      {/* Integrações + Webhooks */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Integrações" subtitle={`${checks.filter((c) => c.ok).length} de ${checks.length} ativas`} className="lg:col-span-2">
          <ul className="flex flex-col divide-y divide-black/5">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2.5">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.ok ? "bg-green-500" : "bg-amber-400"}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{c.label}</div>
                  <div className="truncate text-xs text-black/50" title={c.hint}>
                    {c.hint}
                  </div>
                </div>
                <Badge tone={c.ok ? "green" : "yellow"}>{c.ok ? "OK" : "Pendente"}</Badge>
              </li>
            ))}
          </ul>
          {!isEmailConfigured() && (
            <div className="mt-3">
              <Notice tone="warn">Sem provedor de e-mail, as automações são registradas como &quot;Falhou&quot; com o motivo. Configure e use &quot;Reprocessar&quot; em Automações.</Notice>
            </div>
          )}
        </Panel>

        <Panel
          title="Webhooks do Umpi"
          subtitle={webhooks.lastAt ? `último ${relative(webhooks.lastAt)}` : "nenhum ainda"}
          className="lg:col-span-3"
          id="webhooks"
          actions={
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(webhooks.last24h)
                .sort((a, b) => b[1] - a[1])
                .map(([k, n]) => {
                  const m = WEBHOOK_LABEL[k] ?? { label: k.toLowerCase(), tone: "gray" as const };
                  return (
                    <Badge key={k} tone={m.tone}>
                      {n} {m.label}
                    </Badge>
                  );
                })}
              <span className="self-center text-[11px] text-black/40">{wh24Total} nas últimas 24 h</span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-black/50">
                <tr>
                  <th className="py-1.5 pr-3 font-semibold">Recebido</th>
                  <th className="py-1.5 pr-3 font-semibold">Evento</th>
                  <th className="py-1.5 pr-3 font-semibold">Status</th>
                  <th className="py-1.5 font-semibold">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {webhooks.recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-black/50">
                      Nenhum webhook recebido ainda. Cadastre a URL do webhook no painel do Umpi.
                    </td>
                  </tr>
                ) : (
                  webhooks.recent.map((w) => {
                    const m = WEBHOOK_LABEL[(w.event_type ?? "").toUpperCase()];
                    return (
                      <tr key={w.id}>
                        <td className="whitespace-nowrap py-2 pr-3 text-black/70">{fmtDate(w.received_at)}</td>
                        <td className="py-2 pr-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${m?.tone === "green" ? "bg-green-500" : m?.tone === "red" ? "bg-red-500" : m?.tone === "yellow" ? "bg-amber-400" : "bg-black/30"}`} aria-hidden />
                            <span className="font-medium">{w.event_type ?? "—"}</span>
                          </span>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge tone={w.status === "processed" ? "green" : w.status === "error" ? "red" : "gray"}>{w.status}</Badge>
                        </td>
                        <td className="py-2 text-xs text-black/60">
                          {w.error_message ?? (w.order_id ? <Link href={`/admin/pedidos/${w.order_id}`} className="underline">ver pedido</Link> : "—")}
                          {(w.status === "received" || w.status === "error") && (
                            <div className="mt-1">
                              <ActionButton action={reprocessWebhookAction.bind(null, w.id)} label="Reprocessar" pendingLabel="…" />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Peças visuais (server components)
// ---------------------------------------------------------------------------
const TODO_TONE = {
  red: "border-red-200 bg-red-50 text-red-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  green: "border-green-200 bg-green-50 text-green-900",
};

function relative(iso: string | null): string {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

function HeroStat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="mt-0.5 text-2xl font-bold leading-none">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-white/50">{sub}</div>}
    </div>
  );
}

function Kpi({ label, value, sub, tone = "", children }: { label: string; value: string | number; sub?: string; tone?: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col justify-between rounded-3xl border border-black/10 bg-white p-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-black/50">{label}</div>
        <div className={`mt-1 text-3xl font-bold leading-tight ${tone}`}>{value}</div>
        {sub && <div className="mt-1 text-xs text-black/50">{sub}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function Panel({ title, subtitle, children, className = "", id, actions }: { title: string; subtitle?: string; children: ReactNode; className?: string; id?: string; actions?: ReactNode }) {
  return (
    <section id={id} className={`rounded-3xl border border-black/10 bg-white p-5 ${className}`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-2xl">{title}</h2>
        {subtitle && <span className="text-xs text-black/50">{subtitle}</span>}
      </div>
      {actions && <div className="mb-3">{actions}</div>}
      {children}
    </section>
  );
}

function Mini({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/50">{label}</div>
      <div className="mt-0.5 text-xl font-bold">
        {value} {sub && <span className="text-xs font-normal text-black/40">{sub}</span>}
      </div>
    </div>
  );
}

/** Linha de tendência (14 pontos) com área suave; sem eixos — o número grande é o valor. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 300;
  const h = 44;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 4 - (v / max) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" aria-label="tendência de 14 dias">
      <path d={`${d} L${w},${h} L0,${h} Z`} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last[0]} cy={last[1]} r={4} fill={color} stroke="#fff" strokeWidth={2} />}
    </svg>
  );
}

/** Barras lado a lado (aprovados/recusados) por dia, 14 dias, sem eixos. */
function Bars({ values, colors }: { values: number[][]; colors: string[] }) {
  const w = 300;
  const h = 44;
  const max = Math.max(1, ...values.flat());
  const slot = w / values.length;
  const bw = Math.max(2, (slot - 4) / colors.length - 1);
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" aria-label="aprovados e recusados por dia">
        {values.map((vs, i) =>
          vs.map((v, si) => {
            const bh = (v / max) * (h - 4);
            return <rect key={`${i}-${si}`} x={i * slot + 2 + si * (bw + 1)} y={h - bh} width={bw} height={bh} fill={colors[si]} rx={1} />;
          }),
        )}
      </svg>
      <div className="mt-1 flex gap-3 text-[10px] text-black/45">
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm" style={{ background: colors[0] }} /> aprovados
        </span>
        <span className="flex items-center gap-1">
          <i className="inline-block h-2 w-2 rounded-sm" style={{ background: colors[1] }} /> recusados
        </span>
      </div>
    </div>
  );
}

function Meter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}

function TypeBars({ byType }: { byType: { type: string; sent: number; failed: number }[] }) {
  if (!byType.length) return <div className="text-xs text-black/40">Nenhuma automação nos últimos 7 dias.</div>;
  const max = Math.max(1, ...byType.map((t) => t.sent + t.failed));
  return (
    <ul className="flex flex-col gap-1.5">
      {byType.slice(0, 4).map((t) => (
        <li key={t.type} className="flex items-center gap-2 text-[11px]">
          <span className="w-32 shrink-0 truncate text-black/60">{TYPE_LABEL[t.type] ?? t.type}</span>
          <span className="flex h-2 flex-1 gap-[2px] overflow-hidden rounded-full bg-black/5">
            <i className="h-full" style={{ width: `${(t.sent / max) * 100}%`, background: C_PAID }} />
            <i className="h-full" style={{ width: `${(t.failed / max) * 100}%`, background: C_REFUSED }} />
          </span>
          <span className="w-14 shrink-0 text-right text-black/60">
            {t.sent}
            {t.failed ? <span className="text-red-700"> · {t.failed}✕</span> : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
