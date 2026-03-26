# VIDE Phase 6 Staging/Comparison UX 준비 문서

작성일: 2026-03-25

현재 위치:
- 완료: `Phase 1. save honesty`
- 완료: `Phase 2. archive safety`
- 완료: `Phase 3. prompt provenance`
- 완료: `Phase 4. versioning redesign`
- 완료: `Phase 5. event model`
- 다음 단계: `Phase 6. staging/comparison UX`

기준 문서:
- [VIDE_PURPOSE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_IMPLEMENTATION_PREP.md](C:/Work/Projects/Hire/visual_ide/VIDE_IMPLEMENTATION_PREP.md)
- [VIDE_PHASE5_EVENT_MODEL_PLAN.md](C:/Work/Projects/Hire/visual_ide/VIDE_PHASE5_EVENT_MODEL_PLAN.md)

## 1. 문서 목적

이 문서는 VIDE의 다음 단계인 `생성 결과 staging`과 `비교 후 채택 UX`를 구현하기 전에,

1. 무엇을 먼저 분리해야 하는지
2. 어떤 정보를 비교의 단위로 다뤄야 하는지
3. 어디까지를 1차 범위로 제한해야 충돌 없이 적용할 수 있는지

를 고정하기 위한 준비 문서다.

Phase 6은 단순한 UI 미화 단계가 아니다.

> "생성된 후보가 곧바로 작업 자산이 되는 흐름"을  
> "후보를 검토하고 비교한 뒤 채택할 때만 작업 자산이 되는 흐름"으로 바꾸는 단계

즉, Phase 6의 본질은 `생성`과 `채택`을 분리하는 것이다.

## 2. 왜 지금 Phase 6인가

Phase 5까지 오면서 VIDE는 다음을 이미 확보했다.

1. 저장 정직성
2. archive/restore 안전성
3. prompt provenance 분리
4. node ordinal 기반 표시 체계
5. event timeline과 수동 feedback/decision 기록

이제 가장 큰 남은 UX 결손은 다음이다.

- 생성 결과가 즉시 캔버스를 오염시킨다.
- 비교가 시스템 안에서 일어나지 않고 사람 머리 안에서 일어난다.
- 어떤 후보를 왜 버렸는지 구조적으로 남기기 어렵다.
- 최종 선택은 남길 수 있어도 `선택 이전의 후보군`은 잘 남지 않는다.

현재 구현의 핵심 문제는 명확하다.

- [GenerateDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx)는 `generate-image` 결과를 받은 직후 `addNode`로 바로 노드를 만든다.
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)도 variation 결과를 받은 직후 부모-자식 노드로 즉시 붙인다.

즉, 현재 VIDE는 `후보 생성 도구`이면서 동시에 `후보 채택 도구`처럼 행동한다.  
Phase 6은 이 둘을 분리해, 비교와 선택을 시스템 안의 명시적 행위로 만드는 단계다.

## 3. 이번 Phase의 목표

Phase 6에서 달성해야 할 목표는 아래 다섯 가지다.

1. 생성 결과가 곧바로 노드가 되지 않게 한다.
2. 생성 결과를 `staging batch`로 묶어 비교 가능한 상태로 먼저 제시한다.
3. 사용자가 `채택`, `보류`, `폐기`를 명시적으로 선택하게 만든다.
4. 채택 결과와 기각 결과를 `comparison-recorded`로 남길 수 있게 한다.
5. variation 생성에서도 같은 규칙을 적용해, 부모-자식 계보가 자동 생성이 아니라 `비교 후 채택`을 거쳐 만들어지게 한다.

## 4. 이번 Phase에서 하지 않는 것

아래 항목은 Phase 6의 범위에서 의도적으로 제외한다.

- 대규모 전역 비교 화면
- 프로젝트 전체 검색형 comparison explorer
- AI 자동 평가 점수
- 고급 이미지 diff viewer
- 후보별 코멘트 스레드
- 브랜치 접기/펼치기 대개편
- 서버 영속 staging 테이블
- multi-user 동시 검토 세션

