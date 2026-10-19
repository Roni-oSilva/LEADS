import Link from "next/link";
import { Brand } from "@/components/layout/brand";

export const metadata = { title: "Política de privacidade" };

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="space-y-2"><h2 className="text-base font-semibold">{t}</h2><div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div></section>
);

/**
 * Modelo de política. Cada organização usuária é a CONTROLADORA dos dados que trata e deve revisar
 * este texto com seu jurídico e informar nome, CNPJ e canal do encarregado (DPO).
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div className="flex items-center justify-between"><Brand /><Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">Entrar</Link></div>
      <div><h1 className="text-2xl font-semibold tracking-tight">Política de Privacidade</h1><p className="mt-1 text-xs text-muted-foreground">Modelo de referência — revise e complete com os dados da sua empresa antes de publicar.</p></div>
      <S t="1. Quem somos">
        <p>O LeadFinder Pro é uma plataforma de gestão de relacionamento comercial. Cada organização que utiliza a plataforma atua como <strong>controladora</strong> dos dados de leads que cadastra, importa ou coleta; o operador da plataforma atua como <strong>operador</strong>, tratando dados conforme as instruções da organização.</p>
        <p>Controladora: <em>[razão social, CNPJ e endereço]</em>. Encarregado (DPO): <em>[nome e e-mail]</em>.</p>
      </S>
      <S t="2. Dados que tratamos">
        <p><strong>Usuários da plataforma:</strong> nome, e-mail, telefone (opcional), preferências e registros de acesso/auditoria.</p>
        <p><strong>Leads (contatos comerciais):</strong> dados empresariais e de contato comercial publicamente disponíveis ou fornecidos pelo próprio titular (nome da empresa, segmento, localização, telefone/e-mail/site/redes sociais comerciais), origem do dado, histórico de interações e preferências de comunicação.</p>
        <p>Não coletamos dados pessoais sensíveis e não utilizamos listas obtidas de forma ilícita nem burlamos proteções de sites ou APIs.</p>
      </S>
      <S t="3. Finalidades e bases legais">
        <p>Prospecção e relacionamento comercial B2B (legítimo interesse, art. 7º, IX, LGPD, com avaliação de balanceamento); atendimento a solicitações feitas em formulários (procedimentos preliminares a contrato, art. 7º, V); comunicações opcionais, como novidades (consentimento, art. 7º, I); cumprimento de obrigações legais; segurança e prevenção a fraudes.</p>
        <p>A base legal aplicada a cada lead é registrada no CRM. Dados publicamente disponíveis não são tratados para qualquer finalidade: respeitamos a finalidade original e a expectativa do titular.</p>
      </S>
      <S t="4. Compartilhamento">
        <p>Compartilhamos dados apenas com provedores necessários à operação (hospedagem, banco de dados e autenticação — Supabase e Vercel —, e fontes de dados autorizadas contratadas pela organização) e quando exigido por lei. Não vendemos dados pessoais.</p>
      </S>
      <S t="5. Contato comercial e opt-out">
        <p>Toda abordagem deve ser individual, identificar o remetente e oferecer a opção de não receber novos contatos. Pedidos de oposição são registrados em uma lista de supressão e respeitados em todas as áreas do sistema. Mensagens automatizadas só são enviadas por canais oficiais, com modelos aprovados e base legal adequada.</p>
      </S>
      <S t="6. Direitos dos titulares">
        <p>Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, eliminação, portabilidade, informação sobre compartilhamentos e oposição, além de revogar consentimentos. Use o formulário de solicitação fornecido pela empresa que entrou em contato (<code>/privacidade/solicitacao?org=…</code>) ou escreva ao encarregado acima.</p>
      </S>
      <S t="7. Retenção e segurança">
        <p>Mantemos os dados pelo tempo necessário às finalidades ou exigido por lei. Adotamos controle de acesso por organização (Row Level Security), criptografia em trânsito, validação no servidor, limitação de abuso (rate limiting), registro de operações administrativas e backups. Nenhum sistema é totalmente imune a riscos; incidentes relevantes serão comunicados conforme a lei.</p>
      </S>
      <S t="8. Cookies">
        <p>Utilizamos apenas cookies estritamente necessários à autenticação e segurança da sessão.</p>
      </S>
      <S t="9. Alterações">
        <p>Esta política pode ser atualizada. A versão vigente estará sempre nesta página.</p>
      </S>
    </main>
  );
}
