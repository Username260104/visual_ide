# VIDE — 제품 정의 + 구현 가이드

## 이 제품이 뭔가

AI로 이미지를 생성하면 버전이 쏟아진다. 각 이미지에는 "왜 만들었는지, 뭘 바꿨는지, 어떤 반응이었는지, 왜 선택했거나 버렸는지"라는 맥락이 있다. 현재 이 맥락은 파일명, 폴더, 디자이너의 기억 속에 흩어져 있고, 프로젝트가 끝나면 사라진다.

VIDE는 이미지를 **파일이 아니라 메타데이터가 붙은 노드**로 다루는 도구다. 노드 간 부모-자식 관계로 버전과 분기를 자동 추적하고, 각 노드에 의도·상태·피드백을 구조화해서 기록한다.

## 코어 = 노드 + 메타데이터 + 관계 + 시각화

이미지가 시스템에 들어오는 순간 노드가 된다.
노드는 다른 노드의 자식이 될 수 있다.
노드에는 구조화된 메타데이터가 붙는다.
이 관계를 그래프로 본다.

이것이 전부다.

---

## 이미지 유입 경로 (2가지)

### 경로 1: AI 초기 생성
프로젝트 시작 시 키워드/컨셉을 입력하면 AI가 이미지 6장을 생성한다.
각 이미지가 루트 노드로 자동 등록된다.
→ "빈 그래프를 빠르게 채워주는 시작점" 역할.

### 경로 2: 이미지 드롭
Midjourney, DALL-E, Photoshop 등 어디서 만든 이미지든 드래그 앤 드롭으로 넣는다.
새 루트 노드로 등록하거나, 기존 노드의 자식으로 연결한다.
→ "도구를 가리지 않는 범용 유입" 역할.

---

## 노드 스키마

```
Node {
  id: string
  imageUrl: string
  createdAt: timestamp

  // 계보
  parentNodeId: string | null    // null이면 루트
  directionId: string | null     // 소속 방향. null이면 미분류

  // 유입 정보
  source: 'ai-generated' | 'imported'
  prompt: string | null          // AI 생성일 경우
  seed: number | null

  // 의도 (핵심 — 이게 암묵지를 명시지로 바꾸는 부분)
  intentTags: string[]           // ['색감 조정', '구도 정리'] — 칩 선택
  changeTags: string[]           // ['배경', '조명'] — 칩 선택
  note: string                   // 자유 메모 1줄

  // 상태
  status: 'unclassified' | 'reviewing' | 'promising' | 'final' | 'dropped'
  statusReason: string | null    // 최종 or 탈락 시 이유

  // 자동 메타
  versionNumber: number          // 같은 Direction 내 순번
}
```

## Direction (방향)

```
Direction {
  id: string
  name: string       // "Water Drop", "Botanical"
  color: string      // hex, 그래프에서 시각 구분
  nodeCount: number  // 자동 집계
}
```

---

## 화면 구조

```
┌─ Title Bar ────────────────────────────────────────────┐
├────┬──────────┬──────────────────────────┬─────────────┤
│    │          │                          │             │
│ A  │ Sidebar  │    NODE GRAPH            │  Detail     │
│ B  │          │                          │  Panel      │
│    │ 방향     │    부모-자식 관계를       │             │
│    │ 목록     │    그래프로 시각화        │  노드       │
│    │          │                          │  선택시     │
│    │          │                          │  열림       │
│    │          │                          │             │
├────┴──────────┴──────────────────────────┴─────────────┤
│ Status Bar                                             │
└────────────────────────────────────────────────────────┘
```

### Activity Bar (좌측 48px)
아이콘 2개만:
1. Directions — 방향 목록
2. Settings

### Sidebar (260px, 접기 가능)
- 방향 목록 (컬러 dot + 이름 + 노드 수)
- 미분류 노드 수
- "초기 이미지 생성" 버튼 (AI 경로 진입점)
- "이미지 추가" 버튼 (드롭 경로 진입점)

### Node Graph (중앙 메인)
- React Flow 기반
- 노드 = 이미지 썸네일 카드
- 엣지 = 부모-자식 연결선 (Direction 컬러)
- 노드 카드에 표시: 썸네일, 버전 번호, 상태 dot, Direction 컬러 바
- 노드 클릭 → Detail Panel 열림
- 노드 우클릭 → "변형 만들기" / "새 방향" / "상태 변경"
- 그래프 위에 이미지 드래그 앤 드롭 → 이미지 추가 플로우

