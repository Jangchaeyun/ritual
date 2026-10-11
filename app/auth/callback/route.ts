export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = new URL("/auth/confirmed", url.origin);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (code) next.searchParams.set("code", code);
  if (tokenHash) next.searchParams.set("token_hash", tokenHash);
  if (type) next.searchParams.set("type", type);
  if (authError && !code && !tokenHash) next.searchParams.set("error", authError);

  return Response.redirect(next);
}
