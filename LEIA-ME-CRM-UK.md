# CRM VORTEX UK — estado e checklist

Painel: **https://vortexemobility.com/admin** (senha = `ADMIN_PASSWORD` na Vercel / `.env.local`).
Documentação técnica completa: [docs/CRM.md](docs/CRM.md).

## O que é

Cópia independente do CRM da loja FR (`vortexelectricmobility.com/admin`), adaptada ao Reino Unido:
`STORE_ID=vortex_uk`, GBP, e-mails em inglês, telefones +44, fuso de Londres, transportadoras britânicas.
Usa o **mesmo Supabase** (projeto `vortex-lojas`) e o mesmo Resend da FR; os dados são separados por `store_id`,
então um painel nunca mostra dados da outra loja. Melhorias feitas no CRM FR **não** chegam aqui sozinhas
(são cópias separadas) — precisam ser portadas.

## Estado em 2026-09-19

- [x] Código no GitHub (`ecommercelooja-maker/VORTEX-UK`, branch `main`).
- [x] 15 variáveis de ambiente cadastradas na Vercel (`vortex-uk`, Production).
- [x] Deploy em produção e domínio `vortexemobility.com` apontando para ele.
- [x] Rastreador da página ativo (visitas com consentimento, cliques em comprar, newsletter).
- [x] Webhook no Umpi (loja **Vortex UK** → Webhooks → "VORTEX UK"), 5 eventos, URL
      `https://vortexemobility.com/api/webhooks/umpi?token=<WEBHOOK_SECRET>` — token conferido.
- [ ] Ver o primeiro aviso real do Umpi chegar (Visão geral → "Webhooks do Umpi") e validar o payload.
- [ ] Trocar o e-mail de suporte placeholder (`support@vortexuk.co.uk` em `src/data/company.ts`) — aparece no rodapé dos e-mails.
- [ ] Verificar `vortexemobility.com` no Resend (DNS na Hostinger) e trocar `EMAIL_FROM` para `no-reply@vortexemobility.com`
      (hoje os e-mails saem de `no-reply@vortexelectricmobility.com`).
- [ ] WhatsApp (Meta Cloud API): sem número/token/templates para a UK.

## Deploy

O projeto da Vercel não está ligado ao GitHub; o deploy é manual, a partir desta pasta (Git Bash):

```bash
GIT_DIR=C:/nonexistent-git vercel --prod --yes --archive=tgz --scope ecommercelooja
```

Se o domínio continuar na versão antiga depois de "Ready" (aconteceu em 18/09 durante um incidente da Vercel):

```bash
vercel promote <url-do-deployment> --yes --scope ecommercelooja
```

## Segredos

Ficam só no `.env.local` (fora do git) e na Vercel. Nunca colar `WEBHOOK_SECRET`, chaves do Supabase/Resend ou a
senha do painel em arquivos versionados.