즉, 이번 단계는 `비교 가능한 임시 후보 영역`과 `채택 전 체크포인트`를 만드는 것이지,
완전한 DAM이나 review suite를 만드는 단계가 아니다.

## 5. 핵심 제품 원칙

### 5.1 생성과 채택은 분리한다

생성은 `후보를 만든 행위`이고, 채택은 `작업 자산으로 편입한 행위`다.  
이 둘은 같은 버튼 클릭으로 끝나면 안 된다.

권장 규칙:

- 생성 결과는 먼저 staging에 들어간다.
- 노드는 `Accept` 또는 `Accept Selected`를 누를 때만 만들어진다.
- staging에 있는 동안은 아직 계보나 방향을 확정하지 않는다.

### 5.2 비교는 batch 단위로 다룬다

한 번의 생성 또는 한 번의 variation 요청은 `batch`다.  
비교와 선택은 개별 이미지가 아니라 batch를 중심으로 일어난다.

권장 batch 정보:

- `batchId`
- `sourceKind`: `generate-dialog | variation-panel`
- `projectId`
- `parentNodeId`
- `directionId`
- `userIntent`
- `resolvedPrompt`
- `modelId`
- `aspectRatio`
- `createdAt`
- `candidates[]`

### 5.3 rejected candidate도 의미를 가진다

기각된 후보도 "없던 일"이 아니다.  
특히 브랜딩 에이전시 문맥에서는 버린 이유가 다음 판단의 기준이 된다.

따라서 Phase 6에서는 최소한 아래 정보는 남겨야 한다.

- 어떤 후보군을 비교했는가
- 무엇을 채택했는가
- 무엇을 기각했는가
- 왜 그런 선택을 했는가

### 5.4 additive-first로 간다

Phase 6의 1차 구현에서는 스키마를 크게 넓히지 않는다.

권장 이유:

- Phase 5의 event model을 이미 확보했다.
- `comparison-recorded` payload만으로도 1차 지식 기록이 가능하다.
- 곧바로 `CandidateAsset`, `GenerationSession` 같은 테이블을 추가하면 범위가 급격히 커진다.

즉, 1차는 `client staging + event payload + accept pipeline`으로 간다.

## 6. 권장 설계

## 6.1 권장 접근: client-local staging first

1차 권장안은 `서버 staging 테이블 없이`, 클라이언트에 batch를 유지하고 채택 시점에만 node를 만드는 방식이다.

장점:

- schema migration 없이 시작할 수 있다.
- 기존 `generate-image`, `generate-variation` API를 크게 바꾸지 않아도 된다.
- 충돌면이 주로 `GenerateDialog`, `VariationPanel`, 새 staging store, accept pipeline에 집중된다.

한계:

- 새로고침 전까지의 staged 결과는 메모리 기반이다.
- 브라우저 reload 시 staging 결과를 잃을 수 있다.

이 한계는 1차에서 아래 UX로 관리한다.

- staging 결과가 남아 있을 때 닫기/이동 시 경고
- staging batch는 명시적으로 `채택` 또는 `폐기`하도록 유도

## 6.2 왜 server-persisted staging을 지금 하지 않는가

서버 영속 staging은 장기적으로 검토할 가치가 있지만, 지금은 비용이 크다.

추가로 필요해지는 것:

- `StagingBatch`, `StagingCandidate` 스키마
- cleanup 정책
- restore/archive와의 관계
- orphan storage 정리 정책
- timeline과 staging 엔티티의 관계 정리

Phase 6의 1차 목적은 `캔버스 오염 방지 + 비교 후 채택`이므로,
지금은 서버 staging까지 확장하지 않는 것이 안전하다.

## 6.3 comparison 기록은 event payload로 남긴다

