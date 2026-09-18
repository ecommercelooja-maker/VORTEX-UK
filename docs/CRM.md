# CRM / e-commerce — VORTEX UK (`STORE_ID=vortex_uk`)

Sistema de clientes, pedidos, carrinhos abandonados, automações e rastreio integrado ao Supabase.
Esta loja é uma das 3; todas as tabelas têm `store_id`, e o dashboard central lerá o mesmo banco.

## 1. Banco (Supabase — projeto único para as 3 lojas)

1. Supabase → SQL Editor → cole e execute `supabase/migrations/20260911120000_crm.sql` (idempotente).
2. Tabelas: `stores`, `store_settings`, `customers`, `orders`, `abandoned_carts`, `customer_events`,
   `automation_events`, `webhook_events`; view `customer_overview`; RPCs `crm_apply_paid_order` e
   `crm_recalculate_customer_totals`.
3. RLS está ligado em tudo e **não há policies** para `anon`/`authenticated`: só o servidor (service_role) acessa.
   A service_role key fica **apenas** em `SUPABASE_SERVICE_ROLE_KEY` (nunca em `NEXT_PUBLIC_*`).
4. A linha da loja em `stores` é criada automaticamente na primeira requisição (`ensureStore`).

## 2. Variáveis de ambiente

Copie `.env.example` → `.env.local` (local) e cadastre as mesmas na Vercel (Production).

| Variável | Uso |
| --- | --- |
| `STORE_ID`, `STORE_NAME`, `STORE_LOCALE`, `STORE_CURRENCY`, `DEFAULT_PHONE_COUNTRY` | identidade da loja (idioma dos e-mails = locale) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | banco (servidor) |
| `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` | login do dashboard `/admin` |
| `WEBHOOK_SECRET` | token exigido na URL do webhook do Umpi |
| `CRON_SECRET` | autoriza os crons (`Authorization: Bearer`) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | e-mails transacionais/recuperação |
| `CHECKOUT_AMOUNTS_IN_CENTS` | `true` se o Umpi envia 8490 para € 84,90 |
| `ABANDONED_CART_TIMEOUT_MINUTES`, `AUTOMATION_DEDUPE_HOURS`, `CART_EXPIRE_DAYS`, `PROMOTION_*` | fallbacks; editáveis em `/admin/configuracoes` |

## 3. Webhook do Umpi

No painel do Umpi cadastre, para os eventos CHECKOUT_ABANDONED, PAYMENT_PENDING, PAYMENT_PAID,
PAYMENT_REFUSED, CHARGEBACK e TRACKING_FOUND, a URL:

```
https://vortexemobility.com/api/webhooks/umpi?token=<WEBHOOK_SECRET>
```

- Todo payload é salvo bruto em `webhook_events` (idempotente por hash; reenvios idênticos são ignorados).
- O adaptador `src/lib/crm/adapters/umpi.ts` extrai cliente, itens, valores, endereço e rastreio de forma
  defensiva (a documentação do Umpi não detalha os campos de cliente). Se algum campo vier em outro caminho,
  veja o payload em Visão geral → Últimos webhooks e acrescente o caminho ao adaptador.
- Fluxo do pagamento confirmado: pedido `paid` → totais do cliente → carrinhos `recovered` → eventos
  `purchase` e `cart_recovered` → automações de recuperação canceladas → confirmação por e-mail.

## 4. Crons

`vercel.json` agenda `/api/cron/abandoned-carts` e `/api/cron/automations` a cada 10 min (a Vercel envia o
`CRON_SECRET` automaticamente). No plano Hobby os crons rodam no máximo 1×/dia: nesse caso use um agendador
externo (ex.: cron-job.org) chamando `GET .../api/cron/abandoned-carts?token=<CRON_SECRET>` a cada 10 min,
ou os botões "Processar agora" na Visão geral. Além disso, `src/lib/crm/maintenance.ts` roda a mesma
manutenção (throttle de 10 min por instância, via `after()`) a cada page view ou webhook recebido.

Regra de abandono: carrinho `active` sem atividade há mais que o timeout → verifica pedido pago, recuperação
e automação já existente → só então `abandoned` + automações (e-mail exige `marketing_email_opt_in`).

## 5. Tracking no site

`src/components/CrmTracker.tsx` (montado no layout) envia para `POST /api/crm/track`:
- `page_view` / `product_view` apenas com consentimento de mesure d'audience (bandeau CNIL);
- `add_to_cart` + `checkout_started` ao clicar em qualquer botão de compra (link do Umpi), com quantidade;
- `contact_captured` pelo formulário de newsletter do rodapé (opt-in de marketing por e-mail).

O navegador nunca recebe chaves do Supabase.

## 6. Dashboard `/admin`

