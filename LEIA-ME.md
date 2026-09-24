# Portal D.C English Classes — Guia de instalação

Este pacote contém o site completo (login, painel do professor e painel do aluno)
já preparado para funcionar com o Supabase (banco de dados + login + arquivos, grátis).

Siga os passos **na ordem**.

---

## PARTE 1 — Criar o projeto no Supabase

1. Acesse **supabase.com** → entre com o GitHub → **New project**.
2. Dê um nome (ex: `dc-english-classes`), crie uma senha de banco de dados (guarde-a) e escolha uma região perto do Brasil.
3. Espere o projeto ser criado (leva ~2 minutos).

### 1.1 Rodar o script SQL
1. No menu lateral, clique em **SQL Editor** → **New query**.
2. Abra o arquivo `supabase-setup.sql` (está nesta pasta), copie **tudo** e cole no editor.
3. Clique em **Run**. Deve aparecer "Success".

### 1.2 Criar a área de arquivos (Storage)
1. No menu lateral, clique em **Storage** → **New bucket**.
2. Nome do bucket: `materiais` (exatamente assim, minúsculo).
3. Deixe **Public bucket** DESMARCADO (precisa ficar privado).
4. Clique em **Create bucket**.

### 1.3 Pegar suas chaves de acesso
1. Menu lateral → **Project Settings** → **API**.
2. Copie o **Project URL** e a chave **anon public**.
3. Abra o arquivo `js/supabaseClient.js` (nesta pasta) e cole os dois valores nos lugares indicados:
   ```js
   const SUPABASE_URL = "COLE_AQUI_A_URL_DO_SEU_PROJETO";
   const SUPABASE_ANON_KEY = "COLE_AQUI_A_CHAVE_ANON_PUBLIC";
   ```

### 1.4 Criar seu próprio login (professor)
1. Menu lateral → **Authentication** → **Users** → **Add user** → **Create new user**.
2. Coloque seu e-mail e uma senha. Marque "Auto Confirm User".
3. Volte no **SQL Editor** e rode este comando (troque pelo seu e-mail):
   ```sql
   update public.profiles set role = 'admin' where email = 'seuemail@exemplo.com';
   ```
   Isso te torna o professor/administrador do sistema.

### 1.5 Criar o login de cada aluno
Sempre que tiver um aluno novo:
1. **Authentication** → **Users** → **Add user** → coloque o e-mail e uma senha (pode ser provisória).
2. Marque "Auto Confirm User".
3. Pronto — ele já aparece no seu painel de professor na próxima vez que você recarregar a página (o sistema cria o perfil dele automaticamente).
4. Avise o aluno o e-mail e a senha para o primeiro acesso.

---

## PARTE 2 — Colocar o site no ar (GitHub + Vercel)

### 2.1 Subir os arquivos para o GitHub
1. Acesse **github.com** → clique no **+** no canto superior → **New repository**.
2. Nome: `portal-dc-english` (ou o que preferir) → **Create repository**.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **todos os arquivos e pastas** desta pasta (`index.html`, `admin.html`, `aluno.html`, `style.css`, `logo.png`, a pasta `js`, etc. — **não precisa subir o `supabase-setup.sql` nem este `LEIA-ME.md`**, mas não tem problema se subir).
5. Clique em **Commit changes**.

### 2.2 Publicar na Vercel
1. Acesse **vercel.com** → **Add New** → **Project**.
2. Escolha o repositório que você acabou de criar (`portal-dc-english`) → **Import**.
3. Não precisa mudar nenhuma configuração → clique em **Deploy**.
4. Em ~30 segundos você recebe um link tipo `portal-dc-english.vercel.app` — esse é o site que você vai compartilhar com os alunos.

---

## Como usar no dia a dia

- **Você (professor):** acessa o link do site, entra com seu e-mail/senha → cai direto no seu painel, onde vê todos os alunos, cadastra aulas e envia os materiais (PPT, PDF, exercícios, relatórios).
- **Aluno:** acessa o mesmo link, entra com o e-mail/senha que você criou pra ele → só vê as aulas dele.

