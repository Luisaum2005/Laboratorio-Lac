import { LoginPageView } from "@/features/auth/login-page";
import { login } from "@/features/auth/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  return (
    <LoginPageView
      action={login}
      error={error ? "E-mail ou senha inválidos." : undefined}
    />
  );
}
