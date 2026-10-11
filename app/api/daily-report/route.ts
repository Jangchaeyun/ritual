import { HABIT_CATEGORIES } from "@/lib/types";
import type { DailyReport, DailyReportInput } from "@/lib/daily-report";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";

const habitSchema = z.object({
  title: z.string().trim().min(1).max(80),
  category: z.enum(HABIT_CATEGORIES),
  completedCount: z.number().int().min(0).max(7),
  targetCount: z.number().int().min(1).max(7),
});

const categoryMinutesSchema = z.number().int().min(0).max(24 * 60);
const focusMinutesSchema = z.number().int().min(0).max(24 * 60 * HABIT_CATEGORIES.length);

const inputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedHabits: z.array(habitSchema).max(30),
  openHabits: z.array(habitSchema).max(30),
  focusMinutes: focusMinutesSchema,
  focusSessions: z.number().int().min(0).max(200),
  focusByCategory: z.object({
    건강: categoryMinutesSchema,
    학습: categoryMinutesSchema,
    업무: categoryMinutesSchema,
    마음: categoryMinutesSchema,
  }),
  streak: z.number().int().min(0).max(9999),
});

const reportSchema = z.object({
  productivity: z.string().describe("오늘 생산성을 다정하게 한 문장으로"),
  strength: z.string().describe("잘한 점을 구체적으로 한 문장으로"),
  improvement: z.string().describe("개선점을 부담 없이 한 문장으로"),
});

function habitLine(habit: DailyReportInput["completedHabits"][number]) {
  return `- ${habit.title} (${habit.category}, ${habit.completedCount}/${habit.targetCount})`;
}

function promptFor(input: DailyReportInput) {
  const completed = input.completedHabits.length
    ? input.completedHabits.map(habitLine).join("\n")
    : "- 없음";
  const open = input.openHabits.length ? input.openHabits.map(habitLine).join("\n") : "- 없음";
  const categories = HABIT_CATEGORIES.map(
    (category) => `${category} ${input.focusByCategory[category]}분`,
  ).join(", ");

  return [
    `날짜: ${input.date}`,
    `연속 달성: ${input.streak}일`,
    "오늘 달성한 습관:",
    completed,
    "아직 남은 습관:",
    open,
    `집중 시간: ${input.focusMinutes}분`,
    `집중 세션: ${input.focusSessions}회`,
    `카테고리별 집중: ${categories}`,
  ].join("\n");
}

function cleanLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function POST(request: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "missing_key" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  try {
    const { output } = await generateText({
      model: google("gemini-flash-lite-latest"),
      output: Output.object({
        schema: reportSchema,
        name: "DailyReport",
        description: "오늘 루틴을 생산성, 잘한 점, 개선점 세 문장으로 요약",
      }),
      system: [
        "너는 개인 루틴 앱 RITUAL의 코치다.",
        "말투는 다정한 한국어 해요체다.",
        "각 필드는 한 문장만 쓴다. 문장 부호로 끝내고, 목록이나 따옴표, 이모지는 쓰지 않는다.",
        "데이터에 없는 습관, 시간, 성과를 만들지 않는다.",
        "잘한 점은 실제로 한 일을 구체적으로 알아준다.",
        "개선점은 꾸짖지 않고, 남은 습관이나 집중 시간을 바탕으로 가볍게 제안한다.",
        "기록이 거의 없으면 자책 대신 작은 시작을 응원한다.",
      ].join("\n"),
      prompt: promptFor(parsed.data),
      temperature: 0.7,
      maxOutputTokens: 400,
      timeout: 45_000,
    });

    const report: DailyReport = {
      productivity: cleanLine(output.productivity),
      strength: cleanLine(output.strength),
      improvement: cleanLine(output.improvement),
    };
    if (!report.productivity || !report.strength || !report.improvement) {
      return Response.json({ error: "unavailable" }, { status: 502 });
    }
    return Response.json(report);
  } catch (error) {
    const status = typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined;
    const raw = error instanceof Error ? error.message : "unknown";
    const reason = raw.replace(/AQ\.[A-Za-z0-9_-]+/g, "[key]").replace(/AIza[0-9A-Za-z_-]+/g, "[key]").slice(0, 240);
    console.error("daily-report failed", status ?? "unknown", reason);
    const keyRejected = status === 401 || status === 403 || /api key|API_KEY/i.test(raw);
    if (keyRejected) {
      return Response.json({ error: "invalid_key" }, { status: 401 });
    }
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
