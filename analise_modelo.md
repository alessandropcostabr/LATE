# Análise do Modelo de Registro de Ligações

## Estrutura Identificada

O arquivo "CadernodeRecados.xlsx" é um modelo estático para registro interno de ligações com a seguinte estrutura:

### Campos Principais:
1. **Data** - Campo para data da ligação (formato: ___/___/___)
2. **Hora** - Horário da ligação
3. **Destinatário** - Pessoa/setor que deve receber a mensagem
4. **Remetente** - Pessoa que ligou
5. **Informações do Remetente:**
   - Telefone
   - E-mail
   - Horário para Retorno
6. **Assunto** - Motivo/assunto da ligação
7. **Situação** - Status do recado (pendente, resolvido, etc.)

### Características do Modelo:
- Formato repetitivo: cada registro ocupa 3 linhas
  - Linha 1: Data, campos principais
  - Linha 2: Telefone do remetente
  - Linha 3: E-mail e horário para retorno
- Modelo impresso para preenchimento manual
- Estrutura simples e funcional para controle interno

## Objetivos da Automatização:

1. **Digitalizar** o processo de registro de ligações
2. **Centralizar** os dados em um sistema web acessível
3. **Facilitar** consulta e gestão dos recados
4. **Melhorar** o controle e acompanhamento das situações
5. **Disponibilizar** acesso remoto via web

## Funcionalidades Necessárias:

### Para o Sistema Web:
1. **Cadastro de Recados:**
   - Formulário com todos os campos identificados
   - Validação de dados
   - Timestamp automático

2. **Listagem e Consulta:**
   - Visualização de todos os recados
   - Filtros por data, destinatário, situação
   - Busca por remetente ou assunto

3. **Gestão de Status:**
   - Atualização da situação dos recados
   - Marcação como resolvido/pendente

4. **Interface Responsiva:**
   - Acesso via desktop e mobile
   - Design simples e intuitivo

### Tecnologias a Utilizar:
- **Backend:** Node.js + Express.js (já disponível)
- **Banco:** SQLite (já disponível)
- **Frontend:** HTML5 + CSS3 + JavaScript vanilla
- **Deploy:** AWS EC2 (já disponível)