---

## ATUALIZAÇÃO — Área do aluno, Perfil, Financeiro e "Esqueci minha senha"

Se você já tinha o site funcionando e está apenas adicionando essas novas funcionalidades:

### A) Rodar o novo SQL
1. Abra o arquivo `supabase-update-2.sql` (nesta pasta), copie tudo e cole no **SQL Editor** do Supabase → **Run**.

### B) Criar o bucket de fotos de perfil
1. **Storage** → **New bucket** → nome: `avatars` (minúsculo).
2. Desta vez, deixe **Public bucket** MARCADO (diferente do bucket "materiais", que é privado). Fotos de perfil podem ficar públicas.
3. Clique em **Create bucket**.

### C) Configurar o link de "esqueci minha senha"
Para o link do e-mail de recuperação funcionar (em vez de cair em localhost):
1. No Supabase, vá em **Authentication** → **URL Configuration**.
2. Em **Site URL**, coloque o link do seu site na Vercel (ex: `https://portal-dc-english.vercel.app`).
3. Em **Redirect URLs**, adicione: `https://portal-dc-english.vercel.app/**` (troque pelo seu link, mantendo o `/**` no final).
4. Salve.

### D) Subir os novos arquivos
Suba (ou substitua) estes arquivos no GitHub, junto com os que já existiam:
`home.html`, `perfil.html`, `financeiro.html`, `esqueci-senha.html`, `atualizar-senha.html`,
`js/common.js`, `js/perfil.js`, e os atualizados `index.html`, `aluno.html`, `admin.html`, `js/aluno.js`, `js/admin.js`, `js/supabaseClient.js`.

### Como funciona agora
- **Aluno**, ao logar, cai na **Área do aluno** (`home.html`), com 3 atalhos: Perfil, Minhas aulas, Financeiro.
- **Perfil**: o aluno troca a própria foto, nome e senha, e vê (sem poder editar) o link fixo da aula que você configurou para ele.
- **Financeiro**: o aluno só visualiza o dia de pagamento e o valor — quem edita é sempre você, pelo painel de professor.
- **Painel do professor**: ao abrir um aluno, agora você tem caixas para editar a foto/nome dele, o link fixo da aula, os dados financeiros, e um gerador de comando para redefinir a senha dele (veja a explicação de segurança abaixo).

### Por que a senha do aluno não pode ser trocada com um clique
Trocar a senha de **outra pessoa** só é possível usando uma chave secreta do Supabase que nunca deve ficar exposta no site (senão qualquer visitante poderia roubá-la e acessar tudo). Por isso, o painel gera o comando SQL pronto — você só copia e cola no SQL Editor. Se no futuro você quiser um botão que faça isso automaticamente, dá pra construir isso com uma função de backend (Vercel Function) usando essa chave com segurança; é só pedir.

---

## ATUALIZAÇÃO 3 — Notificação por e-mail ao aluno

Agora, ao abrir um aluno no painel do professor, existe um botão **"Enviar e-mail ao aluno"**.
Ao clicar, aparece um pop-up pedindo confirmação — se você confirmar, o aluno recebe um e-mail
com o texto: "Os dados da sua última aula já estão disponíveis no portal!". Nada é enviado
automaticamente; é sempre você quem decide quando avisar.

Isso funciona através do **EmailJS** (gratuito, até 200 e-mails/mês).

### A) Criar conta no EmailJS
1. Acesse **emailjs.com** → **Sign Up** (pode usar Google).

### B) Conectar seu e-mail (de onde os avisos serão enviados)
1. No painel, vá em **Email Services** → **Add New Email Service**.
2. Escolha **Gmail** (ou o provedor que você usa) e siga a autorização (ele vai pedir para você fazer login e permitir o acesso).
3. Depois de conectado, copie o **Service ID** que aparece (algo como `service_abc1234`).

