# VIDE Gemini 3.1 Flash-Lite Copilot Plan

## Purpose

VIDE 안에 이미 입력된 프로젝트, 브랜치, 노드 데이터를 읽고 사용자의 질문에 답하는 간단한 AI 코파일럿 기능을 추가한다.

이번 문서는 `gemini-3.1-flash-lite-preview`를 기준으로 정리한 단순 구현 계획서다.

## Final Review

결론부터 말하면 현재 요구사항에는 큰 구조적 문제 없이 적용 가능하다.

이번 기능은 아래 원칙으로 단순하게 간다.

- 단일 프로젝트 범위
- 단일 질문, 단일 답변
- 내부 데이터만 사용
- 서버에서 내부 데이터를 직접 조회
- 별도 retrieval, reranking, 라우팅 없음
- 모델 튜닝 최소화
- structured output으로 응답 형식만 고정

이 범위에서는 치명적인 기술적 blocker는 없다.

## Model Position

이번 계획에서는 모델 선택을 이미 확정된 전제로 본다.

- 모델: `gemini-3.1-flash-lite-preview`
- 시스템 설계는 이 모델의 속도나 비용을 기준으로 최적화하지 않는다.
- 모델이 바뀌더라도 서버 API와 UI 구조는 그대로 유지되도록 한다.

## Main Risk

### Preview model risk

가장 큰 리스크는 모델 코드가 `gemini-3.1-flash-lite-preview`라는 점이다.

이 말은 API transport를 `v1`로 써도 모델 자체의 동작이나 가용성은 preview 정책 영향을 받을 수 있다는 뜻이다.

대응:

- 모델명은 코드에 하드코딩하지 않고 `GEMINI_MODEL` 환경변수로 분리
- 기본값은 `gemini-3.1-flash-lite-preview`
- UI와 서버 설계는 특정 모델명에 의존하지 않게 유지

## Final Architecture

### 1. Server-side context collection

브라우저가 내부 데이터를 전부 보내지 않고, 서버 route가 `projectId`와 `selectedNodeId`만 받아 Prisma로 직접 조회한다.

이 방식이 좋은 이유:

- 클라이언트 변조 방지
- request payload 축소
- 내부 데이터 정책을 서버에서 통제 가능
- 프론트에서 데이터 조합 로직을 중복 구현하지 않아도 됨

조회 범위는 active record만 사용한다.

- project: `archivedAt = null`
- direction: `archivedAt = null`
- node: `archivedAt = null`

### 2. Full context shaping

이번 1차 구현은 질문마다 프로젝트의 내부 텍스트 데이터를 단순히 묶어서 모델에 전달한다.

포함 대상:

- 프로젝트 전략: `brief`, `constraints`, `targetAudience`, `brandTone`
- 브랜치 전략: `name`, `thesis`, `fitCriteria`, `antiGoal`, `referenceNotes`
- 노드 데이터: `note`, `prompt`, `userIntent`, `intentTags`, `changeTags`, `status`, `nodeType`
- 선택 노드가 있으면 그 노드를 먼저 배치

즉, 질문과 관련된 일부만 뽑는 retrieval 단계는 두지 않는다.

모델에 넘길 최종 컨텍스트는 사람이 읽을 수 있는 섹션형 문자열로 만든다.

예시 구조:

- Project Summary
- Directions
- Selected Node
- Nodes

각 항목에는 내부 citation id를 붙인다.

예:

- `PROJECT:brief`
- `DIRECTION:<id>:thesis`
- `NODE:<id>:note`

이 citation id는 모델 응답의 근거 목록과 연결된다.

### 3. Gemini API route

새 route:

- `src/app/api/projects/[id]/copilot/route.ts`

request:

```json
{
  "question": "이 프로젝트에서 메인 비주얼 방향을 어떻게 잡고 있지?",
  "selectedNodeId": "optional-node-id"
}
```

response:

```json
{
  "answer": "....",
  "confidence": "grounded",
  "citations": [
    {
      "id": "PROJECT:brief",
      "label": "프로젝트 브리프"
    }
  ],
  "missingInfo": []
}
```

### 4. Sidebar panel UI

새 사이드바 탭으로 붙인다.

이유:

- 기능 성격이 프로젝트 전체 보조 도구에 가깝다.
- 선택 노드가 있을 때만 쓰는 기능이 아니다.
- 현재 레이아웃 구조상 DetailPanel보다 Sidebar가 확장하기 쉽다.

구성:

- 질문 입력 textarea
- 질문하기 버튼
- 로딩 상태
- 답변 카드
- 근거 카드 목록
- 선택 노드 배지

## Model Configuration

### SDK

- `@google/genai`

