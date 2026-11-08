import type { Actor, LibraryMode } from "./domain";
import type { Locale } from "./i18n";

/**
 * The first-visit journey: a guided tour that highlights each feature on the real screen, and the
 * same steps listed as a feature manual on the "Journey Tour" page.
 *
 * A step points at an element through its `data-tour` attribute. Keep the attribute and the step's
 * `target` in sync when you move or rename UI.
 */
export type JourneyTab = "explore" | "library3d" | "my-library" | "admin" | "about";
export type JourneyChapterId = "start" | "find" | "walk" | "borrow" | "screen" | "admin" | "adapt";
export type JourneyStepId =
  | "welcome"
  | "search"
  | "scene"
  | "classes"
  | "books"
  | "library3d"
  | "my-loans"
  | "notifications"
  | "language"
  | "identity"
  | "admin-queue"
  | "admin-users"
  | "admin-catalog"
  | "adapt"
  | "finish";

export type JourneyStep = {
  id: JourneyStepId;
  chapter: JourneyChapterId;
  /** The tab the app shows while this step is on screen. */
  tab: JourneyTab;
  /** `data-tour` value of the element to highlight. Without one, the card sits in the middle. */
  target?: string;
  /** Shown only to administrators. */
  adminOnly?: boolean;
  /** Shown only in the local demo, where the member/admin switch exists. */
  demoOnly?: boolean;
  /** Listed on the Journey Tour page as a feature. The welcome and closing steps are not. */
  feature: boolean;
};

export const JOURNEY_STEPS: readonly JourneyStep[] = [
  { id: "welcome", chapter: "start", tab: "explore", feature: false },
  { id: "search", chapter: "find", tab: "explore", target: "search", feature: true },
  { id: "scene", chapter: "find", tab: "explore", target: "scene", feature: true },
  { id: "classes", chapter: "find", tab: "explore", target: "classes", feature: true },
  { id: "books", chapter: "find", tab: "explore", target: "books", feature: true },
  { id: "library3d", chapter: "walk", tab: "library3d", target: "library3d", feature: true },
  { id: "my-loans", chapter: "borrow", tab: "my-library", target: "my-loans", feature: true },
  { id: "notifications", chapter: "borrow", tab: "my-library", target: "notifications", feature: true },
  { id: "language", chapter: "screen", tab: "explore", target: "language", feature: true },
  { id: "identity", chapter: "screen", tab: "explore", target: "identity", demoOnly: true, feature: true },
  { id: "admin-queue", chapter: "admin", tab: "admin", target: "admin-queue", adminOnly: true, feature: true },
  { id: "admin-users", chapter: "admin", tab: "admin", target: "admin-users", adminOnly: true, feature: true },
  { id: "admin-catalog", chapter: "admin", tab: "admin", target: "admin-catalog", adminOnly: true, feature: true },
  { id: "adapt", chapter: "adapt", tab: "about", target: "about-guide", feature: true },
  { id: "finish", chapter: "adapt", tab: "explore", target: "nav-guide", feature: false },
];

export const JOURNEY_CHAPTERS: readonly JourneyChapterId[] = ["start", "find", "walk", "borrow", "screen", "admin", "adapt"];

/** The steps this viewer can take: admin steps for administrators, the role switch only in the demo. */
export function journeySteps({ role, mode }: { role: Actor["role"]; mode: LibraryMode }) {
  return JOURNEY_STEPS.filter((step) => (!step.adminOnly || role === "admin") && (!step.demoOnly || mode === "demo"));
}

/**
 * Where the tour goes when its current step is no longer available, for example after the viewer
 * switches back to the member view on an admin step: the next available step, or null to end.
 */
export function nextAvailableStep(id: JourneyStepId, available: readonly JourneyStep[]): JourneyStepId | null {
  const start = JOURNEY_STEPS.findIndex((step) => step.id === id);
  const next = JOURNEY_STEPS.slice(start + 1).find((step) => available.some((item) => item.id === step.id));
  return next?.id ?? null;
}

export const JOURNEY_STORAGE_KEY = "durume-journey-v1";