Phase 5에서 이미 `comparison-recorded`가 타입에 포함되어 있으므로,
Phase 6에서는 이 타입을 실제 쓰기 경로로 연결한다.

권장 payload:

```json
{
  "batchId": "batch_x",
  "sourceKind": "variation-panel",
  "projectId": "proj_1",
  "parentNodeId": "node_parent",
  "directionId": "dir_1",
  "userIntent": "차갑고 정제된 방향으로",
  "resolvedPrompt": "premium serum bottle on clean acrylic...",
  "modelId": "flux-schnell",
  "aspectRatio": "1:1",
  "candidates": [
    {
      "tempId": "cand_1",
      "imageUrl": "https://...",
      "index": 0
    },
    {
      "tempId": "cand_2",
      "imageUrl": "https://...",
      "index": 1
    }
  ],
  "acceptedCandidateIds": ["cand_2"],
  "rejectedCandidateIds": ["cand_1"],
  "acceptedNodeIds": ["node_101"],
  "rationale": "카피 공간과 제품 존재감의 균형이 가장 좋음"
}
```

이 구조의 장점:

- 스키마 확장 없이 비교 흔적을 남길 수 있다.
- rejected 후보도 URL 기준으로 payload에 남길 수 있다.
- 나중에 필요하면 이 payload를 별도 테이블로 승격할 수 있다.

## 6.4 variation은 채택 시점에만 계보를 만든다

현재 variation은 생성 직후 자식 노드를 만든다.  
Phase 6 이후에는 다음 규칙으로 바꾼다.

- variation 결과도 먼저 staging batch에 들어간다.
- 채택된 후보만 `parentNodeId = 원본 노드`로 자식 생성된다.
- 채택 전까지는 부모-자식 관계가 확정되지 않는다.

이 원칙이 중요한 이유:

- 계보는 생성 결과 자체가 아니라 `선택된 결과`를 기준으로 남아야 한다.
- 그렇지 않으면 트리는 다시 후보 더미로 오염된다.

## 6.5 채택 시 metadata inheritance를 명시한다

variation batch에서 채택 시 기본 상속 규칙은 아래와 같다.

- `parentNodeId`: 원본 노드
- `directionId`: 부모 노드의 direction 기본 상속
- `prompt`: batch의 resolved prompt
- `userIntent`: batch의 userIntent
- `promptSource`: `variation-derived`
- `intentTags`, `changeTags`, `note`: batch 입력값 상속

초기 권장안:

- 1차에서는 batch 단위 상속만 허용
- 후보별 개별 메타데이터 편집은 하지 않음

## 7. 권장 UX 구조

## 7.1 Stage 1 surface

1차 surface는 아래 두 곳이면 충분하다.

- [GenerateDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx) 하단 또는 직후의 staging tray
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx) 안의 variation staging tray

핵심은 "결과를 어디서 본다"가 아니라 "캔버스에 들어가기 전 어디에 임시 보관하느냐"다.

## 7.2 tray에서 보여줄 최소 정보

각 candidate 카드에는 아래 정도면 충분하다.

- 썸네일
- batch 내 순번
- model
- aspect ratio
- user intent 또는 prompt 요약
- 선택 상태

1차에서는 아래 항목은 제외한다.

- 고급 zoom/pan
- 후보별 긴 메모
- 후보별 세부 diff

## 7.3 최소 액션

1차에서 꼭 필요한 액션은 아래 다섯 가지다.

- `Accept Selected`
- `Accept One`
- `Discard Selected`
- `Discard Batch`
- `Compare`

권장 규칙:

- `Accept Selected`는 노드 생성까지 수행한다.
- `Discard Batch`는 캔버스에는 아무 영향 없이 tray만 닫는다.
- discard 시 rationale 입력은 선택형으로 두되, compare를 거친 경우에는 rationale 입력을 권장한다.

## 7.4 comparison UX 최소안

1차 comparison은 별도 대형 화면이 아니라 `선택 모드 + 비교 패널` 수준이면 충분하다.

