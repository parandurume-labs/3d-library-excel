# 3D 서가가 첫 로딩 직후 사라지는 버그

- 날짜: 2026-11-06 · 브랜치: `fix/shelf-scene-context-loss` · 시작 커밋: `4ddddc2` (`origin/main`)
- 크기: M · 어댑터 필수 슬롯 대상: 아니오 (`docs/playbooks/project.ko.md` 없음)
- 상태: 사람 승인 대기

## 요청 (원문)

> 3D 서가가 처음 페이지 로딩할 때 잠시 보이고 사라졌다가 다른 메뉴로 옮겨간 다음 요청하면 보입니다. 버그를 분석해서 적절한 브랜치를 생성한 다음 커밋해서 푸시해주세요.

## Investigate

### 재현 절차

조건: `npm run dev`(Next.js 15.5 개발 서버, 데모 모드), Chromium, 뷰포트 1440×900, 캐시 없는 첫 방문.

1. `http://localhost:3000`을 연다.
2. "Explore shelves" 화면의 3D 서가를 3초 동안 지켜본다.
3. 사이드바에서 "My library"로 갔다가 "Explore shelves"로 돌아온다.

- 기대 동작: 2단계에서 서가가 나타난 뒤 계속 보인다.
- 실제 동작: 2단계에서 서가가 0.5~1초쯤 보이다가 빈 화면이 된다
  (`canvas.getContext("webgl2").isContextLost() === true`). 3단계 뒤에는 정상으로 보인다.

같은 절차를 수정 전 `origin/main`(`4ddddc2`)에서도 실행해 같은 결과를 확인했다(아래 Implement의 기준선).

### 근본 원인

두 결함이 겹친다.

1. **앱(`src/components/shelf-scene.tsx`)**: 서가 이름을 그리는 drei `<Text>`는 글꼴을 다 받을 때까지
   suspend한다(`@react-three/drei/core/Text.js:34`, 캐시 키 `['troika-text', font, characters]`).
   씬 안에 `Suspense` 경계가 없어서 이 suspend가 `<Canvas>` 밖으로 나간다. R3F의 `Canvas`는 자식이
   suspend하면 자신이 promise를 다시 던지고(`react-three-fiber.esm.js:60`), 가장 가까운 경계인
   `next/dynamic`의 `Suspense`가 이미 화면에 올라간 Canvas를 `display: none !important`로 숨겼다가
   글꼴이 오면 다시 보여 준다.
2. **`@react-three/fiber` 9.3.0**: 개발 모드의 React 19 StrictMode는 숨겨졌다 다시 나타난 트리의
   effect를 한 번 더 끊었다 붙인다. `Canvas`의 effect cleanup은 `unmountComponentAtNode(canvas)`를
   부르고(`react-three-fiber.esm.js:119-122`), 이 함수는 Canvas가 계속 쓰이는지 확인하지 않고 500ms 뒤
   `gl.forceContextLoss()`를 실행한다(`events-e3cb66e2.esm.js:2021-2046`). Canvas는 화면에 그대로 있는데
   WebGL 컨텍스트만 사라져 빈 화면이 된다.

메뉴를 옮겼다 오면 보이는 이유: 글꼴이 이미 캐시되어 `<Text>`가 suspend하지 않는다. 숨김과 재표시가
없으니 cleanup이 다시 실행되지 않는다.

### 증거

페이지 안에서 `loseContext`, R3F의 `_roots.get(canvas)`, Canvas 조상의 `style` 변화를 기록했다
(제품 코드는 고치지 않았다). 첫 로딩의 기록:

| 시각 | 사건 |
|---|---|
| 400ms | Canvas 마운트. StrictMode의 첫 이중 실행은 root가 아직 없어 영향 없음(`hasRoot=false`) |
| 466ms | `createRoot` — 렌더링 시작 |
| 596ms | Canvas 래퍼에 `display: none !important` (suspend로 숨김) |
| 948ms | 다시 표시 |
| 1146ms | `flushPassiveEffects` → `commitDoubleInvokeEffectsInDEV` → `doubleInvokeEffectsOnFiber` → `disconnectPassiveEffect` → `unmountComponentAtNode` (`hasRoot=true`) |
| 1746ms | `WebGLRenderer.forceContextLoss` → `loseContext()` |

