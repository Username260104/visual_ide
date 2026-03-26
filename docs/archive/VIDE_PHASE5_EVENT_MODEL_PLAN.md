# VIDE Phase 5 Event 모델 준비 문서
작성일: 2026-03-25
현재 위치:
- 완료: `Phase 1. save honesty`
- 완료: `Phase 2. archive safety`
- 완료: `Phase 3. prompt provenance`
- 완료: `Phase 4. versioning redesign`
- 다음 단계: `Phase 5. event model`

기준 문서:
- [VIDE_PURPOSE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_IMPLEMENTATION_PREP.md](C:/Work/Projects/Hire/visual_ide/VIDE_IMPLEMENTATION_PREP.md)
- [VIDE_PHASE4_VERSIONING_PLAN.md](C:/Work/Projects/Hire/visual_ide/VIDE_PHASE4_VERSIONING_PLAN.md)

## 1. 문서 목적
이 문서는 VIDE의 다음 핵심 단계인 `Event 모델` 도입을 구현하기 전에, 무엇을 기록하고 어디서 기록하며 어떤 단위로 읽게 할지를 충돌 없이 고정하기 위한 준비 문서다.

Phase 5의 본질은 단순히 테이블 하나를 추가하는 것이 아니다.

> "노드 상태"를 저장하는 시스템에서 "의사결정 흔적"을 남기는 시스템으로 넘어가는 첫 단계

즉 Phase 5는 다음 질문에 답해야 한다.

1. 디자이너가 무엇을 했는가
2. 왜 그렇게 했는가
3. 어떤 피드백이 영향을 주었는가
4. 어떤 선택지가 있었고 무엇이 버려졌는가
5. 이 기록을 나중에 어떻게 다시 읽고 재사용할 것인가

## 2. 현재 상태 요약
Phase 1~4를 거치며 VIDE는 아래 기반을 확보했다.

1. 저장 실패를 숨기지 않는다.
2. 삭제는 archive 의미로 안전화되었다.
3. `userIntent`와 `resolvedPrompt`가 분리되었다.
4. `nodeOrdinal`을 통해 노드의 고유 순번이 branch 의미와 분리되었다.

이제 남은 공백은 명확하다.

- 현재 노드는 "현재 상태"는 보여주지만 "그 상태가 되기까지의 사건"은 거의 남기지 않는다.
- `statusReason`, `note`, `intentTags`, `changeTags`는 일부 맥락을 담지만, 사건 단위의 시간 순서와 actor와 근거를 보존하지 못한다.
- feedback, decision, comparison은 아직 1급 데이터가 아니다.

따라서 Phase 5는 새로운 지식 계층을 여는 단계다.

## 3. 이번 Phase의 목표
Phase 5에서 달성해야 하는 목표는 아래 다섯 가지다.

1. 사건을 `현재 상태`와 분리해 별도 레코드로 남긴다.
2. 이벤트 기록을 클라이언트 추정이 아니라 서버 authoritative write로 만든다.
3. 기존 mutation 경로와 event 기록을 같은 트랜잭션 안에서 처리한다.
4. 자동 기록 이벤트와 수동 작성 이벤트를 같은 모델 위에 올린다.
5. 최소한의 timeline 읽기 UX를 제공한다.

## 4. 이번 Phase에서 하지 않는 것
이번 단계에서 의도적으로 하지 않는 것은 아래와 같다.

- 대규모 comparison 화면
- 자동 요약 AI
- 조직 지식 검색 엔진
- 전문적인 권한/계정 시스템
- 피드백의 다대다 정규화 테이블
- branch 접기/비교/staging tray

즉 이번 Phase는 `기억을 남기는 뼈대`를 만드는 단계이지, `기억을 활용하는 고급 UX`를 완성하는 단계가 아니다.

## 5. 핵심 설계 원칙
### 5.1 서버 authoritative logging
이벤트는 클라이언트 store에서 "성공한 것 같으니 남기는" 방식으로 기록하면 안 된다.

권장 원칙:

- 이벤트는 mutation이 실제로 성공하는 서버 경로에서만 기록한다.
- `nodeStore`, `directionStore`는 이벤트 생성자가 아니라 결과 소비자다.
- 클라이언트는 이벤트를 직접 조립하지 않고, 필요한 경우에만 수동 입력 payload를 서버에 전달한다.

### 5.2 mutation과 event는 같은 트랜잭션
DB mutation과 event insert는 같은 Prisma transaction 안에서 처리해야 한다.

이유:

