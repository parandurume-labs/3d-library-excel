import { CLASS_LABELS, type LibraryState } from "./domain";

export const DEMO_MEMBER_ID = "user-demo-member";
export const DEMO_ADMIN_ID = "user-demo-admin";

const adjectives = ["Hidden", "Curious", "Quiet", "Bright", "Digital", "Practical", "Gentle", "Modern", "Ancient", "Open"];
const subjects = ["Atlas", "Patterns", "Cities", "Machines", "Stories", "Signals", "Gardens", "Numbers", "Horizons", "Questions"];
const surnames = ["Rivera", "Kim", "Nolan", "Patel", "Chen", "Okafor", "Meyer", "Sato", "Costa", "Park"];
const koreanTitles = [
  "사라진 지도의 기록", "호기심은 길을 만든다", "고요한 도시의 오후", "빛나는 생각의 집", "디지털 시대의 서랍",
  "생활을 바꾸는 작은 기술", "다정한 기계와의 대화", "오늘의 풍경을 읽다", "고전에게 길을 묻다", "열린 질문의 힘",
  "도서관에서 만난 내일", "숲의 신호를 듣는 법", "별빛 아래 오래된 정원", "마주한 도시의 골목", "숫자로 보는 일상",
  "기억하는 기계", "이야기 속의 집", "천천히 자라는 지식", "낯선 길의 안내서", "마음의 지평선", "새벽을 잇는 다리",
  "작은 발명이 만든 변화", "언어의 숨은 지도", "우연히 찾은 과학", "그림자로 그린 역사", "바람이 머문 도서관",
  "한 권의 책, 하나의 여정", "정원사의 질문", "미래를 기록하는 방법", "오래된 도시의 목소리", "문장 사이의 쉼표",
  "시간을 건너는 표지", "생활 속 수학 산책", "고요한 혁신", "세계사를 여는 열쇠", "책장을 넘어선 이야기",
  "새로운 예술의 문법", "함께 만드는 내일", "지식의 오래된 우물", "작은 발견들의 연대기",
];
const koreanAuthors = ["김하늘", "이서준", "박지안", "최유진", "정민서", "한도윤", "오은별", "윤지호", "장서연", "신우진"];
const colors = ["#d97757", "#5d8a86", "#b47b54", "#6b7280", "#7d6fa6", "#b45f6d"];

export function createDemoState(count = 520, now = new Date()): LibraryState {
  const locations = Array.from({ length: 3 }, (_, i) => ({
    id: `location-${i + 1}`,
    version: 1,
    name: ["Central Hall", "Learning Lab", "Archive Wing"][i],
    floor: [1, 1, 2][i],
    zone: ["Main", "East", "West"][i],
  }));
  const shelves = Array.from({ length: 15 }, (_, i) => ({
    id: `shelf-${String(i + 1).padStart(2, "0")}`,
    version: 1,
    name: `Shelf ${String.fromCharCode(65 + i % 5)}${i + 1}`,
    locationId: locations[i % locations.length].id,
    zone: locations[i % locations.length].zone,
    floor: locations[i % locations.length].floor,
    capacity: 44,
  }));
  const books = Array.from({ length: count }, (_, i) => {
    const classIndex = i % 10;
    const shelf = shelves[i % shelves.length];
    return {
      id: `book-${String(i + 1).padStart(4, "0")}`,
      version: 1,
      title: `${adjectives[i % adjectives.length]} ${subjects[Math.floor(i / 10) % subjects.length]} ${Math.floor(i / 100) + 1}`,
      author: `${surnames[(i * 7) % surnames.length]}, ${String.fromCharCode(65 + i % 26)}.`,
      titleKo: `${koreanTitles[i % koreanTitles.length]}${i >= koreanTitles.length ? ` ${Math.floor(i / koreanTitles.length) + 1}` : ""}`,
      authorKo: koreanAuthors[i % koreanAuthors.length],
      year: 2000 + (i % 26),
      ddc: `${classIndex === 0 ? "000" : `${classIndex}00`}.${String(i % 100).padStart(2, "0")}`,
      kdc: `${classIndex}10.${String((i * 3) % 100).padStart(2, "0")}`,
      classIndex,
      locationId: shelf.locationId,
      shelfId: shelf.id,
      bin: `${String.fromCharCode(65 + (i % 4))}-${(i % 11) + 1}`,
      coverColor: colors[i % colors.length],
      demo: true,
    };
  });
  const users = [
    { id: DEMO_MEMBER_ID, version: 1, authId: "demo-member", displayName: "Demo Member", email: "member@example.invalid", role: "member" as const },
    { id: DEMO_ADMIN_ID, version: 1, authId: "demo-admin", displayName: "Demo Librarian", email: "admin@example.invalid", role: "admin" as const },
    { id: "user-demo-member-2", version: 1, authId: "demo-member-2", displayName: "Alex Demo", email: "alex@example.invalid", role: "member" as const },
  ];
  const loans = Array.from({ length: 18 }, (_, i) => {
    const overdue = i < 4;
    const requested = i >= 12;
    const status = requested ? "requested" as const : overdue ? "overdue" as const : "approved" as const;
    const days = 3 + i;
    return {
      id: `loan-${i + 1}`,
      version: 1,
      bookId: books[i].id,
      userId: requested ? users[1].id : users[i % 3].id,
      status,
      requestedAt: new Date(now.getTime() - days * 86_400_000).toISOString(),
      ...(requested ? {} : {
        approvedAt: new Date(now.getTime() - (days - 1) * 86_400_000).toISOString(),
        dueAt: new Date(now.getTime() + (overdue ? -i - 1 : 14 - i) * 86_400_000).toISOString(),
      }),
    };
  });
  const reservations = Array.from({ length: 6 }, (_, i) => ({
    id: `reservation-${i + 1}`,
    version: 1,
    bookId: books[i].id,
    userId: users[i % 2 === 0 ? 0 : 2].id,
    status: i === 0 ? "ready" as const : "waiting" as const,
    createdAt: new Date(now.getTime() - (i + 1) * 3_600_000).toISOString(),
  }));
  return {
    books,
    shelves,
    locations,
    users,
    loans,
    reservations,
    settings: [
      { id: "setting-schema", version: 1, key: "schemaVersion", value: "1" },
      { id: "setting-mode", version: 1, key: "demoData", value: "true" },
      { id: "setting-notice", version: 1, key: "loanDurationDays", value: "14" },
      ...CLASS_LABELS.map((label, index) => ({
        id: `setting-class-${index}`,
        version: 1,
        key: `class.${index}`,
        value: label,
      })),
    ],
  };
}
