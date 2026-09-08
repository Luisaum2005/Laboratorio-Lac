import { describe, expect, it } from "vitest";

import { authenticate } from "./authenticate";

describe("autenticação de usuário convidado", () => {
  it("libera o usuário quando o Supabase aceita suas credenciais", async () => {
    const result = await authenticate(
      { email: "funcionario@laboratorio.test", password: "senha-segura" },
      {
        signInWithPassword: async () => ({ userId: "user-1", error: null }),
      },
    );

    expect(result).toEqual({ status: "authenticated", userId: "user-1" });
  });
});
