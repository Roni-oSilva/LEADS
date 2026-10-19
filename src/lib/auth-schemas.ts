import { z } from "zod";

const email = z.string().trim().toLowerCase().email("E-mail inválido");
const password = z.string().min(8, "A senha deve ter ao menos 8 caracteres").max(72);

export const loginSchema = z.object({ email, password: z.string().min(1, "Informe a senha") });
export const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome").max(100),
  organizationName: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  email,
  password,
  accept: z.literal(true, { error: "É necessário aceitar a política de privacidade" }),
});
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ password });