- 상태는 바뀌었는데 event가 안 남는 상황을 막아야 한다.
- event만 남고 실제 state가 실패하는 상황도 막아야 한다.
- VIDE의 핵심 가치는 "정직한 기록"이므로 best-effort logging은 맞지 않는다.

### 5.3 이벤트는 immutable
이벤트는 원칙적으로 수정하지 않는다.

권장 규칙:

- 잘못된 판단이 있더라도 원본 event를 덮어쓰지 않는다.
- 정정은 새 event로 남긴다.
- timeline은 "무엇이 바뀌었는지"보다 "무슨 일이 있었는지"를 보게 해야 한다.

### 5.4 fake backfill 금지
Phase 5 이전의 노드들에 대해 가짜 이력을 만들어서는 안 된다.

권장 규칙:

- 기존 데이터에는 event를 소급 재구성하지 않는다.
- 필요하면 project 또는 UI 레벨에서 "이벤트 기록은 Phase 5 이후부터 제공" 배지를 붙인다.
- 추정으로 만든 history는 정직성 원칙과 충돌한다.

### 5.5 generic event + typed payload
초기에는 `DecisionEvent`, `FeedbackEvent` 같은 개별 테이블로 쪼개지 말고, 하나의 generic event 모델 위에 typed payload를 두는 것이 안전하다.

이유:

- 현재 제품은 아직 actor/auth/comparison 구조가 고정되지 않았다.
- event 종류는 Phase 6, 7에서 계속 늘어날 가능성이 높다.
- generic event는 additive-first migration에 유리하다.

## 6. 권장 데이터 모델
### 6.1 Prisma 모델 권장안
권장 모델명은 `ActivityEvent`다.

`Event`보다 `ActivityEvent`가 나은 이유:

- 브라우저/React의 `Event` 타입과 혼동이 적다.
- timeline/activity UX와 의미가 더 자연스럽게 맞는다.

초기 권장 스키마:

```prisma
model ActivityEvent {
  id          String   @id @default(cuid())
  projectId   String   @map("project_id")
  nodeId      String?  @map("node_id")
  directionId String?  @map("direction_id")

  kind        String
  actorType   String?  @map("actor_type")
  actorLabel  String?  @map("actor_label")
  source      String   @default("system")
  summary     String?
  payload     Json

  createdAt   DateTime @default(now()) @map("created_at")

  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  node      Node?     @relation(fields: [nodeId], references: [id], onDelete: SetNull)
  direction Direction? @relation(fields: [directionId], references: [id], onDelete: SetNull)

  @@index([projectId, createdAt])
  @@index([projectId, kind])
  @@index([nodeId, createdAt])
  @@index([directionId, createdAt])
  @@map("activity_events")
}
```

### 6.2 relation 권장안
기존 모델에는 아래 관계를 추가하는 정도로 충분하다.

```prisma
model Project {
  events ActivityEvent[]
}

model Node {
  events ActivityEvent[]
}

model Direction {
  events ActivityEvent[]
}
```

### 6.3 payload 전략
1차에서는 secondary relation을 별도 join table로 빼지 않고 `payload` 안에 배열로 둔다.

예:

- `candidateNodeIds`
- `rejectedNodeIds`
- `relatedFeedbackIds`
- `fromSnapshot`
- `toSnapshot`

이 방식은 초기에 가장 덜 충돌하고, 나중에 정말 필요할 때만 정규화할 수 있다.

## 7. 초기 이벤트 카탈로그
### 7.1 자동 기록 이벤트
이벤트는 우선 현재 이미 존재하는 mutation부터 자동 기록하는 것이 안전하다.

초기 자동 이벤트 권장 목록:

- `node-created`
- `node-reparented`
- `node-status-changed`
- `node-direction-changed`
- `node-note-saved`
- `node-archived`
- `node-restored`
- `direction-archived`
- `direction-restored`
- `project-archived`
- `project-restored`

### 7.2 수동 작성 이벤트
Phase 5에서 최소한의 수동 입력 event는 열어두는 것이 좋다.

초기 수동 이벤트 권장 목록:

- `feedback-recorded`
- `decision-recorded`

### 7.3 보류 이벤트
아래 이벤트는 개념은 Phase 5에서 정의하되, 실제 UI/입력 흐름은 뒤로 미룬다.

- `comparison-recorded`
- `prompt-diff-summarized`
- `brief-updated`
- `direction-thesis-updated`

