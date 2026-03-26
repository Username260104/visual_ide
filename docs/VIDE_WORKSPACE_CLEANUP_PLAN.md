# VIDE Workspace Cleanup Plan

## 목적

이 문서는 현재 작업 영역에 남아 있는 레거시 파일, 로컬 산출물, 문서 초안, 보안 위험 파일을
실수 없이 정리하기 위한 실행 계획서다.

이번 단계의 목표는 "무엇을 지울지"를 성급히 결정하는 것이 아니라, 아래 네 가지를 분리하는 것이다.

- 바로 정리해도 안전한 파일
- 사용자 확인 후 삭제해야 하는 파일
- 삭제보다 보관 이동이 맞는 파일
- 절대 정리 대상에 포함하면 안 되는 파일

## 재검토 요약

### 1. 가장 우선순위가 높은 문제

- 로컬 설정 파일 [settings.local.json](/C:/Work/Projects/Hire/visual_ide/.claude/settings.local.json)에 민감한 토큰 값이 포함된 허용 규칙이 존재한다.
- 이 파일은 로컬 개발 환경용 성격이 강하고, 현재 git 추적 대상이다.
- 이 항목은 단순 정리 이슈가 아니라 보안 및 저장소 위생 이슈다.

### 2. 작업 영역 잡음을 크게 만드는 파일

- `.codex-edge-profile/`
- `.codex-phase7-dev.err.log`
- `.codex-phase7-dev.out.log`
- `.codex-phase7-smoke.log`
- `.codex-smoke-server.cmd`
- `.codex-smoke-server.err.log`
- `.codex-smoke-server.out.log`

위 항목들은 앱 소스가 아니라 로컬 실행/스모크 테스트 산출물이다.

### 3. 실제 앱에서 현재 도달되지 않는 레거시 코드 후보

- [demoData.ts](/C:/Work/Projects/Hire/visual_ide/src/lib/demoData.ts)
- [button.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/ui/button.tsx)

현재 import 그래프 기준으로 두 파일은 앱 엔트리에서 도달되지 않는다.

### 4. 삭제보다 정리 위치 이동이 맞는 문서

다음 문서들은 대부분 구현 과정의 phase 문서다. 가치가 없진 않지만 루트에 몰려 있어 작업 영역을 지저분하게 만든다.

- `VIDE_IMPLEMENTATION_PREP.md`
- `VIDE_PHASE1_SAVE_HONESTY_CHECKLIST.md`
- `VIDE_PHASE4_VERSIONING_PLAN.md`
- `VIDE_PHASE5_EVENT_MODEL_PLAN.md`
- `VIDE_PHASE6_STAGING_UX_PLAN.md`
- `VIDE_PHASE7_STRATEGY_CONTEXT_PLAN.md`
- `VIDE_PHASE8_MANUAL_SMOKE_CHECKLIST.md`
- `VIDE_PHASE8_REMAINING_WORK_PLAN.md`
- `VIDE_PHASE8_SMOKE_REPORT.md`
- `VIDE_SIDEBAR_RESTRUCTURE_PLAN.md`

반면 아래 문서는 현재 산출물 성격이 강하므로 루트 유지 가능성이 더 높다.

- [VIDE_PURPOSE_REVIEW.md](/C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_Final.md](/C:/Work/Projects/Hire/visual_ide/VIDE_Final.md)

## 분류

### A. 즉시 정리 가능

이 그룹은 코드/DB/문서 가치가 거의 없고 로컬 산출물 성격이 분명하다.

- `.codex-edge-profile/`
- `.codex-phase7-dev.err.log`
- `.codex-phase7-dev.out.log`
- `.codex-phase7-smoke.log`
- `.codex-smoke-server.cmd`
- `.codex-smoke-server.err.log`
- `.codex-smoke-server.out.log`

권장 처리:

- `.gitignore`에 패턴 추가
- 로컬 삭제

### B. 확인 후 삭제

이 그룹은 현재 앱에서 쓰이지 않는 것으로 보이지만, 의도적 보관 가능성을 마지막으로 확인해야 한다.

- [demoData.ts](/C:/Work/Projects/Hire/visual_ide/src/lib/demoData.ts)
- [button.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/ui/button.tsx)
- [public/uploads](/C:/Work/Projects/Hire/visual_ide/public/uploads)

권장 처리:

- 참조 여부 재검토 후 삭제
- 필요하면 `archive/legacy`로 이동하지 말고 그냥 삭제하는 편이 낫다

이유:

- mock 데이터와 미사용 UI 래퍼는 남겨둘수록 "아직 쓰나?"라는 혼란만 만든다

### C. 삭제보다 이동이 맞음

