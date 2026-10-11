export function authErrorMessage(message: string, mode: "login" | "signup") {
  const text = message.toLowerCase();
  if (text.includes("expired") || text.includes("otp_expired") || text.includes("already been used")) {
    return "링크가 만료되었거나 이미 사용되었습니다.";
  }
  if (text.includes("invalid login") || text.includes("invalid credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (
    text.includes("fetch") ||
    text.includes("network") ||
    text.includes("enotfound") ||
    text.includes("failed to fetch")
  ) {
    return "인증 서버에 연결하지 못했습니다. Supabase 프로젝트가 일시 중지되었거나 삭제되었는지 확인해 주세요.";
  }
  if (text.includes("not authorized")) {
    return "이 주소로는 메일이 가지 않습니다. Supabase 조직에 등록된 이메일이거나, Custom SMTP 설정이 필요합니다.";
  }
  if (text.includes("rate limit")) return "메일 발송 횟수가 잠시 제한되었습니다. 잠시 뒤 다시 시도해 주세요.";
  if (text.includes("error sending") || text.includes("smtp") || text.includes("confirmation email")) {
    return "메일을 보내지 못했습니다. 지금 발신 주소는 테스트용이라 아무 주소로나 보내지 못합니다. Supabase Authentication → Providers → Email에서 Confirm email을 끄면 누구나 바로 가입됩니다.";
  }
  if (text.includes("email not confirmed")) return "이메일 인증을 마친 뒤 로그인해 주세요.";
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  }
  if (text.includes("at least 6") || text.includes("password")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (text.includes("email")) return "이메일 형식을 확인해 주세요.";
  return mode === "signup" ? "회원가입에 실패했습니다. 다시 시도해 주세요." : "로그인에 실패했습니다. 다시 시도해 주세요.";
}

export function confirmLinkMessage(message: string) {
  const text = message.toLowerCase();
  if (text.includes("code verifier") || text.includes("auth code")) {
    return "가입을 진행한 브라우저에서 메일 링크를 다시 열어 주세요.";
  }
  if (text.includes("expired") || text.includes("otp") || text.includes("invalid") || text.includes("already been used")) {
    return "링크가 만료되었거나 이미 사용되었습니다.";
  }
  return "이메일 인증을 끝내지 못했습니다. 로그인 화면에서 다시 시도해 주세요.";
}