/** True when this browser has already started or dismissed the journey. Storage may be blocked. */
export function readJourneySeen() {
  try {
    return window.localStorage.getItem(JOURNEY_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

export function writeJourneySeen() {
  try {
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, "seen");
  } catch {
    // Private windows and blocked storage: the prompt simply shows again next time.
  }
}

type StepCopy = { title: string; body: string; tips: readonly string[] };

type JourneyCopy = {
  navLabel: string;
  chapters: Record<JourneyChapterId, string>;
  steps: Record<JourneyStepId, StepCopy>;
  progress: string;
  back: string;
  next: string;
  finish: string;
  close: string;
  tourLabel: string;
  switchToAdmin: string;
  memberHint: string;
  promptTitle: string;
  promptBody: string;
  promptStart: string;
  promptDismiss: string;
  guideEyebrow: string;
  guideTitle: string;
  guideLead: string;
  guideStart: string;
  showMe: string;
  adminBadge: string;
  adminSwitchNote: string;
  adminLockedNote: string;
  tipsLabel: string;
};

export const JOURNEY_COPY: Record<Locale, JourneyCopy> = {
  en: {
    navLabel: "Journey Tour",
    chapters: {
      start: "Welcome",
      find: "Find a book",
      walk: "Walk the 3D library",
      borrow: "Borrow and keep track",
      screen: "Set up your screen",
      admin: "Run the library",
      adapt: "Make it yours",
    },
    steps: {
      welcome: {
        title: "Welcome to Durume 3D Library",
        body: "This short tour points at each feature on the real screen and shows how to use it. It takes about two minutes. Go back, skip ahead or close it whenever you like, and open it again from Journey Tour in the menu.",
        tips: [],
      },
      search: {
        title: "Search by title, author or class number",
        body: "Type a title, an author, or a DDC or KDC number. The list below narrows with every letter you type.",
        tips: ["Searching from any page brings you back to the shelves to show the results.", "Korean titles and authors are searched along with the English originals."],
      },
      scene: {
        title: "Pick a shelf on the floor plan",
        body: "Drag to turn the library and scroll to zoom. Click a shelf to list only its books, and click it again to list every book.",
        tips: ["The location buttons under the view jump to the first shelf of each hall.", "Open 3D library walks you right up to the shelf you picked."],
      },
      classes: {
        title: "Narrow the list by subject",
        body: "Choose DDC or KDC for the class numbers on the covers, then pick a subject from 000 to 900.",
        tips: ["All classes clears the subject filter."],
      },
      books: {
        title: "Open a book",
        body: "Click a card to open its details. From there, View on 3D shelf shows exactly where it sits, and Request loan or Reserve next sends your request.",
        tips: ["Each card shows whether the book can be borrowed now.", "Reserve a book that is on loan and you keep your place in the queue."],
      },
      library3d: {
        title: "Stand in front of a shelf",
        body: "Choose a shelf from the list or with the arrows and you walk up to it. Point at a book to see its title, and click it to open its details.",
        tips: ["Whole library takes you a step back to the full view.", "If your browser cannot draw 3D, the shelf list and written location still work."],
      },
      "my-loans": {
        title: "Your loans and reservations",
        body: "See what you borrowed, when each book is due and what you reserved, all in one place. When you finish a book, press Request return and a librarian checks it in.",
        tips: ["Overdue books are counted at the top of the page."],
      },
      notifications: {
        title: "Notifications",
        body: "The number on the bell counts what needs your attention: your loan requests still waiting for approval, your overdue books and your reservations ready to pick up. Press it to open My library.",
        tips: [],
      },
      language: {
        title: "Switch the language",
        body: "Move between English and 한국어. Menus, book titles and authors change together.",
        tips: ["The badge next to it tells you whether you are looking at demo data or the OneDrive Excel workbook."],
      },
      identity: {
        title: "Member view and admin view",
        body: "In the demo, this switch lets you try both roles. Members borrow and reserve; administrators approve requests and manage the catalog.",
        tips: ["With a real workbook, the role column of the Users table decides your role."],
      },
      "admin-queue": {
        title: "Approve loans and check in returns",
        body: "Loan and return requests from members gather here. Approve or reject a loan, and process a return once the book is back.",
        tips: ["Every action checks the record's version, so two people cannot overwrite each other's work."],
      },
      "admin-users": {
        title: "Members and roles",
        body: "Add a user and choose member or librarian for them. You cannot change your own role, so you cannot lock yourself out by accident.",
        tips: [],
      },
      "admin-catalog": {
        title: "Catalog and shelf placement",
        body: "Move a book to another shelf, edit its details or delete it. New book adds a title with its English and Korean names.",
        tips: ["A book with an active loan or a pending loan request cannot be deleted."],
      },
      adapt: {
        title: "Adapt it to your work with AI",
        body: "This app is an example. Hand the guide for AI to an assistant and turn it into an equipment loan, room booking or teaching materials app.",
        tips: ["The guide also lists the security decisions that a person, not the AI, must make."],
      },
      finish: {
        title: "You're ready",
        body: "That is the whole journey. Whenever you want the feature manual or this tour again, open Journey Tour in the menu.",
        tips: [],
      },
    },
    progress: "{current} of {total}",
    back: "Back",
    next: "Next",
    finish: "Finish",
    close: "Close the tour",
    tourLabel: "Feature tour",
    switchToAdmin: "Switch to admin view",
    memberHint: "Switch to admin view and the tour goes on to the admin desk.",
    promptTitle: "New here?",
    promptBody: "Take a two-minute tour. It points at each feature right on this screen.",
    promptStart: "Start the tour",
    promptDismiss: "Not now",
    guideEyebrow: "JOURNEY TOUR",
    guideTitle: "Your first visit, step by step.",
    guideLead: "Each feature has a short how-to below. Press Show me and the app takes you to that feature and highlights it on the real screen.",
    guideStart: "Start the full tour",
    showMe: "Show me",
    adminBadge: "Admin",
    adminSwitchNote: "Switches to admin view first.",
    adminLockedNote: "For administrators only.",
    tipsLabel: "Tips",
  },
  ko: {
    navLabel: "이용방법",
    chapters: {
      start: "시작",
      find: "책 찾기",
      walk: "3D 도서관 걷기",
      borrow: "빌리고 챙기기",
      screen: "화면 맞추기",
      admin: "사서실 일",
      adapt: "내 일에 맞게",
    },
    steps: {
      welcome: {
        title: "두루미 3D 도서관에 어서 오세요",
        body: "실제 화면에서 기능을 하나씩 짚어 가며 쓰는 법을 알려 드립니다. 2분이면 다 둘러봅니다. 언제든 앞뒤로 오가거나 닫을 수 있고, 메뉴의 '이용방법'에서 다시 열 수 있습니다.",
        tips: [],
      },
      search: {
        title: "제목·저자·분류 번호로 찾기",
        body: "제목이나 저자, DDC·KDC 분류 번호를 입력하세요. 입력할 때마다 아래 목록이 좁혀집니다.",
        tips: ["다른 화면에서 검색해도 서가 둘러보기로 돌아와 결과를 보여 줍니다.", "한국어 제목·저자와 영어 원제를 함께 찾습니다."],
      },
      scene: {
        title: "평면도에서 서가 고르기",
        body: "끌어서 도서관을 돌리고, 스크롤로 확대·축소합니다. 서가를 누르면 그 서가의 책만 보이고, 한 번 더 누르면 다시 모든 책이 보입니다.",
        tips: ["아래쪽 위치 버튼을 누르면 그 관의 첫 서가로 옮겨 갑니다.", "'3D 도서관에서 둘러보기'를 누르면 고른 서가 바로 앞으로 걸어갑니다."],
      },
      classes: {
        title: "주제로 좁히기",
        body: "책 표지에 나오는 분류 번호를 DDC로 볼지 KDC로 볼지 고르고, 000부터 900까지 주제를 눌러 목록을 좁힙니다.",
        tips: ["'전체 주제'를 누르면 주제 필터가 풀립니다."],
      },
      books: {
        title: "책 펼쳐 보기",
        body: "카드를 누르면 상세 정보가 열립니다. 거기서 '3D 서가에서 보기'로 꽂힌 자리를 확인하고, '대출 신청'이나 '예약하기'로 바로 신청합니다.",
        tips: ["카드마다 지금 빌릴 수 있는지 표시됩니다.", "대출 중인 책도 예약해 두면 순서대로 빌릴 수 있습니다."],
      },
      library3d: {
        title: "서가 앞에 서기",
        body: "목록이나 화살표로 서가를 고르면 그 앞으로 걸어갑니다. 책에 마우스를 올리면 제목이 보이고, 누르면 상세 정보가 열립니다.",
        tips: ["'전체 보기'를 누르면 한 걸음 물러나 도서관 전체를 봅니다.", "3D 화면을 띄울 수 없는 브라우저에서도 서가 목록과 글로 적은 위치로 책을 찾을 수 있습니다."],
      },
      "my-loans": {
        title: "내 대출과 예약",
        body: "빌린 책과 반납 예정일, 예약한 책을 한곳에서 봅니다. 다 읽은 책은 '반납 신청'을 누르면 사서가 확인한 뒤 반납 처리합니다.",
        tips: ["연체된 책 수는 화면 위쪽에 따로 셉니다."],
      },
      notifications: {
        title: "알림",
        body: "종 아이콘의 숫자는 내가 챙겨야 할 일의 수입니다. 승인을 기다리는 내 신청, 연체된 내 책, 찾아갈 수 있는 내 예약을 셉니다. 누르면 내 서재가 열립니다.",
        tips: [],
      },
      language: {
        title: "언어 바꾸기",
        body: "English와 한국어를 오갑니다. 메뉴와 책 제목·저자가 함께 바뀝니다.",
        tips: ["옆의 표시는 지금 보는 자료가 데모 데이터인지 OneDrive의 Excel 파일인지 알려 줍니다."],
      },
      identity: {
        title: "회원 화면과 관리자 화면",
        body: "데모에서는 이 선택 상자로 두 역할을 모두 써 볼 수 있습니다. 회원은 책을 빌리고 예약하며, 관리자는 신청을 승인하고 장서를 관리합니다.",
        tips: ["실제 Excel 파일을 쓸 때는 Users 표의 role 값이 역할을 정합니다."],
      },
      "admin-queue": {
        title: "대출 승인과 반납 처리",
        body: "회원이 보낸 대출·반납 신청이 여기 모입니다. 대출은 승인하거나 반려하고, 책이 돌아오면 반납 처리합니다.",
        tips: ["처리할 때마다 기록의 버전을 확인하므로, 두 사람이 서로의 작업을 덮어쓰지 않습니다."],
      },
      "admin-users": {
        title: "회원과 역할",
        body: "사용자를 더하고 회원과 사서 가운데 역할을 고릅니다. 자기 역할은 바꿀 수 없어서 실수로 관리 권한을 잃지 않습니다.",
        tips: [],
      },
      "admin-catalog": {
        title: "장서와 서가 배치",
        body: "책을 다른 서가로 옮기거나, 정보를 고치거나, 지웁니다. 새 책은 '도서 등록'에서 영어·한국어 제목을 함께 적어 넣습니다.",
        tips: ["대출 중이거나 대출 신청이 걸린 책은 지울 수 없습니다."],
      },
      adapt: {
        title: "인공지능과 함께 내 일에 맞게",
        body: "이 앱은 하나의 예제입니다. 인공지능을 위한 가이드를 건네면 장비 대여, 공간 예약, 교재 관리 앱으로 고쳐 쓸 수 있습니다.",
        tips: ["인공지능이 아니라 사람이 정해야 할 보안 판단도 가이드에 적어 두었습니다."],
      },
      finish: {
        title: "이제 직접 써 보세요",
        body: "여기까지가 전체 안내입니다. 기능 설명서나 이 안내를 다시 보고 싶으면 메뉴의 '이용방법'을 누르세요.",
        tips: [],
      },
    },
    progress: "{total}단계 중 {current}단계",
    back: "이전",
    next: "다음",
    finish: "마치기",
    close: "안내 닫기",
    tourLabel: "기능 안내",
    switchToAdmin: "관리자 화면으로 바꾸기",
    memberHint: "관리자 화면으로 바꾸면 사서실 안내가 이어집니다.",
    promptTitle: "처음 오셨나요?",
    promptBody: "2분이면 됩니다. 이 화면에서 바로 기능을 하나씩 짚어 드립니다.",
    promptStart: "안내 시작",
    promptDismiss: "다음에 보기",
    guideEyebrow: "이용방법",
    guideTitle: "처음 오셨다면 이 순서대로 둘러보세요.",
    guideLead: "기능마다 쓰는 법을 짧게 적었습니다. '화면에서 보기'를 누르면 실제 화면으로 옮겨 가서 그 기능을 짚어 보여 드립니다.",
    guideStart: "처음부터 안내받기",
    showMe: "화면에서 보기",
    adminBadge: "관리자",
    adminSwitchNote: "관리자 화면으로 바꾼 뒤 보여 드립니다.",
    adminLockedNote: "관리자만 쓸 수 있습니다.",
    tipsLabel: "알아 두면 좋은 점",
  },
};