### C) Criar o modelo (template) do e-mail
1. Vá em **Email Templates** → **Create New Template**.
2. No campo **To Email**, coloque: `{{to_email}}`
3. No campo **Subject** (assunto), coloque algo como: `Atualização no Portal — D.C English Classes`
4. No corpo do e-mail (Content), escreva algo como:
   ```
   Olá {{to_name}},

   {{message}}

   Um abraço,
   D.C English Classes
   ```
5. Salve e copie o **Template ID** (algo como `template_xyz789`).

### D) Pegar sua chave pública
1. Vá em **Account** → **General**.
2. Copie a **Public Key**.

### E) Colar as 3 informações no site
Abra o arquivo `js/emailConfig.js` e cole os três valores:
```js
const EMAILJS_PUBLIC_KEY  = "sua_public_key_aqui";
const EMAILJS_SERVICE_ID  = "service_abc1234";
const EMAILJS_TEMPLATE_ID = "template_xyz789";
```

### F) Subir os arquivos atualizados
Suba para o GitHub (substituindo os antigos): `js/emailConfig.js` (novo), `js/admin.js`, `admin.html`.

Pronto — a partir daí, aparece o botão "Enviar e-mail ao aluno" em cada aluno; clicando nele
e confirmando o pop-up, o e-mail é disparado na hora.

---

## ATUALIZAÇÃO 4 — Botão do WhatsApp e envio de material pelo aluno

### A) Botão do WhatsApp
Já está pronto e configurado com seu número. Não precisa fazer nada no Supabase — é só subir os arquivos
HTML atualizados (todos ganharam o botão flutuante no canto inferior direito).

### B) Envio de material pelo aluno
1. Rode o arquivo `supabase-update-3.sql` no SQL Editor do Supabase.
2. Suba os arquivos novos/atualizados no GitHub: `enviar-material.html`, `js/enviarMaterial.js`,
   `js/common.js`, `home.html`, `admin.html`, `js/admin.js`, `style.css`, e todos os `.html` (por causa do botão do WhatsApp).

### Como funciona
- O aluno acessa "Enviar material" no menu, escolhe a data que quer usar o material, anexa um arquivo
  ou cola um link, escreve como pretende usá-lo, e clica em "Avisar ao professor".
- Você recebe um e-mail: *"Aluno [nome] adicionou um material para ser usado na data [data]. Acesse o
  portal para conferir os detalhes."*
- No seu painel, dentro de cada aluno, a aba **"Materiais do aluno"** mostra todos os pedidos enviados
  por ele (com o arquivo pra baixar, o link, e as observações), e você pode excluir depois de já ter usado.

---

## ATUALIZAÇÃO 5 — "Pergunte ao Daniel"

### A) Rodar o novo SQL
1. Copie e cole o conteúdo do arquivo `supabase-update-4.sql` no SQL Editor do Supabase → **Run**.

### B) Ajustar o template do EmailJS (importante!)
Agora os e-mails têm assuntos diferentes dependendo do tipo de aviso (ex: "Nova dúvida de [nome]...",
"Sua pergunta foi respondida..."). Para isso funcionar, o assunto do e-mail precisa vir dinâmico do sistema,
em vez de fixo no template:
1. No painel do EmailJS, vá em **Email Templates** → abra o template que você já criou.
2. No campo **Subject**, apague o texto fixo e coloque: `{{subject}}`
3. Salve.

*(Se você pular esse passo, os e-mails continuam funcionando, só que todos com o mesmo assunto genérico de antes.)*

### C) Subir os arquivos no GitHub
Novos arquivos: `pergunte-ao-daniel.html`, `js/perguntaAoDaniel.js`.
Atualizados: `js/common.js`, `js/emailConfig.js`, `js/admin.js`, `home.html`, e todos os `.html`
(por causa do botão do WhatsApp na nova página).

### Como funciona
- O aluno acessa "Pergunte ao Daniel" no menu, escreve o assunto e a pergunta, e clica em "Enviar pergunta".
- Você recebe um e-mail: *"Nova dúvida de [nome] adicionada ao portal"*.
- A pergunta fica arquivada no menu lateral da própria página do aluno (por assunto), pra ele consultar depois.
- No seu painel, dentro de cada aluno, a nova aba **"Pergunte ao Daniel"** mostra todas as perguntas dele,
  com um campo para você escrever a resposta e o botão **"Responder ao aluno"**.