메뉴를 옮겼다 온 뒤의 기록에는 `display: none`도, `hasRoot=true`인 `unmountComponentAtNode`도,
`loseContext()`도 없고 `isContextLost() === false`였다.

### 가설

| 가설 | 판정 | 근거 |
|---|---|---|
| H1. 글꼴 suspend로 Canvas가 숨겨졌다 나타나고, StrictMode의 effect 재실행이 R3F cleanup을 불러 컨텍스트를 잃는다 | 확인 | 위 기록의 호출 스택과 시각 |
| H2. StrictMode가 첫 마운트 때 effect를 두 번 실행해서 생긴다 | 기각 | 400ms의 호출은 `hasRoot=false`라 아무 일도 하지 않는다. 메뉴를 옮겼다 올 때도 같은 이중 실행이 있지만 정상이다 |
| H3. 데이터 로딩(`/api/library`)이 끝나며 `ShelfScene`이 다시 마운트된다 | 기각 | 기록상 canvas는 한 번만 DOM에 추가되고 제거되지 않는다 |
| H4. 브라우저·GPU가 컨텍스트를 회수한다 | 기각 | `loseContext()`의 호출자가 `WebGLRenderer.forceContextLoss`(R3F의 500ms 타이머)다 |

### 수정안

- **근본 수정(채택)**: `<Text>`를 씬 안의 `Suspense`로 감싼다. 글꼴 로딩이 Canvas를 숨기지 않게 되어
  결함 1이 없어지고, 결함 2를 일으키는 조건도 함께 사라진다. 서가는 글꼴(jsDelivr CDN에서 받는다)을
  기다리지 않고 바로 그려지고, 이름표만 늦게 나타난다. 영향 범위: `shelf-scene.tsx` 한 파일.
- 후속 권고(이번 범위 밖): `@react-three/fiber`를 9.8.2로 올린다. 9.8.2의 `unmountComponentAtNode`는
  "unmount 뒤 root가 다시 쓰이면 정리를 취소"하도록 바뀌어 있다(배포본 소스를 읽어 확인, 실행 검증은 안 함).
- 우회안(채택 안 함): `reactStrictMode: false`. 증상만 가리고 개발 중 검사를 잃는다. 글꼴 로딩 동안
  Canvas가 숨겨지는 문제는 남는다.

## Implement

- 모드: 버그
- 변경 요약:
  - `src/components/shelf-scene.tsx`: 서가 이름표를 `ShelfLabel` 컴포넌트로 빼고 `<Text>`를
    `<Suspense fallback={null}>`로 감쌌다.
  - `src/components/shelf-scene.test.tsx`(신규): 글꼴이 로딩 중일 때 Canvas가 바깥 fallback으로
    바뀌지 않고 서가가 그려지는지 검사한다. jsdom에는 WebGL이 없어 `Canvas`와 `Text`를 대역으로 바꿨다.
  - `vitest.config.ts`: JSX 자동 런타임을 켰다. `shelf-scene.tsx`는 Next.js 빌드처럼 `React`를
    import하지 않아서, 이 설정이 없으면 테스트에서 `React is not defined`로 실패한다.
- 검사 결과 (worktree에서 `npm ci`로 lockfile 그대로 설치: vitest 4.1.12, jsdom 27.4.0):
  - 수정 전 `npx vitest run src/components/shelf-scene.test.tsx`: 1 실패
    (`expected document not to contain element, found <div data-testid="outside-fallback" />`)
  - 수정 후 `npx vitest run`: 5 파일, 19 테스트 통과
  - `npx tsc --noEmit`: 종료 코드 0 · `npx eslint .`: 종료 코드 0
- 증거 묶음 (브라우저, `next dev -p 3100`, Chromium 헤드리스, 1440×900, 첫 로딩 뒤 10초 관찰):

  | | 첫 로딩 `isContextLost()` | Canvas 숨김 횟수 | `loseContext()` 호출 | 메뉴 왕복 뒤 `isContextLost()` |
  |---|---|---|---|---|
  | 수정 전 (`4ddddc2`) | `true` (빈 화면) | 4 | 1 | `false` |
  | 수정 후 | `false` (서가와 이름표 표시) | 0 | 0 | `false` |

  수정 후 메뉴 왕복 때 `loseContext()`가 1회 기록된다. 화면에서 내려간 이전 canvas를 정리하는
  정상 동작이고, 새 canvas의 컨텍스트는 유지된다.
