import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { createCatalogGovernanceGateway } from "../src/features/catalog/catalog-gateway.ts";
import {
  updateCanonicalExam, deactivateCanonicalExam, revokeAlias, removeComposition,
} from "../src/features/catalog/catalog-governance.ts";

// Creates disposable fixtures only in the local Supabase environment.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const appUrl = process.env.CATALOG_TEST_APP_URL ?? "http://localhost:3103";
assert.match(url, /^http:\/\/(127\.0\.0\.1|localhost):/);
assert.match(appUrl, /^http:\/\/(127\.0\.0\.1|localhost):/);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const admin = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);
const token = randomUUID();
const name = `TESTE CORRECAO TICKET3 ${token}`;
let examId, componentId, userId, operator;

try {
  const login = await admin.auth.signInWithPassword({
    email: process.env.INITIAL_ADMIN_EMAIL, password: process.env.INITIAL_ADMIN_PASSWORD,
  });
  if (login.error) throw login.error;
  const gateway = createCatalogGovernanceGateway(admin);
  const fixture = await admin.from("exams").insert([
    { name, mnemonic: `T3P-${token}` },
    { name: `COMPONENTE ${token}`, mnemonic: `T3C-${token}` },
  ]).select("id,name");
  if (fixture.error) throw fixture.error;
  examId = String(fixture.data.find(row => row.name === name).id);
  componentId = String(fixture.data.find(row => row.name !== name).id);
  const alias = `ALIAS TESTE ${token}`;
  const aliasResult = await admin.from("exam_aliases").insert({
    exam_id: examId, alias, normalized_alias: alias.toLowerCase(),
  }).select("id").single();
  if (aliasResult.error) throw aliasResult.error;
  const composition = await admin.from("exam_compositions").insert({
    package_exam_id: examId, component_exam_id: componentId,
  });
  if (composition.error) throw composition.error;

  const password = randomUUID();
  const email = `review-${token}@example.com`;
  const user = await service.auth.admin.createUser({
    email, password, email_confirm: true, app_metadata: { role: "operator" },
  });
  if (user.error) throw user.error;
  userId = user.data.user.id;
  const cookies = new Map();
  operator = createServerClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => Array.from(cookies, ([name, value]) => ({ name, value })),
      setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const operatorLogin = await operator.auth.signInWithPassword({ email, password });
  if (operatorLogin.error) throw operatorLogin.error;
  const cookie = Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");

  for (const suffix of ["", "?success=__proto__", "?error=constructor"]) {
    const response = await fetch(`${appUrl}/catalogo/${examId}${suffix}`, {
      headers: { cookie }, redirect: "manual",
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(alias));
    assert.ok(html.includes(`COMPONENTE ${token}`));
    assert.ok(!/<form\b/i.test(html));
  }
  const listResponse = await fetch(`${appUrl}/catalogo`, { headers: { cookie } });
  assert.equal(listResponse.status, 200);
  assert.ok((await listResponse.text()).includes("Consultar"));
  console.log("PASS: operador consulta aliases/composições sem formulários; URLs inesperadas não quebram a página.");

  const denied = await updateCanonicalExam({
    id: examId, name: "NEGADO", mnemonic: `T3P-${token}`,
  }, createCatalogGovernanceGateway(operator));
  assert.equal(denied.status, "error");
  const operations = [
    [() => updateCanonicalExam({ id: examId, name: `${name} EDITADO`, mnemonic: `T3P-${token}` }, gateway),
      () => updateCanonicalExam({ id: "-1", name: "AUSENTE", mnemonic: "AUSENTE" }, gateway)],
    [() => revokeAlias(String(aliasResult.data.id), gateway),
      () => revokeAlias(String(aliasResult.data.id), gateway)],
    [() => removeComposition({ packageExamId: examId, componentExamId: componentId }, gateway),
      () => removeComposition({ packageExamId: examId, componentExamId: componentId }, gateway)],
    [() => deactivateCanonicalExam(examId, gateway), () => deactivateCanonicalExam("-1", gateway)],
  ];
  for (const [existing, missing] of operations) {
    assert.equal((await existing()).status, "success");
    assert.equal((await missing()).status, "error");
  }
  console.log("PASS: quatro mutações confirmam alterações reais, rejeitam alvos ausentes e negam escrita ao operador via RLS.");
} finally {
  if (operator) await operator.auth.signOut();
  if (userId) {
    const deleted = await service.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
  }
  for (const id of [examId, componentId].filter(Boolean)) {
    const removed = await admin.from("exams").delete().eq("id", id);
    if (removed.error) throw removed.error;
  }
  await admin.auth.signOut();
  console.log("CLEANUP: usuário e exames descartáveis removidos do ambiente local.");
}
