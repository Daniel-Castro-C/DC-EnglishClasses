// ==========================================================
// CONFIGURAÇÃO — cole aqui os dados do SEU projeto Supabase
// (Painel Supabase > Project Settings > API)
// ==========================================================
const SUPABASE_URL = "https://dgwbjgngewymzgedlzix.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnd2JqZ25nZXd5bXpnZWRseml4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3MjA0NDUsImV4cCI6MjEwNDI5NjQ0NX0.P2CzyJiYTRH13nuXOKQXl5F65Voq0XHSLC8kQdhvqGw";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Nome do bucket de armazenamento de arquivos (criado no passo do Storage)
const STORAGE_BUCKET = "materiais";

// ---------- Funções auxiliares usadas nas páginas ----------

// Garante que existe uma sessão ativa; senão, manda de volta pro login
async function requireSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}

// Busca o perfil (nome, e-mail, papel: admin ou student) do usuário logado
async function getMyProfile(userId) {
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("Erro ao buscar perfil:", error);
    return null;
  }
  return data;
}

async function signOutAndRedirect() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}
