export type Credentials = {
  email: string;
  password: string;
};

type AuthGateway = {
  signInWithPassword(credentials: Credentials): Promise<{
    userId: string | null;
    error: string | null;
  }>;
};

export async function authenticate(credentials: Credentials, gateway: AuthGateway) {
  const result = await gateway.signInWithPassword(credentials);

  if (result.userId) {
    return { status: "authenticated" as const, userId: result.userId };
  }

  return { status: "rejected" as const, reason: result.error ?? "Credenciais inválidas." };
}
