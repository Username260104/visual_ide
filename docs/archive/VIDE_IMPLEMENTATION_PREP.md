# VIDE 개선 적용 준비 문서

작성일: 2026-03-25
기준 문서:
- [VIDE_PURPOSE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_PURPOSE_REVIEW.md)
- [VIDE_CLAUDE_REVIEW.md](C:/Work/Projects/Hire/visual_ide/VIDE_CLAUDE_REVIEW.md)

## 목적

이 문서는 `VIDE_PURPOSE_REVIEW.md`의 개선사항을 실제 코드베이스에 적용하기 전에, 충돌과 회귀를 최소화하기 위한 준비 계획을 정리한다.

핵심 목표는 다음 네 가지다.

1. 큰 구조 변경을 한 번에 밀어 넣지 않는다.
2. 데이터 손실 가능성이 있는 변경을 먼저 안전 장치와 함께 설계한다.
3. PR 경계를 명확히 나눠서 충돌 범위를 줄인다.
4. 현재 코드베이스의 검증 한계를 감안한 수동/자동 점검 절차를 준비한다.

## 현재 상태 요약

### 코드 구조상 중요한 사실

- 프론트 상태는 `Zustand` store 중심이다.
- 주요 쓰기 경로는 `nodeStore`, `directionStore`, 프로젝트 API, 생성 API로 집중되어 있다.
- 현재 mutation UX는 대부분 optimistic update + fire-and-forget이다.
- 생성 파이프라인은 `Replicate -> Supabase Storage -> Node 생성` 순서다.
- Prisma 마이그레이션은 현재 2개뿐이다.
- 테스트 러너는 아직 없다. 현재 공식 검증 수단은 사실상 `build`, `lint`, 수동 검증뿐이다.

근거 파일:

- [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)
- [directionStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/directionStore.ts)
- [GenerateDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx)
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)
- [imageGeneration.ts](C:/Work/Projects/Hire/visual_ide/src/lib/imageGeneration.ts)
- [schema.prisma](C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma)
- [package.json](C:/Work/Projects/Hire/visual_ide/package.json)

### 지금 바로 건드리면 충돌 가능성이 큰 영역

- `Node` 스키마
- node 생성/수정 API
- `nodeStore.updateNode` / `deleteNode`
- 생성 다이얼로그와 variation 패널
- 그래프 캔버스와 우측 패널의 상호작용

이유:

- 이 영역들은 UI, API, DB가 강하게 결합돼 있다.
- 한번에 수정하면 "작동은 하는데 의미가 틀린 상태"를 만들 가능성이 높다.

## 적용 원칙

### 1. 스키마 변경과 UX 변경을 한 PR에 같이 넣지 않는다

스키마가 바뀌는 PR에서는:

- Prisma schema
- migration
- mapper
- type
- API backfill

까지만 바꾸고, 화면 UX는 최소 변경으로 제한한다.

### 2. "기록 신뢰성"을 "기능 확장"보다 먼저 한다

다음은 선행되어야 한다.

- 저장 실패 감지
- 저장 상태 노출
- destructive action 안전화
- monotonic한 버전 규칙 설계

다음은 후행되어도 된다.

- Event 모델 확장
- 비교 화면
- 브랜치 접기
- 전략 브리프 UX

### 3. 기존 데이터와 호환되는 중간 상태를 반드시 거친다

예:

- `prompt`를 곧바로 삭제하지 않고 `userIntent`, `resolvedPrompt`를 추가한 뒤 점진 이전
- hard delete 제거 전에 `archivedAt` 추가
- direction 설명 필드 추가 후 UI 연결

### 4. "되돌릴 수 없는 변경"은 별도 체크포인트를 둔다

되돌릴 수 없는 변경 예시:

- migration 적용
- version 규칙 변경
- delete semantics 변경
- storage cleanup 정책 도입

이런 변경은 적용 전후 확인 항목이 따로 있어야 한다.

## 권장 구현 순서

### Phase 0. 베이스라인 고정

목적:

- 현재 동작을 기준선으로 확정
- 이후 변경이 무엇을 깨뜨렸는지 비교 가능하게 만들기

해야 할 일:

- 주요 화면 플로우 캡처
- 수동 검증 체크리스트 작성
- 대표 시나리오용 seed/demo 데이터 정의
- 빌드/린트 통과 상태 확인

산출물:

- 수동 QA 체크리스트
- 대표 시나리오 목록

### Phase 1. 기록의 정직성 확보

목적:

- "저장된 것처럼 보이지만 실제로는 실패"하는 상태를 제거

범위:

- `nodeStore.updateNode`
- `nodeStore.deleteNode`
- `directionStore.updateDirection`
- `directionStore.deleteDirection`
- 관련 UI에 저장 상태 표시

해야 할 일:

- optimistic update를 유지할지, pessimistic save로 바꿀지 결정
- 실패 시 롤백 전략 수립
- 토스트/인라인 에러 방식 결정
- 마지막 저장 시각 또는 저장 상태 badge 추가

