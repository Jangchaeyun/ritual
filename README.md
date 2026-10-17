# RITUAL

공부와 근무 시간을 할 일에 남기고, 습관과 하루 회고를 한 화면에서 이어 가는 개인용 플래너입니다. 휴대폰에 설치할 수 있는 PWA로 만들었고, 로그인한 기록은 사용자 본인만 읽고 쓰도록 데이터베이스에 둡니다.

## 주요 기능

- 할 일을 건강, 학습, 업무, 마음 중 하나로 두고 이름과 분류를 수정합니다. 목록에 보이는 시간은 서울 기준 오늘 집중 시간만 더합니다.
- 습관은 하루 목표 횟수와 반복 요일, 종료일이 있습니다. 목표를 채운 날이 이어지면 연속 달성 일수가 올라갑니다. 오늘이 아직 덜 찼어도 어제까지의 연속은 유지됩니다.
- 공부 타이머와 근무 타이머가 기본이고, 포모도로는 작업 시간과 휴식 시간을 바꿀 수 있는 보조 기능입니다.
- 하루 시간표는 기록을 시 단위로 나누고, 색은 10분 눈금이 아니라 시작한 분과 끝난 분에 맞춥니다. 할 일마다 색을 고를 수 있습니다.
- 타이머 기록은 시작과 끝 시각만 수정하거나 삭제할 수 있습니다. 날짜는 처음 저장된 서울 날짜를 유지합니다.
- 배경 소리는 빗소리, 카페, 숲, 파도, 모닥불, 시냇물, 밤입니다. 카페, 숲, 모닥불은 라이선스가 있는 녹음이고 나머지는 브라우저에서 합성합니다.
- 밝은 테마와 어두운 테마를 고를 수 있습니다. 어두운 테마는 검은 배경을 유지하고 글자와 선택 표시의 대비를 낮춥니다.
- 한 줄 회고, 최근 30일 습관 히트맵, 주간·월간 분석, Gemini를 쓰는 오늘의 리포트가 있습니다.
- Google 계정으로 오늘 일정을 불러올 수 있습니다. 이 연동은 Google Cloud에서 리디렉션 URI와 테스트 사용자를 따로 맞춰야 동작합니다.

우선순위 상·중·하는 저장값으로만 남아 있고 화면에서는 고르지 않습니다.

## 사용 기술

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4
- Supabase Auth와 Postgres. 행 단위 보안은 `auth.uid()`가 자기 `user_id`인 행만 허용합니다.
- NextAuth로 Google Calendar 일정을 읽습니다.
- Gemini(`gemini-flash-lite-latest`)로 오늘의 리포트를 만듭니다. 키가 없으면 그 기능만 거절합니다.
- PWA는 `@ducanh2912/next-pwa`를 쓰고, 개발 서버에서는 꺼 둡니다.

## 디렉터리

```text
app/                  페이지와 Route Handler
  api/                습관 체크, 할 일 순서, 타이머 기록, 리포트, 캘린더
components/           화면. routine-provider가 클라이언트 상태를 모읍니다.
hooks/                Supabase에서 습관, 할 일, 기록, 회고를 읽고 씁니다.
lib/                  날짜, 스트릭, 반복, 시간표, 테마, 오디오
supabase/schema.sql   테이블과 RLS 정책
scripts/              스트릭과 시간표 계산을 확인하는 스크립트
public/sounds/        카페, 숲, 모닥불 녹음
```

## 실행

```bash
npm install
npm run dev
```

로컬 주소는 http://localhost:3000 입니다.

```bash
npm run build
npm run start
npm run lint
npm run check
```

`npm run check`는 스트릭과 시간표 계산만 확인합니다. 화면을 누르는 자동 테스트는 없습니다.

## 환경 변수

`.env.example`의 이름을 `.env.local`로 복사한 뒤 값을 채웁니다. `.env*`는 Git에 올리지 않습니다.

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 주소 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 브라우저용 anon 키. 서비스 롤 키는 넣지 않습니다. |
| `NEXTAUTH_URL` | 로컬은 `http://localhost:3000` |
| `NEXTAUTH_SECRET` | NextAuth 서명 |
| `GOOGLE_CLIENT_ID` | Calendar 연동 |
| `GOOGLE_CLIENT_SECRET` | Calendar 연동 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 오늘의 리포트 |