## 8. payload 권장 구조
### 8.1 상태 변경
```json
{
  "fromStatus": "reviewing",
  "toStatus": "promising",
  "statusReason": "선택 이유"
}
```

### 8.2 방향 변경
```json
{
  "fromDirectionId": "dir_old",
  "toDirectionId": "dir_new",
  "fromDirectionName": "Old",
  "toDirectionName": "New"
}
```

### 8.3 메모 저장
```json
{
  "before": "이전 메모",
  "after": "새 메모"
}
```

### 8.4 피드백 기록
```json
{
  "sourceType": "client",
  "sourceLabel": "Client round 2",
  "text": "제품 존재감이 더 필요함",
  "dimensions": ["product-presence", "tone"],
  "relatedNodeIds": ["node_a", "node_b"]
}
```

### 8.5 결정 기록
```json
{
  "decisionType": "final-selection",
  "chosenNodeId": "node_21",
  "candidateNodeIds": ["node_18", "node_21", "node_26"],
  "rejectedNodeIds": ["node_18", "node_26"],
  "rationale": "제품 존재감과 브랜드 적합성이 가장 높음"
}
```

## 9. actor 모델 권장안
현재 VIDE에는 정식 auth/user 모델이 없다. 따라서 Phase 5는 auth를 기다리면 안 된다.

권장 접근:

- `actorType`: `system | designer | director | client | unknown`
- `actorLabel`: 자유 텍스트, optional

초기 규칙:

- 자동 이벤트는 `actorType = system`
- 수동 feedback/decision은 입력 시 source를 받되, 로그인 사용자 모델은 아직 연결하지 않는다

즉 Phase 5는 "누가 남겼는지의 의미"만 먼저 열고, 실제 사용자 계정과의 연결은 뒤로 미룬다.

## 10. 쓰기 경로 설계
### 10.1 권장 helper
새 공용 helper를 하나 두는 것이 안전하다.

권장 파일:

- `src/lib/activityEvents.ts`

권장 책임:

- event payload validate
- summary 기본 생성
- Prisma insert helper
- mutation route 안에서 transaction에 결합

### 10.2 write 위치
이벤트는 아래 서버 경로에서 생성하는 것이 권장된다.

- [nodes/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/route.ts)
- [[nodeId]/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/route.ts)
- [[nodeId]/restore/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/nodes/[nodeId]/restore/route.ts)
- [directions/[dirId]/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/directions/[dirId]/route.ts)
- [directions/[dirId]/restore/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/directions/[dirId]/restore/route.ts)
- [[id]/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/route.ts)
- [projects/[id]/restore/route.ts](C:/Work/Projects/Hire/visual_ide/src/app/api/projects/[id]/restore/route.ts)

핵심 원칙:

- `updateNode` 성공 후 클라이언트에서 event를 따로 쓰지 않는다.
- route 내부에서 before/after snapshot을 구한 뒤 transaction으로 state + event를 함께 쓴다.

### 10.3 실패 정책
권장 정책은 아래와 같다.

- state write 실패: event도 없어야 한다
- event write 실패: state도 rollback 되어야 한다

즉 둘 중 하나라도 실패하면 전체 mutation을 실패로 돌린다.

## 11. 읽기 UX 권장안
### 11.1 최소 읽기 UX
Phase 5에서 필요한 읽기 UX는 "전면 activity 시스템"이 아니라 `선택한 대상을 따라가는 작은 timeline`이다.

권장 1차 surface:

- 선택 노드의 detail panel 안 `Activity` 섹션
- project settings 또는 sidebar 안 `Recent Activity` 최소 목록

### 11.2 권장 표시 항목
timeline row는 아래만 보여주면 충분하다.

- 이벤트 종류
- 한 줄 요약
- 상대 시각 또는 날짜
- 관련 actor/source

예:

- `상태 변경 · reviewing -> promising`
- `피드백 기록 · client round 2`
- `최종안 선정 · v21 선택`

### 11.3 이번 단계에서 하지 않는 UX
- timeline 필터 고도화
- event diff viewer
- comparison matrix
- project-wide 검색

## 12. API 권장안
### 12.1 읽기 API
권장 경로:

- `GET /api/projects/[id]/events`

지원 query 예:

- `nodeId`
- `directionId`
- `kind`
- `limit`

### 12.2 수동 기록 API
권장 경로:

- `POST /api/projects/[id]/events`

초기 허용 kind:

- `feedback-recorded`
- `decision-recorded`

자동 이벤트는 public POST로 쓰지 않고 내부 route helper에서만 남기는 편이 낫다.

