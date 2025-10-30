# Design do Sistema Web - Registro de Ligações

## Arquitetura Geral

### Stack Tecnológica:
- **Backend:** Node.js v22.19.0 + Express.js v5.1.0
- **Banco de Dados:** PostgreSQL (pg Pool compartilhado)
- **Frontend:** HTML5 + CSS3 + JavaScript (Vanilla) + Chart.js
- **Gerenciamento:** PM2 v6.0.10
- **Hospedagem:** AWS EC2 (Ubuntu 22.04.5 LTS)

## Estrutura do Banco de Dados

### Tabela: `messages` (PostgreSQL)
```sql
CREATE TABLE IF NOT EXISTS messages (
  id            BIGSERIAL PRIMARY KEY,
  call_date     DATE,
  call_time     TEXT,
  recipient     TEXT NOT NULL,
  sender_name   TEXT NOT NULL,
  sender_phone  TEXT,
  sender_email  TEXT,
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  callback_at TIMESTAMPTZ,
  callback_time TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC);
```sql
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_ligacao DATE NOT NULL,
    hora_ligacao TIME NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    remetente_nome VARCHAR(255) NOT NULL,
    remetente_telefone VARCHAR(20),
    remetente_email VARCHAR(255),
    horario_retorno VARCHAR(100),
    assunto TEXT NOT NULL,
    situacao ENUM('pendente', 'em_andamento', 'resolvido') DEFAULT 'pendente',
    observacoes TEXT,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Índices para Performance:
```sql
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
```sql
CREATE INDEX idx_data_ligacao ON messages(data_ligacao);
CREATE INDEX idx_destinatario ON messages(destinatario);
CREATE INDEX idx_situacao ON messages(situacao);
CREATE INDEX idx_remetente_nome ON messages(remetente_nome);
CREATE INDEX idx_created_at ON messages(created_at);
```

## API Endpoints

### 1. Gestão de Mensagens
- `GET /api/messages` - Listar todos os messages (com filtros)
- `GET /api/messages/:id` - Obter recado específico
- `POST /api/messages` - Criar novo recado
- `PUT /api/messages/:id` - Atualizar recado
- `DELETE /api/messages/:id` - Excluir recado

### 2. Filtros e Consultas
- `GET /api/messages?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD`
- `GET /api/messages?destinatario=nome`
- `GET /api/messages?situacao=pendente|em_andamento|resolvido`
- `GET /api/messages?remetente=nome`

### 3. Estatísticas
- `GET /api/stats` - Estatísticas gerais
- `GET /api/stats/por-destinatario` - Mensagens por destinatário
- `GET /api/stats/por-situacao` - Distribuição por situação

## Interface do Usuário

### 1. Página Principal (Dashboard)
- **Header:** Título do sistema + navegação
- **Cards de Estatísticas:**
  - Total de messages
  - Pendentes
  - Em andamento
  - Resolvidos hoje
- **Ações Rápidas:**
  - Botão "Novo Contato"
  - Filtros rápidos
- **Lista de Mensagens Recentes**

### 2. Formulário de Novo Contato
- **Campos Obrigatórios:**
  - Data da ligação (auto-preenchida com hoje)
  - Hora da ligação (auto-preenchida com agora)
  - Destinatário (dropdown + campo livre)
  - Nome do remetente
  - Assunto
- **Campos Opcionais:**
  - Telefone do remetente
  - E-mail do remetente
  - Horário para retorno
  - Observações
- **Validações em tempo real**
- **Botões:** Salvar, Cancelar

### 3. Lista de Mensagens
- **Filtros:**
  - Por data (período)
  - Por destinatário
  - Por situação
  - Por remetente
- **Tabela Responsiva:**
  - Data/Hora
  - Destinatário
  - Remetente
  - Assunto (truncado)
  - Situação (badge colorido)
  - Ações (visualizar, editar, excluir)
- **Paginação**
- **Ordenação por colunas**

### 4. Visualização de Contato
- **Modal ou página dedicada**
- **Todos os dados do recado**
- **Histórico de alterações**
- **Botões de ação:**
  - Editar
  - Alterar situação
  - Excluir
  - Imprimir

## Design Visual

### 1. Paleta de Cores
- **Primária:** #2563eb (azul)
- **Secundária:** #64748b (cinza)
- **Sucesso:** #10b981 (verde)
- **Aviso:** #f59e0b (amarelo)
- **Erro:** #ef4444 (vermelho)
- **Fundo:** #f8fafc (cinza claro)

### 2. Tipografia
- **Fonte Principal:** Inter ou system fonts
- **Tamanhos:** 12px, 14px, 16px, 18px, 24px, 32px

### 3. Componentes
- **Cards:** Sombra sutil, bordas arredondadas
- **Botões:** Estados hover/active, loading
- **Formulários:** Labels flutuantes, validação visual
- **Tabelas:** Zebra striping, hover rows
- **Modais:** Backdrop blur, animações suaves

### 4. Responsividade
- **Mobile First:** Design otimizado para mobile
- **Breakpoints:** 640px, 768px, 1024px, 1280px
- **Navegação:** Menu hambúrguer em mobile
- **Tabelas:** Scroll horizontal ou cards em mobile

## Funcionalidades Especiais

### 1. Notificações
- **Toast notifications** para ações
- **Confirmações** para exclusões
- **Feedback visual** para salvamentos

### 2. Busca Inteligente
- **Busca em tempo real**
- **Múltiplos campos**
- **Highlight dos resultados**

### 3. Exportação
- **PDF:** Lista filtrada
- **Excel:** Dados completos
- **Impressão:** Formatação otimizada

### 4. Backup e Segurança
- **Backup automático** com `pg_dump`
- **Logs de auditoria**
- **Validação de entrada**

## Estrutura de Arquivos

```
late/
├── server.js              # Servidor principal
├── package.json           # Dependências
├── config/
│   └── database.js        # Configuração do PostgreSQL
├── routes/
│   ├── api.js            # Rotas da API
│   └── web.js            # Rotas web
├── models/
│   └── recado.js         # Model do recado
├── middleware/
│   ├── cors.js           # CORS
│   └── validation.js     # Validações
├── public/
│   ├── css/
│   │   └── style.css     # Estilos
│   ├── js/
│   │   ├── app.js        # JavaScript principal
│   │   └── components/   # Componentes JS
│   └── assets/           # Imagens, ícones
└── views/
    ├── index.html        # Página principal
    ├── messages.html      # Lista de messages
    └── components/       # Componentes HTML
```