이 단계에서 바꾸지 말 것:

- Event 모델
- prompt 분리
- 스키마 대개편

완료 기준:

- 메모/상태/direction/위치 변경 시 저장 중과 실패가 보인다
- 실패 시 사용자가 놓치지 않는다
- 새로고침 후 "몰래 사라지는 값"이 재현되지 않는다

### Phase 2. destructive action 안전화

목적:

- 삭제와 재분류로 인한 구조 손상을 방지

범위:

- 노드 삭제
- direction 삭제
- 프로젝트 삭제

해야 할 일:

- 영향 요약 모달
- archive-first 정책 도입 여부 결정
- 최소 undo UX 설계
- soft delete schema 초안 마련

권장 순서:

1. UX 먼저: 경고 강화, 영향 개수 표시
2. 그다음 schema: `archivedAt`, `archivedBy` 등
3. 마지막으로 실제 delete semantics 전환

완료 기준:

- 사용자가 삭제가 구조에 미치는 영향을 안다
- archive 흐름이 delete보다 우선 노출된다

### Phase 3. prompt provenance 분리

목적:

- 사용자 의도와 AI 해석을 분리 저장

권장 스키마 변화:

- `Node.userIntent`
- `Node.resolvedPrompt`
- `Node.promptSource`
- 필요 시 `Node.promptTransformMeta`

마이그레이션 전략:

1. 새 필드 추가
2. 기존 `prompt` 값을 `resolvedPrompt`로 백필
3. UI는 당분간 fallback 유지
4. 생성/변형 UI를 새 필드 사용으로 전환
5. 안정화 후 `prompt` 제거 여부 결정

주의:

- 이 단계에서 생성 UI, variation UI, detail panel, API가 모두 함께 바뀐다
- 따라서 한 PR 안에서도 backend-first -> UI 연결 순으로 나눠 작업하는 편이 안전하다

완료 기준:

- AI 개선 전 원문과 최종 프롬프트를 둘 다 확인할 수 있다
- variation 생성의 입력과 출력 관계를 복원할 수 있다

### Phase 4. version 규칙 재설계

목적:

- `versionNumber`가 오해를 만드는 상태를 해소

선결 질문:

- version을 프로젝트 전체 sequence로 볼 것인가
- direction sequence로 볼 것인가
- branch sibling sequence로 볼 것인가
- 사용자 표시용 번호와 시스템 식별용 번호를 분리할 것인가

권장 접근:

- 시스템용 불변 sequence와 UI용 표시 라벨을 분리
- `versionNumber`를 곧바로 재해석하기보다 새 필드 추가

예:

- `sequenceNumber` 또는 `nodeOrdinal`
- `branchOrder`
- 필요 시 `displayVersionLabel`

주의:

- 기존 노드에 대한 backfill 규칙을 먼저 정해야 한다
- 이 단계는 절대 prompt 분리와 같은 PR에 묶지 않는다

### Phase 5. Event 모델 도입

목적:

- 이력, 피드백, 선택 이유를 덮어쓰기 대신 누적 저장

권장 초기 형태:

- 하나의 다형적 `Event` 모델

예시 필드:

- `id`
- `projectId`
- `nodeId`
- `directionId`
- `type`
- `actorType`
- `actorId`
- `payload`
- `createdAt`

초기 이벤트 타입:

- `status-change`
- `note-change`
- `direction-change`
- `decision`
- `feedback`
- `comparison`

이 단계에서 바꾸지 말 것:

- 비교 UI 대규모 구현
- 브랜치 접기
- 검색 전면 개편

먼저 해야 할 것은:

- 이벤트를 "기록"하는 것
- 그다음에야 "보는 UX"를 붙인다

### Phase 6. 생성 결과 스테이징과 비교 UX

목적:

- 생성 결과가 곧바로 그래프를 오염시키지 않게 하기

권장 변경:

- 생성 결과 tray/staging area
- 일괄 채택 / 일괄 폐기
- 부모 연결 전 검토 단계
- 후보 비교 후 노드화

주의:

- 이 단계는 UX 영향이 크므로, 앞선 저장 신뢰성과 provenance 분리가 끝난 뒤 진행해야 한다

### Phase 7. Direction/Project 전략 객체화

목적:

- 방향성과 프로젝트를 단순 라벨이 아니라 의사결정 기준의 저장소로 바꾸기

권장 필드:

- Direction: `thesis`, `fitCriteria`, `antiGoal`, `referenceNotes`
- Project: `brief`, `constraints`, `targetAudience`, `brandTone`

이 단계의 UX:

- Settings 탭 실제 구현
- 생성/변형 UI에서 brief 노출
- direction 변경 시 적합성 검토 유도

## PR 분할 권장안

한 번에 큰 브랜치 하나로 가지 말고, 아래처럼 쪼개는 것을 권장한다.