권장 흐름:

1. staging tray에서 2~4개 후보 선택
2. 비교 모드 진입
3. 나란히 보기
4. `선택`, `기각`, `보류` 중 하나 선택
5. 필요 시 rationale 입력
6. `comparison-recorded` 기록
7. 채택된 후보만 node 생성

## 7.5 close behavior

staging batch가 남아 있을 때는 조용히 닫히면 안 된다.

권장 규칙:

- 닫기/이동 시 경고
- 메시지 예시:
  - "아직 채택하지 않은 생성 결과가 있습니다."
  - "지금 닫으면 이 후보 비교 상태는 사라집니다."

1차에서는 local staging이므로 이 경고가 중요하다.

## 8. 상태 모델 권장안

## 8.1 새 store 분리 권장

권장 파일:

- `src/stores/stagingStore.ts`

이유:

- `uiStore`는 이미 선택 상태, 저장 피드백, sidebar/dialog 상태를 담고 있다.
- staging까지 `uiStore`에 넣으면 의미가 섞이고 책임이 커진다.

권장 상태:

```ts
interface StagingBatch {
  id: string;
  sourceKind: 'generate-dialog' | 'variation-panel';
  projectId: string;
  parentNodeId: string | null;
  directionId: string | null;
  userIntent: string | null;
  resolvedPrompt: string | null;
  modelId: string | null;
  aspectRatio: string | null;
  createdAt: number;
  candidates: StagingCandidate[];
}

interface StagingCandidate {
  id: string;
  imageUrl: string;
  index: number;
  selected: boolean;
  status: 'staged' | 'accepted' | 'discarded';
}
```

## 8.2 node 생성은 staging store 밖에서 수행

`stagingStore`는 후보를 담고 선택 상태를 관리한다.  
실제 node 생성은 기존 [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)의 `addNode`를 사용한다.

즉,

- staging store는 임시 후보 관리자
- node store는 확정 자산 생성기

로 역할을 분리한다.

## 9. API 권장안

## 9.1 generate API는 유지

1차에서는 아래 경로를 크게 바꾸지 않는다.

- `/api/generate-image`
- `/api/generate-variation`

이유:

- 현재도 이 두 경로는 이미지 URL만 반환하고 있다.
- 문제는 서버보다 클라이언트가 응답 직후 `addNode`를 호출하는 쪽에 있다.

즉, Phase 6의 핵심 변화는 API보다 client flow에 있다.

## 9.2 events POST 허용 범위 확장

현재 [events/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/events/route.ts)는 수동 입력으로

- `feedback-recorded`
- `decision-recorded`

만 허용한다.

Phase 6에서는 아래를 추가해야 한다.

- `comparison-recorded`

권장 이유:

- 비교 후 선택이 Phase 6의 핵심 행위이기 때문이다.
- 이 이벤트가 없으면 rejected candidate가 다시 기록 밖으로 밀려난다.

## 10. PR 분할 권장안

Phase 6은 최소 3개, 권장 4개 PR로 나누는 것이 안전하다.

### PR A. staging store + client flow redirect

범위:

- `stagingStore` 추가
- `GenerateDialog` 결과를 즉시 `addNode`하지 않고 staging batch로 전환
- `VariationPanel`도 같은 흐름으로 전환

목표:

- "생성 즉시 노드 생성" 규칙을 끊는다.

### PR B. staging tray UI + accept/discard UX

범위:

- tray UI
- candidate 선택
- batch 닫기 경고
- accept/discard 액션

목표:

- 후보를 캔버스 밖에서 검토할 수 있게 만든다.

### PR C. accept pipeline + comparison event write

범위:

- accepted candidate -> `addNode`
- `comparison-recorded` event write
- rationale 입력 최소 UI

목표:

- 선택 이유와 기각 이유가 시스템 안에 남게 만든다.

### PR D. polish + smoke verification

범위:

- status copy
- keyboard shortcut 가능 시 추가
- 비교 화면 마감도 개선
- 수동 smoke test 문서화

목표:

- 실제 디자이너 작업 흐름에서 불안 요소를 줄인다.

## 11. 충돌 위험 파일

Phase 6에서 충돌 가능성이 높은 파일은 아래와 같다.

- [GenerateDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx)
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)
- [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)
- [uiStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/uiStore.ts)
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)
- [events/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/events/route.ts)
- [types.ts](C:/Work/Projects/Hire/visual_ide/src/lib/types.ts)
- [activityEvents.ts](C:/Work/Projects/Hire/visual_ide/src/lib/activityEvents.ts)

따라서 권장 원칙은 아래와 같다.

- `stagingStore`는 새 파일로 분리
- `GenerateDialog`와 `VariationPanel`은 같은 PR에서만 함께 수정
- `events POST`의 kind 확장은 Phase 6 PR C에서만 수행

## 12. 수동 검증 체크리스트

### 생성 staging

- 생성 4장을 실행해도 캔버스에 노드가 즉시 생기지 않는다.
- staging tray에만 후보가 보인다.
- tray를 닫으려 하면 경고가 뜬다.

### 채택

- 후보 1장만 채택하면 정확히 1개의 node만 생긴다.
- 여러 장 채택하면 각 후보가 개별 node로 생긴다.
- 생성형 batch의 경우 root node로 들어간다.

### variation 채택

- variation batch를 채택하면 채택된 후보만 자식 node가 된다.
- 부모 node와 direction이 의도대로 상속된다.
- 채택하지 않은 후보는 계보에 들어가지 않는다.

### comparison 기록

- compare 후 rationale을 남기면 `comparison-recorded` 이벤트가 생긴다.
- payload에 accepted/rejected candidate 정보가 들어간다.
- accepted node가 있다면 해당 node와 연결 정보가 남는다.

### 캔버스 오염 방지

- discard batch 시 node가 생기지 않는다.
- batch를 여러 번 생성해도 accept 전까지 그래프가 무한히 늘어나지 않는다.

### 전체

- `npm run lint`
- `npm run build`

## 13. 완료 기준

Phase 6은 아래 조건을 만족하면 완료로 본다.

1. 생성 결과가 즉시 node가 되지 않는다.
2. 사용자가 staging 영역에서 후보를 먼저 비교할 수 있다.
3. 채택된 후보만 node로 생성된다.
4. variation도 같은 규칙을 따른다.
5. 비교 결과가 최소 1개의 `comparison-recorded` event로 남는다.
6. discard된 후보가 조용히 사라지는 대신 비교 기록 payload에 포함될 수 있다.

## 14. 권장 결정

Phase 6에 들어가기 전에 아래 결정은 고정하는 것을 권장한다.

1. 1차는 `client-local staging`으로 간다.
2. 1차는 새 schema를 만들지 않고 `comparison-recorded payload`로 비교 흔적을 남긴다.
3. variation도 즉시 자식 생성하지 않고 staging을 거친다.
4. 1차에서는 후보별 개별 메타데이터 편집을 하지 않고 batch 단위 상속만 허용한다.
5. staged 결과는 reload persistence를 지원하지 않고, 대신 close/navigation 경고를 제공한다.

## 15. 다음 착수 권장점

가장 자연스러운 다음 단계는 이 문서 기준의 `PR A: staging store + client flow redirect`다.

즉, 다음 작업은 다음 순서가 가장 안전하다.

1. `stagingStore` 추가
2. `GenerateDialog`의 즉시 `addNode` 제거
3. `VariationPanel`의 즉시 `addNode` 제거
4. tray 없이도 내부적으로 staging batch가 생기도록 먼저 구조 고정
5. 그 다음 PR에서 tray UI를 붙이기

이 순서가 좋은 이유는, `새 UX를 보이기 전에 먼저 흐름의 의미를 바꿀 수 있기 때문`이다.