### Detail Panel (우측 340px, 노드 선택시 열림)
표시 순서:
1. 이미지 (크게)
2. 상태 pill (클릭으로 변경. 최종/탈락 선택 시 이유 입력란 나타남)
3. 계보 (부모 → 현재, Direction, 버전)
4. 의도 태그 (intentTags + changeTags 칩)
5. 메모
6. 유입 정보 (AI면 프롬프트/시드, Import면 소스)
7. 액션: "변형 만들기" / "새 방향 만들기"

"변형 만들기" 클릭 시 패널이 전환:
- 부모 이미지 (작게)
- intentTags 칩 선택
- changeTags 칩 선택
- 추가 지시 (1줄)
- "생성" 버튼 → AI로 변형 이미지 생성 → 자식 노드 자동 연결

### Status Bar (하단 24px)
노드 수 | 방향 수 | 줌 레벨

---

## 기술 스택

Next.js 14 + Tailwind + shadcn/ui + Zustand + React Flow + Claude API + Replicate API
다크 테마. Vercel 배포.

---

## 구현 순서

### Step 1: 레이아웃 셸 + 빈 그래프
- IDE 레이아웃 (Activity Bar, Sidebar, 중앙, Right Panel, Status Bar)
- React Flow 빈 캔버스
- Zustand 스토어 (NodeStore, DirectionStore, UIStore)
- 다크 테마 CSS 변수
- **여기서 멈추고 확인**

### Step 2: 이미지 드롭 → 노드 등록
- 그래프 위에 이미지 드래그 앤 드롭
- 드롭 시 노드 생성 (루트, 미분류)
- 커스텀 노드 컴포넌트 (썸네일 + 상태 dot + 버전)
- 노드 클릭 → Detail Panel에 메타데이터 표시
- Detail Panel에서 상태 변경, 메모 입력
- **여기서 멈추고 확인 — 이미 제품의 본질이 작동함**

### Step 3: 부모-자식 연결 + Direction
- 노드를 다른 노드의 자식으로 연결하는 UI (드롭 시 "루트/자식" 선택)
- 엣지 렌더링 (Direction 컬러)
- Direction 생성 (이름 + 컬러)
- 노드에 Direction 할당
- Sidebar에 Direction 목록 표시
- **여기서 멈추고 확인**

### Step 4: AI 초기 생성
- Sidebar에 "초기 이미지 생성" 버튼
- 키워드/컨셉 입력 (간단한 텍스트 필드)
- Claude API → 프롬프트 6개 생성
- Replicate API → 이미지 6장 생성
- 각 이미지를 루트 노드로 자동 등록
- 로딩 상태 표시
- **여기서 멈추고 확인**

### Step 5: 변형 생성
- Detail Panel "변형 만들기" → 모드 전환
- intentTags, changeTags 칩 선택 UI
- 부모 프롬프트 + 의도 → Claude → Replicate → 새 이미지
- 자식 노드 자동 생성 + 부모와 엣지 연결
- **여기서 멈추고 확인**

### Step 6: 폴리싱
- 노드 추가 시 애니메이션
- 패널 열기/닫기 트랜지션
- 상태 변경 시 컬러 전환
- 빈 상태 안내 문구
- 데모용 프리셋 데이터 (Luna 캠페인)

---

## 만들지 않는 것

- 프로젝트 관리 (프로젝트는 1개 고정)
- Brand Context 상세 폼 (AI 생성 시 키워드 입력만)
- 비교 화면
- 댓글/피드백
- Bottom Panel / Generation Log
- Command Palette
- Breadcrumb
- 미니맵
- Welcome 탭

---

## 핵심 주의사항

1. **Step별로 완성하고 확인한 뒤 다음으로.** 한꺼번에 전부 만들지 말 것.
2. **Step 2가 끝나면 이미 제품이다.** 이미지를 드롭하고, 메타데이터를 붙이고, 그래프로 보는 것. 이게 작동하면 나머지는 전부 부가 기능.
3. 코어를 기억할 것: **노드 + 메타데이터 + 관계 + 시각화.** 이 네 가지가 안 되면 다른 건 의미 없다.