이 그룹은 작업 기록 문서라서 완전히 지우는 것보다 아카이브 폴더로 이동하는 편이 낫다.

- `VIDE_IMPLEMENTATION_PREP.md`
- `VIDE_PHASE1_SAVE_HONESTY_CHECKLIST.md`
- `VIDE_PHASE4_VERSIONING_PLAN.md`
- `VIDE_PHASE5_EVENT_MODEL_PLAN.md`
- `VIDE_PHASE6_STAGING_UX_PLAN.md`
- `VIDE_PHASE7_STRATEGY_CONTEXT_PLAN.md`
- `VIDE_PHASE8_MANUAL_SMOKE_CHECKLIST.md`
- `VIDE_PHASE8_REMAINING_WORK_PLAN.md`
- `VIDE_PHASE8_SMOKE_REPORT.md`
- `VIDE_SIDEBAR_RESTRUCTURE_PLAN.md`

권장 이동 위치:

- `docs/archive/`

### D. 유지 대상

이 그룹은 정리 대상에서 제외해야 한다.

- [VIDE_PURPOSE_REVIEW.md](/C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_Final.md](/C:/Work/Projects/Hire/visual_ide/VIDE_Final.md)
- `prisma/migrations/*`
- `src/generated/prisma/*`
- `.claude/launch.json`
- `.next/`
- `node_modules/`

주의:

- `.next/`, `node_modules/`는 커도 정상 산출물이다
- `.claude/launch.json`은 팀이 실제로 쓰는 로컬 실행 설정일 수 있다

### E. 긴급 보안 정리 대상

- [settings.local.json](/C:/Work/Projects/Hire/visual_ide/.claude/settings.local.json)

권장 처리:

1. git 추적 대상에서 제거
2. `.gitignore`에 `.claude/settings.local.json` 추가
3. 민감값 포함 규칙 제거 또는 파일 자체를 로컬 전용으로 전환
4. 외부 노출 가능성이 있으면 관련 토큰 회전 검토

## 실행 순서

### PR A. 보안 및 ignore 정리

범위:

- `.claude/settings.local.json` 추적 중단
- `.gitignore`에 아래 패턴 추가
  - `.codex-*`
  - `.codex-edge-profile/`
  - `.claude/settings.local.json`

검증:

- `git status`에서 민감 로컬 파일이 더 이상 추적되지 않아야 함

### PR B. 로컬 산출물 제거

범위:

- `.codex-*`
- `.codex-edge-profile/`

검증:

- 루트 디렉터리에서 로컬 테스트 찌꺼기 제거 확인

### PR C. 문서 아카이브

범위:

- phase 문서들을 `docs/archive/`로 이동

원칙:

- `VIDE_PURPOSE_REVIEW.md`, `VIDE_Final.md`는 루트 유지

검증:

- 루트에서 핵심 문서만 남고 phase 문서는 archive로 정리되어야 함

### PR D. 레거시 코드 제거

범위:

- [demoData.ts](/C:/Work/Projects/Hire/visual_ide/src/lib/demoData.ts)
- [button.tsx](/C:/Work/Projects/Hire/visual_ide/src/components/ui/button.tsx)
- 필요 시 [public/uploads](/C:/Work/Projects/Hire/visual_ide/public/uploads)

검증:

- 참조 검색 결과 0건
- `npm run lint`
- `npm run build`

## 검증 체크리스트

- `git status`에 로컬 로그/프로필 파일이 더 이상 잡히지 않는다
- 민감 로컬 설정 파일이 추적 대상에서 빠진다
- phase 문서가 루트에서 사라지고 archive로 이동한다
- `demoData.ts`, `button.tsx` 삭제 후에도 `lint/build`가 통과한다
- 핵심 문서와 migrations는 그대로 유지된다

## 제안하는 기본 결정

현재 기준으로는 아래 기본안이 가장 합리적이다.

1. `.claude/settings.local.json`은 로컬 전용으로 전환
2. `.codex-*`와 `.codex-edge-profile/`은 전부 삭제
3. phase 문서는 `docs/archive/`로 이동
4. `demoData.ts`, `button.tsx`는 삭제
5. `VIDE_PURPOSE_REVIEW.md`, `VIDE_Final.md`만 루트 유지

## 이번 문서 단계에서 하지 않는 것

- 실제 파일 삭제
- 실제 파일 이동
- `.gitignore` 수정
- 민감 토큰 회전 실행

이번 문서는 실행 전 기준점을 만드는 용도다.


## Progress Update

- PR A. ?? ? ignore ??: ??
- PR B. ?? ??? ??: ??
- PR C. ?? ????: ??
- PR D. ??? ?? ??: ??
