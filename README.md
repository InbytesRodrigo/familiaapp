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
- Resumo de **"A Comprar"** e **"Gasto Realizado"** (itens marcados como comprados).
- Histórico de compras com opção de reativar itens.

### Configurações
- **Família**: adicionar/remover/editar membros com nome, papel, **cor de identificação personalizada** e **foto de perfil** (upload de imagem, com fallback para emoji). A cor e a foto são refletidas em todo o app na hora.
- **Evolution API (WhatsApp)**: configure URL da API, instância, API Key e número de destino para enviar avisos reais.
- **Push Notifications**: habilite alertas nativos do navegador.

> ⚠️ **Nota sobre dados**: atualmente os dados ficam em memória (React state) e são perdidos ao recarregar a página. Os dados de exemplo estão em `src/data/initialData.ts`.

## 🔔 Integrações de avisos

Quando um evento/item é criado, o app dispara o fluxo de avisos:

1. **Toast** interno sempre exibido.
2. **Push nativo** se a permissão foi concedida.
3. **WhatsApp** via Evolution API se todas as credenciais estiverem preenchidas.

O envio real via `fetch` está **desativado (comentado)** por padrão por causa de bloqueios CORS. Para enviar mensagens de verdade, descomente o bloco `CÓDIGO DE PRODUÇÃO` em `src/App.tsx` (ou configure um proxy CORS).