- Ao responder, o aluno recebe um e-mail avisando que a pergunta foi respondida, e a resposta aparece
  arquivada junto com a pergunta dele no portal.

---

## ATUALIZAÇÃO 6 — Editar/excluir pergunta e minimizar respondidas

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-5.sql` no SQL Editor do Supabase → **Run**.

### B) Subir os arquivos no GitHub
Atualizados: `js/perguntaAoDaniel.js`, `js/admin.js`, `style.css`, `js/emailConfig.js` (já vem com suas
chaves do EmailJS preenchidas, não precisa editar nada nele).

### Como funciona agora
- **Aluno**: enquanto a pergunta não for respondida, aparecem os botões "Editar pergunta" e "Excluir
  pergunta" na tela dela. Ao excluir, você recebe um e-mail avisando. Depois de respondida, esses
  botões somem (não dá mais pra editar/excluir).
- **Professor**: perguntas já respondidas aparecem minimizadas (só o assunto, com a etiqueta "Respondida")
  — clique para expandir. Dentro, dá pra editar a resposta ou excluir a pergunta a qualquer momento,
  sem disparar e-mail nenhum ao aluno nesses dois casos.

---

## ATUALIZAÇÃO 7 — Comunicados para todos os alunos

Não precisa rodar nenhum SQL novo desta vez. Só suba os arquivos atualizados no GitHub:
`js/admin.js` e `style.css`.

### Como funciona
- No painel do professor, agora existe o item **"Comunicados"** no topo do menu lateral (separado da
  lista de alunos).
- Ao clicar, aparece um campo de assunto e uma caixa de mensagem. Ao clicar em "Enviar comunicado a
  todos os alunos", o sistema pede confirmação e depois envia o e-mail, um por um, para todos os
  alunos cadastrados no portal — com o assunto e a mensagem que você escreveu.
- No final, aparece quantos e-mails foram enviados com sucesso (e se algum falhou).

---

## ATUALIZAÇÃO 8 — Remoção do Financeiro / Guias de Gramática (com bloqueio)

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-6.sql` no SQL Editor do Supabase → **Run**.
(Isso remove os campos financeiros do banco e cria as tabelas dos Guias de Gramática.)

### B) Subir os arquivos no GitHub
- **Removido**: `financeiro.html` (pode excluir esse arquivo do seu repositório do GitHub).
- **Novos**: `guias-gramatica.html`, `js/guiasGramatica.js`.
- **Atualizados**: `js/common.js`, `js/admin.js`, `home.html`, `js/aluno.js`, `js/perfil.js`,
  `js/enviarMaterial.js`, `js/perguntaAoDaniel.js`.

### Como funciona
- O Financeiro sumiu de vez — do menu do aluno e do painel do professor.
- No seu painel, agora tem **"Guias de Gramática"** no topo do menu (junto com "Comunicados"),
  onde você:
  - Vê se o conteúdo está **bloqueado** ou **desbloqueado** para os alunos, com botões para trocar.
  - Escolhe o nível (Básico / Intermediário / Avançado) e adiciona materiais, digitando o título
    manualmente e escolhendo o arquivo.
- **Enquanto estiver bloqueado**: os alunos não veem "Guias de Gramática" em lugar nenhum do menu —
  como se a seção não existisse.
- **Quando você desbloquear**: o item aparece no menu de todos os alunos (e um cartão na home).
  Cada aluno escolhe um nível e vê a lista de materiais daquele nível, com botão de baixar.
- Essa trava também funciona no banco de dados (não é só visual) — então mesmo que alguém tente
  acessar por fora, o conteúdo continua bloqueado até você liberar.

## Se quiser mudar alguma coisa depois
Qualquer alteração de design, texto ou funcionalidade, é só me pedir — eu edito os arquivos e te devolvo os atualizados para você subir de novo no GitHub (o site na Vercel se atualiza sozinho sempre que os arquivos do GitHub mudam).