- 범위 밖 발견:
  - `@react-three/fiber` 9.3.0의 cleanup 결함은 그대로다. 씬에 suspend하는 요소를 새로 넣을 때
    `Suspense`로 감싸지 않으면 같은 증상이 다시 나온다. 9.8.2로 올리는 것을 권한다.
  - 로컬 `main`의 미커밋 작업도 `shelf-scene.tsx`의 `<Text>` 줄을 고친다. 병합할 때 그 줄에서
    충돌이 난다. `<ShelfLabel>{getShelfDisplay(shelf, locale)}</ShelfLabel>`로 합치면 된다.

## Review

| 슬롯 | 실행자 | 판정 | 보고서 |
|---|---|---|---|
| 코드 | 독립 서브에이전트 (작업 기록·diff·증거만 전달) | PASS, 차단 지적 없음 | 아래 표 |
| 화면 확인 | 사용자 | 정상 동작 확인 | `localhost:3100`(수정 적용 개발 서버)에서 직접 확인 |

검수자가 직접 실행한 것: 전체 테스트(19개 통과), `tsc`, `eslint`, 수정 전 코드로 되돌렸을 때 새 테스트가
실패하는지, `vitest.config.ts` 변경을 빼면 `React is not defined`로 실패하는지, 기록이 인용한
라이브러리 소스의 줄 번호.

차단 지적은 없다. 아래는 검수자가 실행으로 증명하지 않고 남긴 가능성이다.

| ID | 지적 | 심각도 | 처리(수정/반박/보류) | 재검수 |
|---|---|---|---|---|
| P1 | 브라우저 증거 표를 검수자가 다시 실행하지 않았다 | 가능성 | 보류. 사용자가 같은 서버에서 화면을 직접 확인했다 | 해당 없음 |
| P2 | H2 기각이 관찰 한 번에 근거한다. root가 이미 있을 때 cleanup이 돌면 재발할 수 있다 | 가능성 | 반박. 수정 전·후와 로컬 작업 트리에서 모두 네 번 관찰했고 매번 `hasRoot=false`였다. root는 크기 측정 뒤 layout effect에서만 생기므로(`react-three-fiber.esm.js:64-67`) 마운트 직후의 이중 실행보다 늦다 | 해당 없음 |
| P3 | suspend하는 요소를 새로 넣고 감싸지 않으면 재발한다 | 가능성 | 보류. 범위 밖 발견에 적었다. R3F 업그레이드로 없앤다 | 해당 없음 |
| P4 | 글꼴 로딩이 실패하면 Canvas 전체가 사라질 수 있다 | 가능성 | 보류. 확인하지 않았다. 이번 변경으로 달라지는 동작은 아니다 | 해당 없음 |
| P5 | 테스트는 `Suspense` 배치를 검사하고 WebGL 동작은 검사하지 않는다 | 가능성 | 인정. WebGL 동작은 브라우저 증거로 확인했다 | 해당 없음 |
| P6 | R3F 9.8.2 권고는 소스만 읽었고 실행하지 않았다 | 가능성 | 인정. 권고로만 남긴다 | 해당 없음 |
| P7 | 프로덕션 빌드에서의 동작을 확인하지 않았다 | 가능성 | 보류. 미검증 범위에 적었다 | 해당 없음 |

## Release

- 최종 검사: `npx vitest run` 19개 통과, `npx tsc --noEmit` 0, `npx eslint .` 0. 브라우저에서 수정 전·후 비교.
- 커밋: 브랜치 `fix/shelf-scene-context-loss`의 커밋 하나(이 파일 포함). `origin`에 push하고 PR을 연다.
- 미검증 범위:
  - 프로덕션 빌드(`next build` + `next start`). 컨텍스트 소실은 개발 모드의 StrictMode 경로에서만
    일어나므로 프로덕션에서는 나오지 않을 것으로 보지만 실행하지 않았다.
  - Chromium 헤드리스에서만 자동 측정했다. 다른 브라우저는 확인하지 않았다.
  - 글꼴을 받지 못하는 환경(오프라인, CDN 차단).
- 사람 승인 대기 항목: PR 검토와 `main` 병합.