## 13. migration 및 backfill 원칙
### 13.1 additive-first
Phase 5도 기존 원칙을 유지한다.

1. `ActivityEvent` 테이블 추가
2. read API 추가
3. write helper 추가
4. 기존 mutation route에 점진 연결
5. 최소 timeline UI 연결

### 13.2 backfill 금지
초기에는 기존 node/direction/project에 대해 이벤트를 backfill 하지 않는다.

이유:

- 신뢰할 수 있는 before/after 정보가 없다.
- 시점 순서와 actor를 복원할 수 없다.
- 가짜 history는 review 문서의 핵심 원칙과 충돌한다.

필요하다면 UI에서 아래 문구 정도만 보여주면 충분하다.

> 이 프로젝트의 이벤트 기록은 Phase 5 적용 이후부터 제공됩니다.

## 14. PR 분할 권장안
Phase 5는 최소 3개, 권장 4개 PR로 나누는 것이 안전하다.

### PR A. schema + type + read API
범위:

- Prisma schema
- migration
- event type 정의
- mapper
- `GET /events`

목표:

- event 읽기 기반만 먼저 연다

### PR B. server write helper + auto events
범위:

- `src/lib/activityEvents.ts`
- node/direction/project mutation route 계측
- transaction 정리

목표:

- 현재 존재하는 mutation들이 자동으로 흔적을 남기게 한다

### PR C. minimal timeline UI
범위:

- detail panel activity section
- recent activity 최소 surface

목표:

- 기록을 실제로 읽을 수 있게 만든다

### PR D. manual feedback/decision capture
범위:

- feedback 입력 다이얼로그
- decision 입력 다이얼로그
- `POST /events`

목표:

- 자동 event만이 아니라 실제 암묵지 입력 통로를 연다

## 15. 충돌 위험 파일
다음 파일들은 충돌 가능성이 높다.

- [schema.prisma](C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma)
- [types.ts](C:/Work/Projects/Hire/visual_ide/src/lib/types.ts)
- [mappers.ts](C:/Work/Projects/Hire/visual_ide/src/lib/mappers.ts)
- [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)
- [directionStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/directionStore.ts)
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)
- [Sidebar.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/Sidebar.tsx)

특히 `schema`, `route`, `detail panel`은 한 번에 같은 PR에서 크게 흔들지 않는 편이 안전하다.

## 16. 수동 검증 체크리스트
### 자동 이벤트
- 상태 변경 시 정확히 1개의 `node-status-changed` event가 남는다
- 저장 실패 시 event가 남지 않는다
- 부모 변경 시 `node-reparented` event가 남는다
- archive/restore 시 대상 event가 순서대로 남는다

### 수동 이벤트
- feedback 저장 시 source/text/relatedNodeIds가 그대로 남는다
- decision 저장 시 chosen/rejected 관계가 payload에 보존된다

### 읽기 UX
- 최신순 정렬이 안정적이다
- legacy node는 빈 timeline으로 보이고 가짜 event가 생기지 않는다
- node timeline과 project timeline이 서로 충돌하지 않는다

### 전체
- `npm run lint`
- `npm run build`

## 17. 완료 기준
Phase 5는 아래 조건이 만족되면 완료로 본다.

1. 주요 mutation이 서버에서 자동 event를 남긴다
2. event 기록이 state write와 같은 transaction 안에 묶인다
3. 최소한 node 기준 timeline을 읽을 수 있다
4. feedback 또는 decision 중 적어도 하나의 수동 이벤트 입력 경로가 열린다
5. 기존 데이터에 대해 fake backfill이 없다

## 18. 다음 Phase와의 연결
Phase 5가 끝나면 다음 `Phase 6: staging/comparison UX`가 훨씬 안전해진다.

이유:

- 후보 비교 결과를 어디에 남길지 이미 event 모델이 준비된다
- 선택/기각 이유를 comparison payload로 자연스럽게 연결할 수 있다
- 이후 project knowledge layer는 event aggregation 위에서 확장하면 된다

## 19. 권장 결론
Phase 5는 곧바로 UI를 크게 만들기보다, 먼저 아래 순서로 가는 것이 가장 안전하다.

1. `ActivityEvent` 스키마와 read API부터 추가
2. mutation route를 transaction 기반 auto event로 계측
3. 최소 timeline 읽기 UX 연결
4. 마지막에 feedback/decision 수동 입력 추가

즉 다음 착수는 **문서 기준의 `PR A: schema + type + read API`** 가 가장 자연스럽다.