---

## ATUALIZAÇÃO 9 — Vídeo do YouTube nos Guias, upload em lote e ordenação por mais recente

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-7-youtube.sql` no SQL Editor do Supabase → **Run**.
(Adiciona os campos de link do YouTube aos materiais de gramática.)

### B) Subir os arquivos no GitHub
Atualizados: `js/admin.js`, `js/aluno.js`, `js/guiasGramatica.js`.

### Como funciona agora

**1. Link de videoaula (YouTube) nos Guias de Gramática**
- Ao adicionar um material num nível, agora existe um campo opcional para colar o link do YouTube.
- Se você não colocar o link na hora, cada material sem link ganha um botão discreto **"+ Adicionar
  vídeo"**, pra você colar o link depois (ideal para quando gravar as videoaulas na fase 2).
- Assim que um material tem um link salvo, aparecem os botões **"Exibir link"** / **"Ocultar link"** —
  o aluno só vê o botão "Assistir videoaula" quando você clicar em "Exibir link".
- Enquanto não houver link nenhum cadastrado, nenhum botão de vídeo aparece pro aluno — só o material
  escrito normalmente.

**2. Vários materiais de uma vez ao cadastrar aula**
- Na aba "Cadastrar nova aula", a seção de materiais agora abre com **3 conjuntos de campos** (tipo,
  nome, descrição, arquivo) de uma vez.
- Clique em **"+ Adicionar mais"** para liberar mais conjuntos, quantos precisar.
- Um único botão **"Enviar materiais"** sobe todos os arquivos preenchidos de uma vez (linhas vazias
  são ignoradas automaticamente).

**3. Ordem por mais recente primeiro**
- No painel do aluno (Minhas aulas) e no seu painel (Aulas cadastradas), as aulas agora aparecem da
  mais recentemente cadastrada para a mais antiga.
- No painel do aluno, a lista lateral mostra até **10 aulas por página**, com botões "Anterior" /
  "Próxima" quando houver mais que isso.

---

## PDF — Guia para uso do Portal do Aluno
Este PDF (entregue separadamente) explica ao aluno como usar cada página do portal. Ele **não menciona**
os Guias de Gramática (para não criar expectativa antes da hora) e tem a capa com fundo branco e letras
azul-marinho, no estilo da sua marca. Sempre que o portal mudar bastante, posso gerar uma versão atualizada.

---

## ATUALIZAÇÃO 12 — Indicadores de pendência, e-mail com identidade visual, app no celular e busca

### A) Indicadores de pendência (sem SQL novo)
Suba `js/admin.js` no GitHub. Agora:
- **"Pergunte ao Daniel"** no menu mostra uma bolinha laranja com o número de perguntas ainda não respondidas.
- Cada **aluno** na lista lateral mostra uma bolinha laranja com o total de pendências dele (perguntas
  não respondidas + pedidos de material ainda não excluídos). Sem pendências, continua o pontinho azul de sempre.
- Os números se atualizam sozinhos assim que você responde, exclui uma pergunta ou remove um pedido de material.

### B) E-mail com a identidade do portal (e assinatura automática)
1. Abra o arquivo `email-template-emailjs.html` (entregue junto com este pacote — já vem com o link
   `dc-english-classes.vercel.app` preenchido).
2. No painel do EmailJS, vá em **Email Templates** → abra seu template → mude para o modo **"Code Editor"**
   (às vezes aparece como "</> Code" ou um botão de alternância perto do editor visual).
3. Apague o conteúdo atual e cole o conteúdo desse arquivo no lugar.
4. Salve.

A partir daí, todo e-mail do portal (aula nova, pergunta respondida, comunicado, etc.) chega com sua
logo, as cores do portal, um botão "Acessar o portal", e já assinado como:
> Um abraço,<br>**Daniel**<br>D.C English Classes

Não precisa mudar nada no código do site — as variáveis continuam as mesmas, só a aparência do e-mail muda.

### C) Portal instalável no celular (PWA)
Novos arquivos: `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`.
Suba TODOS os arquivos `.html` novamente (todos ganharam as tags necessárias), junto com esses 4 novos arquivos.

Depois disso, ao abrir o portal pelo celular (Chrome no Android, ou Safari no iPhone), vai aparecer a
opção "Adicionar à tela inicial" / "Instalar app". Uma vez instalado, o portal abre em tela cheia, com
ícone próprio, sem a barra de endereço do navegador — com cara de aplicativo de verdade.

### D) Busca em "Minhas aulas"
Suba `js/aluno.js`. Agora, acima da lista de aulas do aluno, tem um campo de busca — digitar parte do
título já filtra a lista na hora (e some com a paginação enquanto estiver buscando, já que o resultado
tende a ser pequeno).

---

## ATUALIZAÇÃO 13 — Anexo e escolha de destinatários nos Comunicados

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-10-anexos-comunicados.sql` no SQL Editor do
Supabase → **Run**.