Visão geral · Clientes (lista + timeline) · Carrinhos abandonados (filtros, enviar recuperação, marcar
recuperado) · Pedidos e rastreio (ADICIONAR RASTREIO, REENVIAR RASTREIO, status do pedido e do rastreio) ·
**Visão geral** (`/admin`: dados de `src/lib/crm/overview.ts` — reaproveita `liveSnapshot()` e soma funil de eventos do site,
carrinhos, automações, clientes, webhooks 24 h e pendências; `auto-refresh.tsx` faz `router.refresh()` a cada 60 s) ·
**Carrinhos abandonados** (`/admin/carrinhos`: filtro padrão `com_contato`; `cartStats()` + `listCarts()` enriquecido com
automações (todas, inclusive falhas) e contatos manuais; `carts-table.tsx` cliente com seleção em lote →
`sendRecoveryBulkAction`/`markContactedBulkAction`, ações por linha `sendRecoveryNowAction`/`markContactedAction`/
`markCartRecoveredAction`, link wa.me com `abandonedCartWhatsApp()` no idioma do cliente, linha expansível) ·
**Ao vivo** (`/admin/vendas`: painel de vendas em tempo real — números do dia vs ontem, taxa de aprovação por período
(hoje/ontem/7d/30d/geral), gráficos SVG de 14 dias e por hora, formas de pagamento, insights, funil de carrinhos e lista
enriquecida (país por DDI/TLD, tentativas do dia, recorrente, pagou depois); tudo calculado em memória em
`src/lib/crm/live-orders.ts` a partir de uma consulta única com cache de 3 s — render inicial no servidor +
polling de `/api/admin/live-orders` a cada 5 s pelo componente cliente `live-orders.tsx`; destaque "NOVO" por 90 s,
contador no título da guia, bipe opcional; dados em `src/lib/crm/live-orders.ts`) ·
Automações (reprocessar falhas) · **Mensagens enviadas** (`/admin/mensagens`: e-mail, WhatsApp e SMS; visão por mensagem e por cliente; estatísticas, filtros por canal/tipo/status,
busca e a visualização exata do que o cliente recebeu — o corpo fica em `automation_events.metadata.body_html/body_text`;
registros anteriores a essa mudança são reconstruídos a partir do template atual) · **Assistente I.A.** (chat em pt-BR
que redige e-mails no idioma da loja com os dados reais do cliente; o operador revisa/edita e clica em Enviar — sai
como `manual_followup` pelo mesmo pipeline, com o layout da loja) · Configurações (timeout, anti-duplicidade, promoção).

Assistente de I.A.: `src/lib/crm/ai.ts` (SDK oficial `@anthropic-ai/sdk`, modelo `ANTHROPIC_MODEL` ou `claude-opus-5`,
saída estruturada em JSON). Requer `ANTHROPIC_API_KEY` no servidor; sem ela a aba mostra o aviso e nada mais muda.
A assistente nunca envia sozinha: só `sendAssistantEmailAction` (clique do operador) cria a automação.

## 7. Canais

- E-mail: Resend via API REST. Sem chave, as automações ficam `failed` com o motivo (reprocessáveis).
- WhatsApp: Meta WhatsApp Cloud API em `src/lib/crm/providers/whatsapp.ts` (número da loja em `WHATSAPP_PHONE_NUMBER` — ainda não definido para a UK). Ativo só com `WHATSAPP_PROVIDER=meta`, `WHATSAPP_ACCESS_TOKEN` e `WHATSAPP_PHONE_NUMBER_ID`;
  sem isso nenhuma automação de WhatsApp é criada. Carrinho, confirmação e rastreio são enviados como **templates**
  aprovados na Meta (`WHATSAPP_TEMPLATE_*`; idiomas disponíveis em `WHATSAPP_TEMPLATE_LANGS`, para a UK criar os templates em `en` — cliente de
  outro idioma recebe o primeiro da lista). Template 1 `panier_abandonne`: {{1}} nome, {{2}} resumo da compra (itens · total),
  {{3}} link do checkout. Template 2 `confirmation_commande`: {{1}} nome, {{2}} nº do pedido, {{3}} total,
  {{4}} link do pedido (`orders.checkout_url` do Umpi; fallback: URL do site). Template 3 `suivi_commande`: {{1}} nome,
  {{2}} nº do pedido, {{3}} código de rastreio, {{4}} link (`orders.tracking_url`; fallback: 17track com o código).
  Sem o template do tipo, cai no texto livre,
  que a Meta só aceita na janela de 24 h após a última mensagem do cliente (erro 131047, visível no dashboard).
  Ainda sem webhook de status (entregue/lido) e sem SMS.
- Idioma: `STORE_LOCALE=en-GB` → e-mails em inglês britânico (fr, pt-BR e de disponíveis para clientes de outros países e lojas irmãs).

## 8. Reutilizar nas outras lojas

Copiar `supabase/` (não precisa reexecutar), `src/lib/crm/`, `src/app/api/{crm,webhooks,cron}`,
`src/app/admin/`, `src/proxy.ts`, `src/components/{CrmTracker,NewsletterForm}.tsx`, `vercel.json`, e definir
`STORE_ID` (`vortex_uk`, `vortex_de`), `STORE_LOCALE` (`en-GB`, `de-DE`), `STORE_CURRENCY` e
`DEFAULT_PHONE_COUNTRY`.