### Environment variables

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.1-flash-lite-preview`
- optional: `GEMINI_API_VERSION=v1`

### API version

운영 기준 권장값은 `v1`이다.

이유:

- Gemini SDK 기본값은 `v1beta`다.
- 공식 문서상 SDK에서 `apiVersion: "v1"`를 명시할 수 있다.
- 이번 기능은 `generateContent`와 structured output만 쓰므로 `v1` 사용이 자연스럽다.

### Generation settings

이번 1차 구현에서는 모델 설정을 따로 튜닝하지 않는다.

- `temperature`를 별도로 조정하지 않음
- `thinkingLevel`을 별도로 조정하지 않음
- 모델 기본 동작을 그대로 사용

이유는 기능 요구사항이 단순하고, 시스템 복잡도를 늘릴 이유가 없기 때문이다.

## Why Single-turn First

이번 1차 구현은 stateless single-turn으로 한다.

이유:

- 요구사항이 단순함
- 응답 구조가 단순함
- 저장할 대화 히스토리가 없음
- 멀티턴 상태 관리가 필요 없음
- thought signature를 직접 신경 쓸 필요가 거의 없음

2차 확장 시에만 chat history를 붙인다.

## Prompting Policy

system instruction 원칙:

- 제공된 내부 데이터만 근거로 답변할 것
- 모르는 내용은 추측하지 말 것
- 답변은 간결하게 정리할 것
- 근거가 된 citation id를 함께 반환할 것
- 데이터가 부족하면 `missingInfo`에 부족한 항목을 적을 것

금지:

- 웹 검색
- Google Search grounding
- URL context
- 외부 파일 검색
- 일반 상식으로 빈칸 메우기

## Structured Output Decision

이번 기능은 natural language freeform보다 structured output이 더 안전하다.

이유:

- UI 렌더링이 안정적
- 근거 표기가 쉬움
- 테스트 자동화가 쉬움
- 응답 형식을 고정할 수 있음

현재 프로젝트에는 `zod`가 없으므로 1차는 dependency를 늘리지 않고 plain JSON Schema object를 직접 정의하는 쪽이 낫다.

권장 응답 스키마:

- `answer: string`
- `confidence: "grounded" | "partial" | "insufficient"`
- `citations: { id: string; label: string }[]`
- `missingInfo: string[]`

## File Plan

추가:

- `src/lib/gemini.ts`
- `src/lib/copilotContext.ts`
- `src/components/layout/ProjectCopilotPanel.tsx`
- `src/app/api/projects/[id]/copilot/route.ts`

수정:

- `src/stores/uiStore.ts`
- `src/components/layout/Sidebar.tsx`
- `.env.example`

선택:

- `src/lib/types.ts`

## Detailed Implementation Plan

### Step 1. Gemini client wrapper

`src/lib/gemini.ts`

역할:

- `GoogleGenAI` 초기화
- env 읽기
- model name 제공
- apiVersion 제공

주의:

- route를 Edge runtime으로 두지 않는다.
- 서버에서만 사용한다.

### Step 2. Context builder

`src/lib/copilotContext.ts`

역할:

- 프로젝트, 브랜치, 노드 조회
- 전체 텍스트 컨텍스트 구성
- citation metadata 구성

출력 예시:

- `promptContext: string`
- `citationIndex: Record<string, { label: string; entityId?: string }>`

### Step 3. API route

`src/app/api/projects/[id]/copilot/route.ts`

역할:

- body validation
- 질문 길이 제한
- context 생성
- Gemini 호출
- structured output 파싱
- citation id 검증
- JSON 응답 반환

서버 검증 규칙:

- 빈 질문 금지
- 너무 긴 질문 제한
- 존재하지 않는 project/node 차단
- active project만 허용

### Step 4. Sidebar tab and panel

`ProjectCopilotPanel.tsx`

역할:

- 질문 입력
- 현재 선택 노드 표시
- API 호출
- 답변과 근거 렌더링

### Step 5. UI state

`uiStore.ts`

추가 항목:

- `sidebarTab`에 `copilot`

이번 1차에는 전역 대화 히스토리 state는 넣지 않는다.

## Acceptance Criteria

아래가 되면 1차 목표 달성이다.

- 프로젝트 내부 입력 데이터만 사용해서 답변한다.
- 별도 retrieval 없이 프로젝트 내부 텍스트를 단순 조합해서 답변한다.
- 답변마다 근거 citation이 있다.
- 데이터가 없으면 모른다고 말한다.
- 특정 노드를 선택한 상태에서는 해당 노드 정보가 먼저 포함된다.
- 구조화된 JSON 응답이 안정적으로 파싱된다.

## Test Plan

### Functional

- 프로젝트 전략만 있는 경우 질문 응답
- 브랜치 전략 기반 질문 응답
- 선택 노드 note 또는 prompt 기반 질문 응답
- 내부 데이터에 없는 질문에 대해 `insufficient` 반환

### Guardrails

- archived node 또는 direction이 포함되지 않는지 확인
- citation id가 실제 context 항목과 매칭되는지 확인
- question이 비어 있거나 너무 길면 400 반환

### UX

- 로딩 중 중복 submit 방지
- 답변 실패 시 오류 메시지 노출
- 이전 답변이 남아 있어도 새 요청 상태가 명확히 보이는지 확인

## Recommended Rollout

1. single-turn sidebar copilot
2. citation UI polish
3. 필요 시 multi-turn chat
4. 필요 시 모델 교체 대응

## Final Decision

`gemini-3.1-flash-lite-preview` 기준 계획은 진행 가능하다.

최종 권장안은 아래다.

- 모델은 `gemini-3.1-flash-lite-preview` 사용
- 모델명은 env로 분리
- API는 server-side full context 기반
- structured output 사용
- 별도 retrieval 없음
- 별도 모델 튜닝 없음
- 1차는 single-turn only

이 구성이 현재 요구사항에 가장 단순하고 직접적이다.

## References

- Gemini 3.1 Flash-Lite model guide:
  - https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-preview
- Gemini API quickstart:
  - https://ai.google.dev/gemini-api/docs/quickstart
- Gemini API libraries:
  - https://ai.google.dev/gemini-api/docs/libraries
- Gemini API versions:
  - https://ai.google.dev/gemini-api/docs/api-versions
- Gemini text generation:
  - https://ai.google.dev/gemini-api/docs/text-generation
- Gemini structured output:
  - https://ai.google.dev/gemini-api/docs/structured-output
- Gemini thought signatures:
  - https://ai.google.dev/gemini-api/docs/thought-signatures