데이터베이스 비밀번호는 Postgres 접속용입니다. 앱 환경 변수에 넣지 않습니다.

처음 한 번은 `supabase/schema.sql`을 Supabase SQL 편집기에서 실행합니다. `pomodoro_sessions.started_at`이 없으면 시작 시각은 저장된 분으로 역산합니다.

## 핵심 동작

- `lib/streak.ts`의 `consecutiveStreak`는 오늘이 비어 있으면 어제부터 셉니다. 그 날짜에 할 일이 없는 습관은 통과합니다.
- `lib/repeat.ts`의 `occursOn`은 반복 요일과 종료일을 판단합니다. 일정이 없으면 종료일 없이 매일입니다. 이 설정은 `profiles.preferences`와 브라우저의 `ritual:repeat`에 있습니다.
- `lib/hour-timeline.ts`의 `recordedMinutes`는 1초 미만을 0분으로 보고, 그 외에는 분을 반올림합니다. `sessionInterval`은 `started_at`이 없을 때의 시작 시각을 만듭니다.
- `components/routine-provider.tsx`는 화면이 공유하는 상태입니다. 원격 데이터는 `hooks/`가 담당합니다.
- `app/api/pomodoro/sessions`는 기록 수정과 삭제를 처리합니다. 수정은 집중 분 차이만 할 일 누적 시간에 반영합니다.
- `app/api/habits/check`는 오늘 습관 로그를 늘리거나 줄입니다.
- `app/api/daily-report`는 오늘 습관과 집중 시간으로 짧은 리포트를 만듭니다.
- `proxy.ts`는 로그인하지 않은 사용자를 보호된 경로에서 로그인 화면으로 보냅니다. `api/auth`는 이 검사에서 빼 둡니다.

날짜 계산은 서울 시간입니다. 여름 시간에는 적용되지 않습니다.

## 배경 소리 출처

- 카페: Marble Toast, CC0, [Cafe ambiance](https://commons.wikimedia.org/wiki/File:Cafe_ambiance.ogg). 앞부분 90초를 사용합니다.
- 숲: nille, public domain, [20090610_0_ambience](https://commons.wikimedia.org/wiki/File:20090610_0_ambience.ogg)
- 모닥불: Glaneur de sons, CC BY 3.0, [freesound 29727](https://freesound.org/people/Glaneur%20de%20sons/sounds/29727/). 화면의 배경 소리에 출처를 표시합니다.

## 구현하면서 맞춘 부분

- 연속 달성 일수는 기록이 도착하기 전의 0을 고정하지 않고, 습관 로그가 로드된 뒤에 다시 계산합니다.
- 시간표 눈금은 10분마다 선을 그리지만, 색 구간은 그 칸에 맞추지 않고 실제 분을 사용합니다.
- 테마 색은 컴포넌트마다 하드코딩하지 않고 CSS 변수로 바꿉니다. 밝은 테마는 `data-theme` 없이 기본값입니다.
- 타이머가 돌아가는 동안에는 그 구간을 수정하거나 삭제하지 않습니다.

## 앞으로 다듬을 부분

- 화면 조작을 자동으로 검사하는 테스트는 아직 없습니다.
- 클라이언트 상태가 `routine-provider` 한 파일에 모여 있습니다. 동작을 유지한 채 나누는 작업이 남아 있습니다.
- Google Calendar는 클라우드 콘솔의 리디렉션 URI, JavaScript 원본, 테스트 사용자, Calendar API 사용 설정이 맞아야 합니다. 코드만으로 해결되지 않습니다.

## 공개할 때

비밀과 개인 설정은 `.env.local`, `.vercel`에 있습니다. 둘 다 `.gitignore`에 있습니다. 저장소에 올릴 파일은 소스, `supabase/schema.sql`, `.env.example`, 라이선스 표시가 있는 녹음입니다. anon 키가 아닌 서비스 롤 키, 데이터베이스 비밀번호, NextAuth 비밀은 올리지 않습니다.