### B) Subir o arquivo atualizado
Suba `js/admin.js` no GitHub, substituindo o antigo.

### Como funciona agora
- Em **Comunicados**, agora tem um campo para anexar um arquivo (opcional) — ele vira um link de
  download dentro do próprio texto do e-mail.
- Ao lado do formulário, aparece a lista de alunos com uma caixa de seleção ao lado de cada um, e uma
  caixa **"Todos"** no topo — marque ela pra selecionar todo mundo de uma vez, ou escolha só quem
  você quiser.
- O comunicado só é enviado para quem estiver marcado.

---

## ATUALIZAÇÃO 14 — Log de atividades dos alunos

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-11-log-atividade.sql` no SQL Editor do Supabase → **Run**.

### B) Subir os arquivos no GitHub
Suba: `index.html`, `js/common.js`, `js/aluno.js`, `js/guiasGramatica.js`, `js/enviarMaterial.js`,
`js/perguntaAoDaniel.js`, `js/admin.js`.

### O que é registrado
- **Login** — toda vez que o aluno entra no portal.
- **Download de material de aula** — qual material, dentro de "Minhas aulas".
- **Download de material de gramática** — qual material, dentro dos Guias de Gramática.
- **Envio de pedido de material** — com a data pretendida.
- **Pergunta ao Daniel** — com o assunto da pergunta.

### Onde ver
No seu painel, dentro de cada aluno, tem uma nova aba **"Atividade"**, mostrando a lista mais recente
primeiro, com data e horário de cada ação (ex: "Baixou um material de aula — Class #19 - Slides (PPT) · 16/09/2026 às 14:32").

Isso é só para você — os alunos não têm acesso a esse histórico.

---

## ATUALIZAÇÃO 15 — Portal responsivo para celular

Não precisa rodar SQL nenhum. Suba TODOS os arquivos `.html` novamente (todos ganharam o botão de
menu ☰), junto com `style.css` e `js/common.js`.

### O que mudou
- **Tela de login**: em telas estreitas, o painel azul e o formulário agora empilham um embaixo do
  outro, em vez de espremer as duas colunas lado a lado.
- **Páginas com menu lateral** (Início, Perfil, Minhas aulas, etc.): no celular, o menu lateral fica
  escondido por padrão, e aparece um botão ☰ no canto superior esquerdo. Tocando nele, o menu desliza
  por cima da tela; tocando em qualquer item, ele fecha sozinho.
- Os cartões da página inicial (Perfil, Minhas aulas, etc.) empilham em uma coluna só no celular, em
  vez de ficarem espremidos lado a lado.

---

## ATUALIZAÇÃO 16 — Dia/horário fixo da aula (e ordenação automática da lista)

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-12-horario-fixo.sql` no SQL Editor do Supabase → **Run**.

### B) Subir os arquivos no GitHub
Suba: `js/admin.js`, `js/perfil.js`.

### Como funciona
- Dentro do Perfil de cada aluno, logo abaixo do "Link fixo da aula", agora tem **"Dia e horário fixo
  da aula"** — escolha o dia da semana e o horário, e clique em "Salvar dia e horário".
