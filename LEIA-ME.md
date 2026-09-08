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

## Se quiser mudar alguma coisa depois
Qualquer alteração de design, texto ou funcionalidade, é só me pedir — eu edito os arquivos e te devolvo os atualizados para você subir de novo no GitHub (o site na Vercel se atualiza sozinho sempre que os arquivos do GitHub mudam).
