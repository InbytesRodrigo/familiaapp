# FamíliaApp — Agenda Familiar

Aplicativo de organização familiar com **agenda de compromissos**, **lista de mercado** com controle de gastos e **configurações de avisos** (WhatsApp via Evolution API e Push Notifications nativas).

## 🚀 Como rodar

Pré-requisito: Node.js 18+ e npm.

```bash
# 1. Instalar as dependências
npm install

# 2. Rodar em modo desenvolvimento (http://localhost:5173)
npm run dev

# 3. Build de produção (gera a pasta dist/)
npm run build

# 4. Conferir tipos sem gerar build
npm run typecheck
```

## 📁 Estrutura do projeto

```
├── index.html                    # HTML raiz
├── package.json                  # Scripts e dependências
├── tailwind.config.js            # Configuração do Tailwind (plugin de animações)
├── vite.config.ts                # Configuração do Vite
├── tsconfig.json                 # Configuração do TypeScript
└── src/
    ├── main.tsx                  # Ponto de entrada do React
    ├── index.css                 # CSS global (Tailwind + custom-scrollbar)
    ├── App.tsx                   # Estado global, navegação e envio de avisos
    ├── types.ts                  # Tipos TypeScript do domínio
    ├── utils.ts                  # Funções utilitárias (capitalize, isToday)
    ├── data/
    │   └── initialData.ts        # Dados iniciais de exemplo (usuários, eventos, mercado)
    └── components/
        ├── Modal.tsx             # Modal reutilizável
        ├── CalendarListView.tsx  # Agenda em lista
        ├── CalendarGridView.tsx  # Agenda em grade mensal
        ├── ShoppingView.tsx      # Lista de mercado
        └── SettingsView.tsx      # Configurações (família, WhatsApp, Push)
```

## ⚙️ Funcionalidades

### Agenda
- Visualização em **lista** (agrupada por data) ou em **grade mensal** (com hora + título de cada compromisso visíveis em cada célula).
- Criar compromissos com título, data, horário e membro responsável.
- Cada compromisso é colorido pela cor do membro da família.

### Mobile (estilo app nativo)
- Barra de **navegação inferior** fixa (Agenda / Mercado / Configurações), como um app de celular.
- Troca de usuário tocando no **avatar no topo** (abre um bottom sheet com foto, cor e papel de cada membro).
- Suporte a telas com notch (safe-area) e botão flutuante posicionado acima da barra inferior.

### Mercado
- Adicionar itens com quantidade e preço estimado.
- **Data opcional** por item (ex.: item que precisa para um dia específico) — aparece na lista e gera lembrete no dia.
- Resumo de **"A Comprar"** e **"Gasto Realizado"** (itens marcados como comprados).
- Histórico de compras com opção de reativar itens.

### Configurações
- **Família**: adicionar/remover/editar membros com nome, papel, **cor de identificação personalizada** e **foto de perfil** (upload de imagem, com fallback para emoji). A cor e a foto são refletidas em todo o app na hora.
- **Evolution API (WhatsApp)**: configure URL da API, instância, API Key e número de destino para enviar avisos reais.
- **Push Notifications**: habilite alertas nativos com um toque ("Ativar push neste aparelho") — o app assina no servidor e salva no banco; cada mudança na agenda/mercado notifica todos os aparelhos, mesmo com o app fechado ou com o PWA instalado.
- **Métodos de lembrete (admin)**: em Configurações → Push, configure **quando e quantas vezes** avisar (15 min, 1 h, 2 h, 6 h, 1 dia, 2 dias antes… cada linha = um aviso). Vale para todos os compromissos e itens do mercado com data — o servidor (cron a cada minuto) dispara o push no horário certo em qualquer aparelho.
- **Central de avisos**: o sino no topo mostra avisos da família com **lido/não lido** — a foto do remetente **pulsa** quando o aviso não foi lido, e dá para marcar como lida (aparece "Lida" para todos).

> 💾 **Dados**: o app salva tudo no **Supabase** (tabelas `familia`, `compromissos`, `mercado` e `push_subscriptions`) — agenda, mercado e família ficam salvos e sincronizam entre dispositivos. Os dados de exemplo estão em `src/data/initialData.ts` e são semeados na primeira abertura.

## 📱 PWA e notificações push

O app é um **PWA**: instale na tela inicial do celular (Android: menu do navegador → "Adicionar à tela inicial"; iOS: Compartilhar → "Adicionar à Tela de Início") para abrir em tela cheia, com ícone próprio e suporte offline. Os arquivos ficam em `public/` (`manifest.webmanifest`, `sw.js` e `icons/`).

- **Service worker** (`public/sw.js`): registrado em `src/main.tsx`, cuida do cache offline, do clique em notificações e do recebimento de push.
- **Lembretes agendados**: em Configurações → Push, escolha quando lembrar dos compromissos. Os lembretes são agendados no service worker e disparam mesmo com o app fechado (navegadores com suporte a Notification Triggers).
- **Push de servidor (Web Push) — funciona com o app fechado e no PWA instalado**: ao tocar em "Ativar push neste aparelho" (Configurações → Push), o app pede permissão, busca a chave pública VAPID na Edge Function do Supabase, assina e salva a assinatura na tabela `push_subscriptions`. A partir daí, qualquer mudança na agenda/mercado envia uma notificação para **todos os aparelhos da família** (mesmo com o app fechado — Android/iOS instalado/desktop). O envio acontece pela Edge Function `supabase/functions/send-push` (Web Push com VAPID).
- **Edge Function de push** (`supabase/functions/send-push`): `GET` devolve a chave pública VAPID; `POST` envia a mensagem para todas as assinaturas salvas e remove sozinha as assinaturas de aparelhos desinstalados. Secrets usados: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. As chaves são geradas com `node scripts/generate-vapid.mjs`.
- **Ícones**: gere novamente com `node scripts/generate-icons.mjs` (PNGs sem dependências externas).

## 🔔 Integrações de avisos

Quando um evento/item é criado, o app dispara o fluxo de avisos:

1. **Toast** interno sempre exibido.
2. **Push nativo** se a permissão foi concedida.
3. **WhatsApp** via Evolution API se todas as credenciais estiverem preenchidas.

O envio real via `fetch` está **desativado (comentado)** por padrão por causa de bloqueios CORS. Para enviar mensagens de verdade, descomente o bloco `CÓDIGO DE PRODUÇÃO` em `src/App.tsx` (ou configure um proxy CORS).