- A lista de alunos na barra lateral esquerda passa a ficar **ordenada automaticamente**: quem tem aula
  mais cedo na semana aparece primeiro (ex: segunda 20h vem antes de segunda 21h, que vem antes de
  terça 18h). Alunos sem dia/horário definido ficam no final da lista.
- O dia/horário também aparece como uma segunda linha, discreta, embaixo do nome de cada aluno na
  lista — pra você ver a ordem batendo o olho, sem precisar abrir ninguém.
- O aluno também vê esse dia/horário no próprio Perfil dele (só visualização, ele não edita).

---

## ATUALIZAÇÃO 17 — Termo do dia, guia de boas-vindas, modo escuro e mural de conquistas

### A) Rodar o novo SQL
Copie e cole o conteúdo do arquivo `supabase-update-14-termo-onboarding-tema-badges.sql` no SQL Editor
do Supabase → **Run**. (Cria a tabela do Termo do dia já com os 365 termos cadastrados, e adiciona duas
colunas novas no perfil: `has_seen_onboarding` e `preferred_theme`.)

### B) Subir os arquivos no GitHub
- **Novos**: a pasta `badges/` inteira (4 imagens: `badge-10.png`, `badge-30.png`, `badge-50.png`,
  `badge-100.png`) e o arquivo `guia-portal-do-aluno.pdf` (na raiz do projeto, junto com o `index.html`).
- **Atualizados**: `style.css`, `js/common.js`, `js/admin.js`, `js/perfil.js`, `js/aluno.js`,
  `js/enviarMaterial.js`, `js/guiasGramatica.js`, `js/perguntaAoDaniel.js`, `home.html`, `perfil.html`,
  `aluno.html`, `enviar-material.html`, `guias-gramatica.html`, `pergunte-ao-daniel.html`.

### Como funciona agora

**1. Termo do dia**
- Lá embaixo da página inicial (Início), sempre por último, aparece um card com um termo/expressão em
  inglês do dia, com definição e uma frase de exemplo — sempre em inglês, mesmo se o aluno estiver com
  o portal em português (só o título do card acompanha o idioma).
- São 365 termos cadastrados, um por dia. Quando os 365 acabam, o ciclo reinicia do primeiro
  automaticamente — não precisa fazer nada.

**2. Guia de boas-vindas (onboarding)**
- No primeiro acesso de cada aluno (e só nesse primeiro acesso, em qualquer aparelho), aparece um
  pop-up de boas-vindas com um botão para baixar o guia em PDF do portal.
- Depois que o aluno fecha ou baixa, o pop-up nunca mais aparece pra ele.

**3. Modo escuro**
- Nas páginas internas (depois do login), tem um botão na barra lateral pra alternar entre claro/escuro.
- A escolha fica salva no perfil do aluno — se ele trocar de celular pra computador, o tema escolhido
  continua o mesmo.
- A tela de login e as telas de recuperação de senha continuam sempre no modo claro.

**4. Mural de conquistas**
- Na página inicial, logo abaixo do nome do aluno, aparece uma fileira de emblemas: os já conquistados
  aparecem coloridos (o mais recente, em destaque, maior), e só o **próximo** emblema ainda não
  conquistado aparece, em cinza — sem mostrar quantas aulas faltam.
- Os marcos são 10, 30, 50 e 100 aulas — calculado automaticamente a partir da quantidade de aulas já
  cadastradas, então já funciona retroativo pra quem já tem aulas no sistema, sem precisar de nenhum
  ajuste manual.
- Você também vê o mesmo mural no seu painel, dentro do Perfil de cada aluno.

### Correção: bandeiras do seletor de idioma
As bandeiras 🇧🇷/🇺🇸 do seletor de idioma agora são desenhadas (SVG) em vez de emoji — em computadores
com Windows, o emoji de bandeira não é suportado e aparecia como as letras "BR"/"US" dentro de uma
caixinha, em vez da bandeira. Com essa mudança, aparece igual em qualquer aparelho.