1. `prep/save-honesty`
2. `prep/archive-safety`
3. `prep/prompt-provenance-schema`
4. `prep/prompt-provenance-ui`
5. `prep/versioning-redesign`
6. `prep/event-model`
7. `prep/staging-ux`
8. `prep/strategy-context`

중요:

- 같은 파일을 여러 브랜치가 동시에 크게 건드리지 않도록 한다.
- 특히 다음 파일은 쓰기 충돌 가능성이 높다.

고충돌 파일:

- [schema.prisma](C:/Work/Projects/Hire/visual_ide/prisma/schema.prisma)
- [types.ts](C:/Work/Projects/Hire/visual_ide/src/lib/types.ts)
- [mappers.ts](C:/Work/Projects/Hire/visual_ide/src/lib/mappers.ts)
- [nodeStore.ts](C:/Work/Projects/Hire/visual_ide/src/stores/nodeStore.ts)
- [GenerateDialog.tsx](C:/Work/Projects/Hire/visual_ide/src/components/layout/GenerateDialog.tsx)
- [VariationPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/VariationPanel.tsx)
- [DetailPanel.tsx](C:/Work/Projects/Hire/visual_ide/src/components/detail/DetailPanel.tsx)

## 데이터 마이그레이션 원칙

### 필드 추가는 additive-first

좋은 예:

- 새 필드 추가
- 구 필드 유지
- 백필
- UI fallback 유지
- 충분히 안정화 후 구 필드 제거

나쁜 예:

- 기존 `prompt`를 즉시 `userIntent`로 rename
- 기존 delete semantics를 즉시 soft delete로 전환

### 백필 대상

- `prompt -> resolvedPrompt`
- 프로젝트 대표 썸네일 후보 계산
- final 노드가 있는 경우 project summary 계산
- 향후 versioning 관련 신규 sequence

### cleanup가 필요한 대상

- 생성 실패 후 고아 storage 파일
- archive 전환 후 숨겨진 노드 검색 범위

## 테스트/검증 준비

현재 테스트 프레임워크가 없다. 따라서 실제 구현 전 아래 준비가 필요하다.

### 최소 자동 검증

- `npm run build`
- `npm run lint`

### 권장 추가

- API 단위 smoke script
- Prisma migration dry-run
- 주요 store mutation 수동 검증 체크리스트

### 반드시 검증할 시나리오

1. 메모 수정 후 저장 실패 재현
2. 상태 변경 후 새로고침 일관성
3. direction 삭제 시 연결 노드 영향 확인
4. 생성 중 일부 실패 시 결과 정합성 확인
5. AI 개선 전/후 프롬프트 비교 확인
6. variation 생성 후 provenance 저장 확인
7. archive 후 그래프/상세/카운트 일관성 확인

## 구현 전 결정이 필요한 항목

아래는 코딩 전에 제품적으로 결론을 내려야 충돌이 줄어드는 질문들이다.

1. `versionNumber`는 사용자에게 계속 보여줄 것인가, 아니면 새 표시 체계로 바꿀 것인가?
2. delete는 완전히 archive-first로 갈 것인가, 관리자만 hard delete를 허용할 것인가?
3. AI 개선은 "덮어쓰기"가 아니라 "제안" UX로 바꿀 것인가?
4. Event 모델은 generic하게 시작할 것인가, 처음부터 `DecisionEvent`, `FeedbackEvent`로 나눌 것인가?
5. 프로젝트 brief는 자유 텍스트로 시작할 것인가, 구조화된 필드로 시작할 것인가?

이 질문들이 정리되지 않으면 구현 도중 같은 파일을 반복 수정하게 된다.

## 바로 시작해도 되는 준비 작업

아직 제품 결정을 완전히 하지 않아도, 다음 작업은 바로 시작 가능하다.

- 저장 상태 UX 초안 설계
- archive 영향 모달 카피 작성
- prompt provenance 스키마 초안 작성
- Event 모델 초안 작성
- 수동 QA 체크리스트 작성

## 권장 실행 순서 요약

가장 안전한 순서는 다음과 같다.

1. 저장 정직성 확보
2. destructive action 안전화
3. prompt provenance 스키마 추가
4. prompt provenance UI 연결
5. version 규칙 재설계
6. Event 기록 계층 도입
7. 생성 결과 스테이징/비교 UX
8. Direction/Project 전략 컨텍스트 확장

## 최종 준비 판단

현재 코드베이스는 구조가 비교적 단순해서, 준비만 잘하면 개선 적용 자체는 가능하다. 다만 다음 두 가지를 지키지 않으면 충돌과 회귀 가능성이 높다.

1. 스키마 개편과 UX 개편을 한 번에 밀어 넣지 말 것
2. "더 많은 기능"보다 "기록의 정직성"을 먼저 해결할 것

즉, 지금 단계에서 필요한 것은 거대한 구현이 아니라, 순서와 경계를 먼저 고정하는 것이다. 이 문서를 기준으로 작업을 나누면, VIDE 개선사항을 비교적 안전하게 적용할 수 있다.
