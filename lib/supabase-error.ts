/** 아직 없는 컬럼을 조회하거나 저장했을 때, 그 컬럼 없이 한 번 더 시도할지 판단합니다. */
export function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  const escaped = column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i").test(error.message ?? "");
}
