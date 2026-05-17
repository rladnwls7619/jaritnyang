const STORAGE_KEY = "jaritnyang.mvp.v5";
const GOOGLE_PLACES_SEARCH_ENDPOINT = "/api/google-places-search";
const GOOGLE_PLACES_NEARBY_ENDPOINT = "/api/google-places-nearby";
const POINT_COOLDOWN_MS = 60 * 60 * 1000;
const VERIFIED_VISIT_AD_FEE = 300;
const TIMER_REFRESH_MS = 1000;

const seedStores = [
  createStore("gangnam-cafe-luna", "카페 루나 강남", "cafe", "서울 강남구 테헤란로 22길", 12, "콘센트 좌석과 2인석이 많은 카페", 37.501, 127.039),
  createStore("gangnam-bistro-neul", "비스트로 늘 강남", "food", "서울 강남구 강남대로 96길", 14, "혼밥석과 창가 테이블이 빠르게 도는 식당", 37.499, 127.028),
  createStore("yeoksam-focus-den", "포커스덴 역삼", "study", "서울 강남구 논현로 85길", 20, "조용한 집중석과 작은 회의 테이블 운영", 37.502, 127.036),
  createStore("hongdae-study-flow", "스터디플로우 홍대", "study", "서울 마포구 와우산로 29길", 18, "팀플석과 1인 집중석이 함께 있는 공간", 37.556, 126.923),
  createStore("hongdae-noodle-moon", "누들문 홍대", "food", "서울 마포구 어울마당로 48", 11, "점심과 저녁 회전율이 빠른 캐주얼 식당", 37.552, 126.921),
  createStore("hapjeong-cafe-bori", "카페 보리 합정", "cafe", "서울 마포구 독막로 6길", 16, "작업하기 좋은 긴 테이블과 창가석 보유", 37.548, 126.914),
  createStore("seongsu-table-house", "테이블하우스 성수", "food", "서울 성동구 연무장길 8", 10, "점심 시간 회전율이 빠른 작은 식당", 37.544, 127.055),
  createStore("seongsu-cotton-cafe", "코튼카페 성수", "cafe", "서울 성동구 서울숲4길 21", 15, "디저트 좌석과 작업석이 섞인 카페", 37.546, 127.043),
  createStore("jamsil-river-cafe", "리버냥 카페 잠실", "cafe", "서울 송파구 올림픽로 35길", 22, "넓은 테이블과 단체석이 많은 카페", 37.515, 127.103),
  createStore("jamsil-bowl-day", "보울데이 잠실", "food", "서울 송파구 백제고분로 7길", 13, "빠르게 먹고 이동하기 좋은 덮밥 매장", 37.511, 127.083),
  createStore("itaewon-taco-yard", "타코야드 이태원", "food", "서울 용산구 이태원로 20길", 12, "2인석 중심의 캐주얼 다이닝", 37.534, 126.994),
  createStore("sinchon-study-nest", "스터디네스트 신촌", "study", "서울 서대문구 연세로 11길", 24, "시험 기간 좌석 변동이 많은 스터디 공간", 37.559, 126.936),
];

const state = loadState();
let selectedStoreId = state.selectedStoreId || state.stores[0].id;
let pendingSeatId = null;
let seatEditMode = false;
let isDatabaseConnected = false;
let seatSessionChannel = null;

const storeList = document.querySelector("#storeList");
const storeDetail = document.querySelector("#storeDetail");
const pointBalance = document.querySelector("#pointBalance");
const userStatus = document.querySelector("#userStatus");
const authButton = document.querySelector("#authButton");
const accountButton = document.querySelector("#accountButton");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const googleSearchButton = document.querySelector("#googleSearchButton");
const nearbyButton = document.querySelector("#nearbyButton");
const searchStatus = document.querySelector("#searchStatus");
const resetDemoButton = document.querySelector("#resetDemoButton");
const checkInDialog = document.querySelector("#checkInDialog");
const checkInForm = document.querySelector("#checkInForm");
const authDialog = document.querySelector("#authDialog");
const authForm = document.querySelector("#authForm");
const accountDialog = document.querySelector("#accountDialog");
const accountSummary = document.querySelector("#accountSummary");
const accountSessions = document.querySelector("#accountSessions");
const accountPoints = document.querySelector("#accountPoints");
const accountVisits = document.querySelector("#accountVisits");
const accountNameInput = document.querySelector("#accountNameInput");
const saveAccountButton = document.querySelector("#saveAccountButton");
const accountLogoutButton = document.querySelector("#accountLogoutButton");
const visitDialog = document.querySelector("#visitDialog");
const visitForm = document.querySelector("#visitForm");
const dialogTitle = document.querySelector("#dialogTitle");
const durationInput = document.querySelector("#durationInput");
const durationOutput = document.querySelector("#durationOutput");
const memoInput = document.querySelector("#memoInput");
const displayNameInput = document.querySelector("#displayNameInput");
const emailInput = document.querySelector("#emailInput");
const phoneInput = document.querySelector("#phoneInput");
const visitCodeInput = document.querySelector("#visitCodeInput");

render();
initializeDatabase();
setInterval(render, TIMER_REFRESH_MS);

searchInput.addEventListener("input", render);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchGooglePlaces();
  }
});
categoryFilter.addEventListener("change", render);
googleSearchButton.addEventListener("click", searchGooglePlaces);
nearbyButton.addEventListener("click", findNearbyStores);
authButton.addEventListener("click", async () => {
  if (state.currentUser) {
    await signOutCurrentUser();
    return;
  }
  authDialog.showModal();
});

accountButton.addEventListener("click", () => {
  void openAccountDialog();
});

saveAccountButton.addEventListener("click", () => {
  void saveAccountProfile();
});

accountLogoutButton.addEventListener("click", async () => {
  accountDialog.close();
  await signOutCurrentUser();
});
resetDemoButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  const fresh = getInitialState();
  state.stores = fresh.stores;
  state.points = fresh.points;
  state.lastPointEarnedAt = fresh.lastPointEarnedAt;
  state.currentUser = fresh.currentUser;
  state.billingEvents = fresh.billingEvents;
  state.activeSeat = fresh.activeSeat;
  selectedStoreId = state.stores[0].id;
  saveState();
  render();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = displayNameInput.value.trim() || "자릿냥이";
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const contact = email || phone;
  if (!contact) {
    searchStatus.textContent = "이메일이나 전화번호 중 하나를 입력해주세요.";
    return;
  }
  if (window.JaritnyangDB?.isConfigured()) {
    try {
      await window.JaritnyangDB.signInWithOtp({ email, phone });
      searchStatus.textContent = email
        ? "Supabase 로그인 메일을 보냈어요. 메일 링크를 누른 뒤 다시 자릿냥으로 돌아오세요."
        : "Supabase 휴대폰 OTP를 보냈어요. OTP 입력 화면은 다음 단계에서 붙이면 됩니다.";
      authDialog.close();
      return;
    } catch (error) {
      console.warn(error);
      searchStatus.textContent = "Supabase 로그인이 실패해서 일단 데모 로그인으로 진행할게요.";
    }
  }

  signInDemoUser(email ? "email" : "phone", name, contact);
  authDialog.close();
});

document.querySelectorAll(".provider-button").forEach((button) => {
  button.addEventListener("click", async () => {
    const provider = button.dataset.provider;
    const label = provider === "kakao" ? "카카오톡" : "구글";
    if (window.JaritnyangDB?.isConfigured()) {
      try {
        await window.JaritnyangDB.signInWithOAuth(provider);
        return;
      } catch (error) {
        console.warn(error);
        searchStatus.textContent = "간편 로그인이 실패해서 일단 데모 로그인으로 진행할게요.";
      }
    }
    signInDemoUser(provider, `${label} 사용자`, `${provider}@demo.local`);
    authDialog.close();
  });
});

visitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  verifyCurrentVisit();
  visitDialog.close();
});

durationInput.addEventListener("input", () => {
  durationOutput.value = `${durationInput.value}분`;
});

checkInForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!pendingSeatId) return;

  const store = getSelectedStore();
  const seat = store.seats.find((item) => item.id === pendingSeatId);
  if (!seat) return;

  const now = Date.now();
  const durationMinutes = Number(durationInput.value);
  const expectedEndAt = now + durationMinutes * 60 * 1000;

  if (state.activeSeat) {
    releaseCurrentSeat(false);
  }

  seat.status = "occupied";
  seat.startedAt = now;
  seat.expectedEndAt = expectedEndAt;
  seat.userToken = "me";
  seat.verifiedAt = null;
  seat.memo = memoInput.value.trim() || "이용 중";
  state.activeSeat = {
    storeId: store.id,
    seatId: seat.id,
    expectedEndAt,
  };
  void syncStartSeatSession(store, seat, expectedEndAt, seat.memo);
  store.activity = [
    `${formatClock(now)} ${seat.label} 이용 예정 시간이 ${durationMinutes}분으로 등록되었습니다.`,
    ...store.activity.filter((item) => !item.includes("아직 등록된")),
  ].slice(0, 5);

  saveState();
  checkInDialog.close();
  render();
});

function createSeats(count) {
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return Array.from({ length: count }, (_, index) => ({
    id: `seat-${index + 1}`,
    label: `${index + 1}번 좌석`,
    x: getSeatPosition(index, columns, rows).x,
    y: getSeatPosition(index, columns, rows).y,
    status: "available",
    startedAt: null,
    expectedEndAt: null,
    userToken: null,
    memo: "",
    verifiedAt: null,
  }));
}

function createStore(id, name, category, address, totalSeats, note, lat = null, lng = null) {
  return {
    id,
    externalId: null,
    source: "jaritnyang-demo",
    adCampaign: {
      active: id.includes("cafe") || id.includes("bistro"),
      feePerVerifiedVisit: VERIFIED_VISIT_AD_FEE,
      verifiedVisits: 0,
      spend: 0,
      budget: 50000,
    },
    name,
    category,
    address,
    roadAddress: address,
    lat,
    lng,
    googleMapsUrl: createGoogleMapsSearchUrl(name, address, lat, lng),
    googleMapsEmbedUrl: createGoogleMapsEmbedUrl(name, address, lat, lng),
    totalSeats,
    note,
    seats: createSeats(totalSeats),
    floorPlanImage: null,
    activity: ["아직 등록된 이용 정보가 없습니다."],
  };
}

function getSeatPosition(index, columns, rows) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const xGap = columns <= 1 ? 0 : 76 / (columns - 1);
  const yGap = rows <= 1 ? 0 : 66 / (rows - 1);
  return {
    x: Math.round(12 + column * xGap),
    y: Math.round(17 + row * yGap),
  };
}

function getInitialState() {
  const now = Date.now();
  const stores = structuredClone(seedStores);
  seedOccupancy(stores, now);
  return {
    points: 0,
    lastPointEarnedAt: null,
    currentUser: null,
    billingEvents: [],
    activeSeat: null,
    selectedStoreId: stores[0].id,
    stores,
  };
}

function seedOccupancy(stores, now) {
  stores.forEach((store, storeIndex) => {
    const occupiedCount = Math.min(store.seats.length - 1, 2 + (storeIndex % 5));
    for (let index = 0; index < occupiedCount; index += 1) {
      const seatIndex = (index * 3 + storeIndex) % store.seats.length;
      const duration = [10, 18, 25, 35, 45, 60][(storeIndex + index) % 6];
      store.seats[seatIndex] = {
        ...store.seats[seatIndex],
        status: "occupied",
        startedAt: now - (15 + index * 11) * 60 * 1000,
        expectedEndAt: now + duration * 60 * 1000,
        userToken: `visitor-${storeIndex}-${index}`,
        memo: ["노트북 작업", "식사 중", "조용히 이용", "곧 이동", "대화 중"][
          (storeIndex + index) % 5
        ],
      };
    }
    store.activity = [
      `${formatClock(now - 4 * 60 * 1000)} 방문자 업데이트 ${occupiedCount}건이 반영되었습니다.`,
      `${formatClock(now - 9 * 60 * 1000)} 주변 자리 현황을 새로 확인했습니다.`,
    ];
  });
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return getInitialState();

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.stores)) return getInitialState();
    parsed.currentUser ||= null;
    parsed.billingEvents ||= [];
    parsed.lastPointEarnedAt ||= null;
    parsed.stores.forEach(ensureStoreShape);
    return parsed;
  } catch {
    return getInitialState();
  }
}

function saveState() {
  state.selectedStoreId = selectedStoreId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function initializeDatabase() {
  const db = window.JaritnyangDB;
  if (!db?.isConfigured()) {
    searchStatus.textContent = "Demo mode. Add Supabase values in config.js to use a real DB.";
    return;
  }

  try {
    searchStatus.textContent = "Connecting to Supabase DB...";
    db.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        state.currentUser = null;
        state.activeSeat = null;
        saveState();
        render();
        return;
      }

      if (session?.user) {
        applySupabaseUser(session.user);
        void db.upsertProfile(session.user);
        void refreshStoresFromDatabase({ silent: true });
      }
    });

    const user = await db.getCurrentUser();
    if (user) {
      applySupabaseUser(user);
      await db.upsertProfile(user);
    }

    await refreshStoresFromDatabase();
    isDatabaseConnected = true;
    searchStatus.textContent = "Supabase DB connected. Seat updates can now sync in real time.";

    seatSessionChannel = db.subscribeToSeatSessions(() => {
      void refreshStoresFromDatabase({ silent: true });
    });
  } catch (error) {
    console.warn(error);
    isDatabaseConnected = false;
    searchStatus.textContent = "Supabase DB connection failed. The app is staying in demo mode.";
  }
}

async function refreshStoresFromDatabase(options = {}) {
  const db = window.JaritnyangDB;
  if (!db?.isConfigured()) return;

  const stores = await db.loadStores();
  if (!stores.length) {
    if (!options.silent) {
      searchStatus.textContent = "Supabase is connected, but no stores exist yet. Run supabase-seed.sql first.";
    }
    return;
  }

  state.stores = stores;
  const selectedExists = state.stores.some((store) => store.id === selectedStoreId);
  selectedStoreId = selectedExists ? selectedStoreId : state.stores[0].id;
  const mySeat = findMyActiveSeat();
  state.activeSeat = mySeat
    ? {
        storeId: mySeat.store.id,
        seatId: mySeat.seat.id,
        expectedEndAt: mySeat.seat.expectedEndAt,
        remoteSessionId: mySeat.seat.remoteSessionId,
      }
    : null;
  saveState();
  render();
}

function applySupabaseUser(user) {
  const provider = user.app_metadata?.provider || (user.phone ? "phone" : "email");
  state.currentUser = {
    id: user.id,
    method: provider,
    name: user.user_metadata?.name || user.email || user.phone || "Jaritnyang user",
    contact: user.email || user.phone || "",
    signedInAt: user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : Date.now(),
    supabase: true,
  };
  saveState();
}

async function signOutCurrentUser() {
  if (window.JaritnyangDB?.isConfigured()) {
    await window.JaritnyangDB.signOut();
  }
  state.currentUser = null;
  state.activeSeat = null;
  saveState();
  render();
}

async function openAccountDialog() {
  if (!state.currentUser) {
    authDialog.showModal();
    return;
  }

  accountNameInput.value = state.currentUser.name || "";
  renderAccountDialog(getDemoAccountData());
  accountDialog.showModal();

  const db = window.JaritnyangDB;
  if (!db?.isConfigured() || !state.currentUser.supabase) return;

  try {
    const data = await db.loadAccountData();
    renderAccountDialog(data);
  } catch (error) {
    console.warn(error);
    accountSessions.innerHTML = '<p class="empty-state">계정 정보를 불러오지 못했어요. Supabase 권한 설정을 확인해주세요.</p>';
  }
}

function renderAccountDialog(data) {
  const user = state.currentUser;
  const profile = data.profile || {};
  const pointBalanceValue = profile.point_balance ?? state.points ?? 0;
  const trustScore = profile.trust_score ?? 70;
  accountNameInput.value = profile.display_name || user.name || "";
  accountSummary.innerHTML = `
    <div class="account-metric">
      <span>로그인 방식</span>
      <strong>${getAuthMethodLabel(user.method)}</strong>
    </div>
    <div class="account-metric">
      <span>계정</span>
      <strong>${user.contact || "연결됨"}</strong>
    </div>
    <div class="account-metric">
      <span>포인트</span>
      <strong>${pointBalanceValue}P</strong>
    </div>
    <div class="account-metric">
      <span>냥뢰도</span>
      <strong>${trustScore}%</strong>
    </div>
  `;
  accountSessions.innerHTML = renderAccountItems(
    data.sessions,
    (session) => `${getSessionStatusLabel(session.status)} · ${formatDateTime(session.created_at || session.startedAt)} · ${session.memo || "좌석 이용"}`,
    "아직 좌석 이용 기록이 없어요.",
  );
  accountPoints.innerHTML = renderAccountItems(
    data.pointEvents,
    (event) => `${event.amount > 0 ? "+" : ""}${event.amount}P · ${event.reason || "point"} · ${formatDateTime(event.created_at)}`,
    "아직 포인트 기록이 없어요.",
  );
  accountVisits.innerHTML = renderAccountItems(
    [...data.verifiedVisits, ...data.billingEvents],
    (item) =>
      item.amount !== undefined
        ? `${formatCurrency(item.amount)} · ${item.reason || "billing"} · ${formatDateTime(item.created_at)}`
        : `${item.verification_method || "visit"} 인증 · ${formatDateTime(item.verified_at || item.created_at)}`,
    "아직 방문/광고 기록이 없어요.",
  );
}

function renderAccountItems(items = [], formatter, emptyText) {
  if (!items.length) return `<p class="empty-state">${emptyText}</p>`;
  return items
    .slice(0, 8)
    .map((item) => `<div class="account-list-item">${formatter(item)}</div>`)
    .join("");
}

function getDemoAccountData() {
  const active = state.activeSeat;
  const activeStore = active ? state.stores.find((store) => store.id === active.storeId) : null;
  const activeSeat = activeStore?.seats.find((seat) => seat.id === active.seatId);
  return {
    profile: {
      display_name: state.currentUser?.name,
      point_balance: state.points,
      trust_score: 70,
    },
    sessions: activeSeat
      ? [
          {
            status: "active",
            memo: `${activeStore.name} · ${activeSeat.label}`,
            startedAt: activeSeat.startedAt,
          },
        ]
      : [],
    pointEvents: state.points
      ? [{ amount: state.points, reason: "demo_balance", created_at: state.currentUser?.signedInAt }]
      : [],
    verifiedVisits: [],
    billingEvents: state.billingEvents || [],
  };
}

async function saveAccountProfile() {
  if (!state.currentUser) return;
  const displayName = accountNameInput.value.trim() || "자릿냥이";
  state.currentUser.name = displayName;
  saveState();
  render();

  const db = window.JaritnyangDB;
  if (db?.isConfigured() && state.currentUser.supabase) {
    try {
      await db.updateProfile({ displayName });
      searchStatus.textContent = "계정 닉네임이 저장되었습니다.";
    } catch (error) {
      console.warn(error);
      searchStatus.textContent = "닉네임은 화면에 저장됐지만 Supabase 저장은 실패했어요.";
    }
  } else {
    searchStatus.textContent = "데모 계정 닉네임이 저장되었습니다.";
  }

  await openAccountDialog();
}

function findMyActiveSeat() {
  for (const store of state.stores) {
    const seat = store.seats.find((item) => item.userToken === "me" && item.status === "occupied");
    if (seat) return { store, seat };
  }
  return null;
}

async function syncStartSeatSession(store, seat, expectedEndAt, memo) {
  const db = window.JaritnyangDB;
  if (!db?.isConfigured()) return;

  try {
    const session = await db.startSeatSession({
      storeId: store.id,
      seatId: seat.id,
      expectedEndAt: new Date(expectedEndAt).toISOString(),
      memo,
    });
    seat.remoteSessionId = session.id;
    if (state.activeSeat?.seatId === seat.id) state.activeSeat.remoteSessionId = session.id;
    saveState();
  } catch (error) {
    console.warn(error);
    searchStatus.textContent = "Seat was saved locally, but DB sync needs a real Supabase login.";
  }
}

async function syncEndSeatSession(sessionId) {
  const db = window.JaritnyangDB;
  if (!db?.isConfigured() || !sessionId) return;

  try {
    await db.endSeatSession(sessionId);
  } catch (error) {
    console.warn(error);
    searchStatus.textContent = "Seat was released locally, but DB sync did not finish.";
  }
}

async function syncVerifiedVisit(store, seat) {
  const db = window.JaritnyangDB;
  if (!db?.isConfigured()) return;

  try {
    await db.verifyVisit({
      storeId: store.id,
      sessionId: seat.remoteSessionId || state.activeSeat?.remoteSessionId || null,
      method: "receipt_code",
    });
  } catch (error) {
    console.warn(error);
    searchStatus.textContent = "Visit was verified locally, but DB sync needs a real Supabase login.";
  }
}

function signInDemoUser(method, name, contact) {
  state.currentUser = {
    id: `user-${hashText(`${method}-${contact}`)}`,
    method,
    name,
    contact,
    signedInAt: Date.now(),
  };
  searchStatus.textContent =
    `${name}님으로 로그인했습니다. 실제 서비스에서는 Supabase Auth와 ${getAuthMethodLabel(method)} 인증을 연결합니다.`;
  saveState();
  render();
}

async function searchGooglePlaces() {
  const query = buildGoogleQuery();
  if (!query) {
    searchStatus.textContent = "검색어를 입력하면 Google Places 기준으로 매장을 찾을 수 있어요.";
    return;
  }

  googleSearchButton.disabled = true;
  searchStatus.textContent = `"${query}" 기준으로 Google Places를 확인하는 중입니다.`;

  try {
    const response = await fetch(
      `${GOOGLE_PLACES_SEARCH_ENDPOINT}?query=${encodeURIComponent(query)}&display=5`,
    );
    if (!response.ok) throw new Error("GOOGLE_SEARCH_UNAVAILABLE");

    const data = await response.json();
    const stores = (data.items || []).map(normalizeGoogleStore);
    if (!stores.length) {
      searchStatus.textContent = "구글 검색 결과가 없어서 현재 데모 매장을 유지합니다.";
      return;
    }

    mergeStores(stores);
    selectedStoreId = stores[0].id;
    saveState();
    searchStatus.textContent =
      `Google Places 결과 ${stores.length}곳을 불러오고, 좌석 현황은 자릿냥 데이터로 연결했습니다.`;
    render();
  } catch {
    searchStatus.textContent =
      "현재는 데모 모드입니다. GOOGLE_MAPS_API_KEY를 넣고 server.js로 실행하면 실제 구글 장소 검색이 연결됩니다.";
  } finally {
    googleSearchButton.disabled = false;
  }
}

async function findNearbyStores() {
  if (!navigator.geolocation) {
    searchStatus.textContent = "이 브라우저에서는 위치 확인을 사용할 수 없어요.";
    return;
  }

  nearbyButton.disabled = true;
  searchStatus.textContent = "현재 위치를 확인하는 중입니다.";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      state.userLocation = location;
      searchStatus.textContent = "내 위치 주변 매장을 Google Places 기준으로 확인하는 중입니다.";

      try {
        const category = categoryFilter.value;
        const response = await fetch(
          `${GOOGLE_PLACES_NEARBY_ENDPOINT}?lat=${location.lat}&lng=${location.lng}&category=${category}&display=8`,
        );
        if (!response.ok) throw new Error("GOOGLE_NEARBY_UNAVAILABLE");

        const data = await response.json();
        const stores = (data.items || []).map(normalizeGoogleStore);
        if (!stores.length) throw new Error("EMPTY_NEARBY");
        stores.forEach((store) => {
          store.distanceKm =
            store.lat && store.lng
              ? calculateDistanceKm(location.lat, location.lng, store.lat, store.lng)
              : null;
        });

        mergeStores(stores);
        sortStoresByDistance(location);
        selectedStoreId = stores[0].id;
        searchStatus.textContent =
          `내 위치 주변 Google Places 결과 ${stores.length}곳을 불러왔습니다.`;
      } catch {
        sortStoresByDistance(location);
        selectedStoreId = state.stores[0].id;
        searchStatus.textContent =
          "Google Places 키가 없어 데모 매장을 현재 위치와 가까운 순서로 정렬했습니다.";
      } finally {
        saveState();
        render();
        nearbyButton.disabled = false;
      }
    },
    () => {
      searchStatus.textContent = "위치 권한이 필요합니다. 브라우저에서 위치 허용을 선택해주세요.";
      nearbyButton.disabled = false;
    },
    {
      enableHighAccuracy: true,
      maximumAge: 60000,
      timeout: 10000,
    },
  );
}

function buildGoogleQuery() {
  const query = searchInput.value.trim();
  const category = categoryFilter.value;
  const categoryText = {
    all: "",
    cafe: "카페",
    food: "음식점",
    study: "스터디카페",
  }[category];
  return [query, categoryText].filter(Boolean).join(" ").trim();
}

function normalizeGoogleStore(item) {
  const name = item.displayName?.text || item.name || "이름 없는 장소";
  const address = item.formattedAddress || item.shortFormattedAddress || "주소 정보 없음";
  const category = inferCategory(`${(item.types || []).join(" ")} ${name}`);
  const lat = item.location?.latitude || null;
  const lng = item.location?.longitude || null;
  const seed = hashText(`${item.id}-${name}-${address}`);
  const totalSeats = 8 + (seed % 18);
  const store = createStore(
    `google-${seed}`,
    name,
    category,
    address,
    totalSeats,
    getGoogleTypeLabel(item.types) || "Google Places로 찾은 매장",
    lat,
    lng,
  );
  store.externalId = item.id || `${lat}-${lng}`;
  store.source = "google-places";
  store.roadAddress = address;
  store.googleMapsUrl = createGoogleMapsSearchUrl(name, address, lat, lng, item.id);
  store.googleMapsEmbedUrl = createGoogleMapsEmbedUrl(name, address, lat, lng);
  store.activity = ["Google Places 결과에 자릿냥 좌석 데이터를 연결했습니다."];
  ensureStoreShape(store);
  return store;
}

function mergeStores(stores) {
  stores.forEach((store) => {
    const existingIndex = state.stores.findIndex(
      (item) => item.externalId && item.externalId === store.externalId,
    );
    if (existingIndex >= 0) {
      state.stores[existingIndex] = {
        ...state.stores[existingIndex],
        ...store,
        seats: state.stores[existingIndex].seats,
        activity: state.stores[existingIndex].activity,
      };
    } else {
      state.stores.unshift(store);
    }
  });
}

function render() {
  expireSeats();
  state.stores.forEach(ensureStoreShape);
  pointBalance.textContent = `${state.points}P`;
  renderUserPanel();
  renderStoreList();
  renderStoreDetail();
}

function renderUserPanel() {
  accountButton.hidden = false;
  if (!state.currentUser) {
    userStatus.textContent = "비회원";
    authButton.textContent = "로그인";
    return;
  }
  userStatus.textContent = `${state.currentUser.name} · ${getAuthMethodLabel(state.currentUser.method)}`;
  authButton.textContent = "로그아웃";
}

function renderStoreList() {
  const queryTokens = searchInput.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const category = categoryFilter.value;
  const stores = state.stores.filter((store) => {
    const searchableText =
      `${store.name} ${store.address} ${store.roadAddress} ${store.note} ${getCategoryLabel(store.category)}`.toLowerCase();
    const matchesQuery = queryTokens.every((token) => searchableText.includes(token));
    const matchesCategory = category === "all" || store.category === category;
    return matchesQuery && matchesCategory;
  });

  if (!stores.length) {
    storeList.innerHTML = '<p class="empty-state">조건에 맞는 매장이 없습니다.</p>';
    return;
  }

  if (!stores.some((store) => store.id === selectedStoreId)) {
    selectedStoreId = stores[0].id;
  }

  storeList.innerHTML = "";
  stores.forEach((store) => {
    const stats = getStoreStats(store);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `store-button ${store.id === selectedStoreId ? "active" : ""}`;
    button.innerHTML = `
      <div class="store-name-row">
        <strong>${store.name}</strong>
        <span class="badge ${store.adCampaign?.active ? "ad" : stats.badgeType}">${store.adCampaign?.active ? "광고" : stats.label}</span>
      </div>
      <p class="store-address">${store.address}</p>
      <div class="meta-row">
        <span class="store-note">잔여 ${stats.available}석 / 전체 ${store.totalSeats}석</span>
        <span class="store-note">${getStoreDistanceText(store)}</span>
      </div>
    `;
    button.addEventListener("click", () => {
      selectedStoreId = store.id;
      saveState();
      render();
    });
    storeList.append(button);
  });
}

function renderStoreDetail() {
  const store = getSelectedStore();
  const stats = getStoreStats(store);
  const cooldown = getPointCooldown();
  const leaveButtonLabel =
    cooldown.remainingMs > 0
      ? `자리 비우기 (${formatRemainingTime(cooldown.remainingMs)})`
      : "자리 비우기";
  storeDetail.innerHTML = `
    <div class="detail-inner">
      <div class="detail-header">
        <div class="detail-title">
          <p class="eyebrow">${getCategoryLabel(store.category)}</p>
          <h2>${store.name}</h2>
          <p class="store-address">${store.address}</p>
          <p class="store-note">${store.note}</p>
        </div>
        <span class="badge ${stats.badgeType}">${stats.label}</span>
      </div>

      <div class="map-panel">
        <div>
          <p class="eyebrow">Google Maps 기준 위치</p>
          <strong>${store.roadAddress || store.address}</strong>
          <span>${store.lat && store.lng ? `${store.lat.toFixed(5)}, ${store.lng.toFixed(5)}` : "좌표 준비 중"}</span>
        </div>
        <a class="map-link" href="${store.googleMapsUrl}" target="_blank" rel="noopener">구글맵 열기</a>
      </div>

      <div class="google-map-shell">
        <iframe
          title="${store.name} Google Maps"
          src="${store.googleMapsEmbedUrl}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          allowfullscreen
        ></iframe>
      </div>

      <div class="business-panel">
        <div class="business-card">
          <span>광고 상태</span>
          <strong>${store.adCampaign?.active ? "운영 중" : "미운영"}</strong>
        </div>
        <div class="business-card">
          <span>검증 방문</span>
          <strong>${store.adCampaign?.verifiedVisits || 0}건</strong>
        </div>
        <div class="business-card">
          <span>예상 광고비</span>
          <strong>${formatCurrency(store.adCampaign?.spend || 0)}</strong>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat">
          <span>지금 남은 자리</span>
          <strong>${stats.available}</strong>
        </div>
        <div class="stat">
          <span>곧 비는 자리</span>
          <strong>${stats.soon}</strong>
        </div>
        <div class="stat">
          <span>냥뢰도</span>
          <strong>${stats.reliability}%</strong>
        </div>
      </div>

      <div class="action-row">
        ${
          state.activeSeat?.storeId === store.id
            ? `<button id="leaveSeatButton" class="danger-button" type="button" ${cooldown.remainingMs > 0 ? "disabled" : ""}>${leaveButtonLabel}</button>`
            : ""
        }
        ${
          state.activeSeat?.storeId === store.id
            ? `<button id="verifyVisitButton" class="primary-button" type="button">${getActiveSeat(store)?.verifiedAt ? "방문 인증 완료" : "방문 인증"}</button>`
            : ""
        }
        <button id="simulateButton" class="ghost-button" type="button">방문자 업데이트 추가</button>
      </div>
      ${
        state.activeSeat?.storeId === store.id
          ? `<p class="policy-note">${cooldown.remainingMs > 0 ? "포인트 적립은 1시간에 한 번만 가능합니다. 지금 비우면 좌석만 비워지고 포인트는 적립되지 않아요." : "예상보다 일찍 비우면 포인트가 적립됩니다. 단, 포인트 적립은 1시간에 한 번만 가능합니다."}</p>`
          : ""
      }

      <h3>자리 발자국</h3>
      <div class="seat-editor-panel">
        <div class="seat-editor-toolbar">
          <label class="upload-button" for="floorPlanInput">사진으로 좌석도</label>
          <input id="floorPlanInput" type="file" accept="image/*" capture="environment" hidden />
          <button id="toggleEditModeButton" class="ghost-button" type="button">
            ${seatEditMode ? "편집 종료" : "매장주 수정"}
          </button>
          <button id="addSeatButton" class="ghost-button" type="button">좌석 추가</button>
          <button id="removeSeatButton" class="ghost-button" type="button">마지막 좌석 삭제</button>
        </div>
        <div
          id="seatMap"
          class="seat-map ${store.floorPlanImage ? "has-photo" : ""} ${seatEditMode ? "editing" : ""}"
          style="${store.floorPlanImage ? `background-image: url('${store.floorPlanImage}')` : ""}"
        >
          ${store.floorPlanImage ? "" : '<div class="seat-map-empty">매장 사진을 찍거나 올리면 그 위에 좌석 핀을 배치할 수 있어요.</div>'}
        </div>
        <p class="seat-map-help">
          ${seatEditMode ? "수정 모드: 좌석 핀을 누르면 상태가 바뀌고, 빈 공간을 누르면 좌석이 추가됩니다." : "빈 좌석 핀을 누르면 예상 이용 시간을 등록할 수 있어요."}
        </p>
      </div>

      <h3>최근 냥보</h3>
      <ul class="activity-list">
        ${store.activity.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  `;

  const seatMap = document.querySelector("#seatMap");
  store.seats.forEach((seat) => {
    const card = document.createElement("button");
    const isMine = seat.userToken === "me";
    const timerInfo = getSeatTimerInfo(seat);
    card.type = "button";
    card.className = `seat-pin ${seat.status === "available" ? "available" : "occupied"}`;
    if (timerInfo.isSoon) card.classList.add("soon");
    if (isMine) card.classList.add("mine");
    if (seatEditMode) card.classList.add("editing");
    card.style.left = `${seat.x}%`;
    card.style.top = `${seat.y}%`;
    const label = document.createElement("span");
    label.className = "seat-pin-label";
    label.textContent = seat.label.replace(" 좌석", "");
    const time = document.createElement("span");
    time.className = "seat-pin-time";
    time.textContent = timerInfo.label;
    card.append(label, time);
    card.title = `${seat.label} · ${timerInfo.title}`;
    card.addEventListener("click", (event) => {
      event.stopPropagation();
      if (seatEditMode) {
        toggleSeatStatus(store, seat);
        saveState();
        render();
        return;
      }
      if (seat.status === "available" || seat.userToken === "me") {
        openCheckInDialog(seat);
      }
    });
    seatMap.append(card);
  });

  seatMap.addEventListener("click", (event) => {
    if (!seatEditMode || event.target !== seatMap) return;
    const rect = seatMap.getBoundingClientRect();
    addSeatAt(store, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
    saveState();
    render();
  });

  document.querySelector("#floorPlanInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      store.floorPlanImage = reader.result;
      store.activity = [
        `${formatClock(Date.now())} 좌석도 사진이 업데이트되었습니다.`,
        ...store.activity.filter((item) => !item.includes("아직 등록된")),
      ].slice(0, 5);
      saveState();
      render();
    });
    reader.readAsDataURL(file);
  });

  document.querySelector("#toggleEditModeButton").addEventListener("click", () => {
    seatEditMode = !seatEditMode;
    render();
  });

  document.querySelector("#addSeatButton").addEventListener("click", () => {
    addSeatAt(store, 50, 50);
    saveState();
    render();
  });

  document.querySelector("#removeSeatButton").addEventListener("click", () => {
    if (store.seats.length <= 1) return;
    store.seats.pop();
    store.totalSeats = store.seats.length;
    store.activity = [
      `${formatClock(Date.now())} 매장주가 좌석 수를 ${store.totalSeats}석으로 수정했습니다.`,
      ...store.activity.filter((item) => !item.includes("아직 등록된")),
    ].slice(0, 5);
    saveState();
    render();
  });

  document.querySelector("#leaveSeatButton")?.addEventListener("click", () => {
    const cooldown = getPointCooldown();
    if (cooldown.remainingMs > 0) {
      searchStatus.textContent = `자리 비우기는 ${formatRemainingTime(cooldown.remainingMs)} 후 다시 사용할 수 있어요.`;
      return;
    }
    releaseCurrentSeat(true);
    saveState();
    render();
  });

  document.querySelector("#verifyVisitButton")?.addEventListener("click", () => {
    if (!state.currentUser) {
      authDialog.showModal();
      return;
    }
    if (getActiveSeat(store)?.verifiedAt) {
      searchStatus.textContent = "이미 방문 인증이 완료되었습니다.";
      return;
    }
    visitCodeInput.value = "";
    visitDialog.showModal();
  });

  document.querySelector("#simulateButton").addEventListener("click", () => {
    simulateVisitorUpdate(store);
    saveState();
    render();
  });
}

function openCheckInDialog(seat) {
  if (!state.currentUser) {
    searchStatus.textContent = "좌석 이용과 포인트 적립은 로그인 후 사용할 수 있어요.";
    authDialog.showModal();
    return;
  }
  pendingSeatId = seat.id;
  durationInput.value = 60;
  durationOutput.value = "60분";
  memoInput.value = "";
  dialogTitle.textContent = `${seat.label} 이용 등록`;
  checkInDialog.showModal();
}

function releaseCurrentSeat(earnPoints) {
  const active = state.activeSeat;
  if (!active) return;

  const store = state.stores.find((item) => item.id === active.storeId);
  const seat = store?.seats.find((item) => item.id === active.seatId);
  if (!seat) return;

  const now = Date.now();
  const leftEarly = now < seat.expectedEndAt;
  const minutesEarly = Math.max(0, Math.round((seat.expectedEndAt - now) / 60000));
  const cooldown = getPointCooldown(now);
  const isVerified = Boolean(seat.verifiedAt);
  const canEarnPoints = earnPoints && leftEarly && isVerified && cooldown.remainingMs === 0;
  const earned = canEarnPoints ? Math.min(50, Math.max(5, minutesEarly)) : 0;
  const remoteSessionId = seat.remoteSessionId || active.remoteSessionId;

  state.points += earned;
  if (earned > 0) state.lastPointEarnedAt = now;
  store.activity = [
    earned > 0
      ? `${formatClock(now)} ${seat.label}을 예상보다 ${minutesEarly}분 일찍 비워 ${earned}P가 적립되었습니다.`
      : earnPoints && leftEarly && !isVerified
        ? `${formatClock(now)} ${seat.label}을 비웠지만 방문 인증이 없어 포인트는 적립되지 않았습니다.`
      : earnPoints && leftEarly && cooldown.remainingMs > 0
        ? `${formatClock(now)} ${seat.label}을 비웠지만 1시간 제한으로 포인트는 적립되지 않았습니다.`
      : `${formatClock(now)} ${seat.label} 이용이 종료되었습니다.`,
    ...store.activity.filter((item) => !item.includes("아직 등록된")),
  ].slice(0, 5);

  seat.status = "available";
  seat.startedAt = null;
  seat.expectedEndAt = null;
  seat.userToken = null;
  seat.memo = "";
  seat.verifiedAt = null;
  seat.remoteSessionId = null;
  state.activeSeat = null;
  void syncEndSeatSession(remoteSessionId);
}

function verifyCurrentVisit() {
  const active = state.activeSeat;
  if (!active || !state.currentUser) return;

  const store = state.stores.find((item) => item.id === active.storeId);
  const seat = store?.seats.find((item) => item.id === active.seatId);
  if (!store || !seat) return;
  if (seat.verifiedAt) {
    searchStatus.textContent = "이미 방문 인증이 완료되었습니다.";
    return;
  }

  const code = visitCodeInput.value.trim().toUpperCase();
  if (code !== "NYANG" && code.length < 4) {
    searchStatus.textContent = "방문 인증 코드를 확인해주세요. 데모 코드는 NYANG입니다.";
    return;
  }

  const now = Date.now();
  seat.verifiedAt = now;
  state.activeSeat.verifiedAt = now;
  recordVerifiedVisit(store, now);
  void syncVerifiedVisit(store, seat);
  store.activity = [
    `${formatClock(now)} ${state.currentUser.name}님의 실제 방문이 인증되었습니다.`,
    ...store.activity.filter((item) => !item.includes("아직 등록된")),
  ].slice(0, 5);
  searchStatus.textContent = "방문 인증이 완료되었습니다. 실제 서비스에서는 QR/NFC/영수증 코드로 검증합니다.";
  saveState();
  render();
}

function recordVerifiedVisit(store, now) {
  ensureAdCampaign(store);
  if (!store.adCampaign.active) return;

  store.adCampaign.verifiedVisits += 1;
  store.adCampaign.spend += store.adCampaign.feePerVerifiedVisit;
  state.billingEvents.unshift({
    id: `bill-${now}`,
    storeId: store.id,
    userId: state.currentUser.id,
    amount: store.adCampaign.feePerVerifiedVisit,
    reason: "verified_visit",
    createdAt: now,
  });
  state.billingEvents = state.billingEvents.slice(0, 20);
}

function simulateVisitorUpdate(store) {
  const availableSeat = store.seats.find((seat) => seat.status === "available");
  if (!availableSeat) return;

  const now = Date.now();
  const duration = [30, 45, 60, 90][Math.floor(Math.random() * 4)];
  availableSeat.status = "occupied";
  availableSeat.startedAt = now;
  availableSeat.expectedEndAt = now + duration * 60 * 1000;
  availableSeat.userToken = `visitor-${Math.random().toString(16).slice(2)}`;
  availableSeat.memo = "방문자 냥보";
  store.activity = [
    `${formatClock(now)} 다른 방문자가 ${availableSeat.label} 이용 시간을 ${duration}분으로 등록했습니다.`,
    ...store.activity.filter((item) => !item.includes("아직 등록된")),
  ].slice(0, 5);
}

function expireSeats() {
  const now = Date.now();
  let changed = false;
  state.stores.forEach((store) => {
    store.seats.forEach((seat) => {
      if (seat.status === "occupied" && seat.expectedEndAt <= now) {
        if (seat.userToken === "me") state.activeSeat = null;
        seat.status = "available";
        seat.startedAt = null;
        seat.expectedEndAt = null;
        seat.userToken = null;
        seat.memo = "";
        seat.verifiedAt = null;
        seat.remoteSessionId = null;
        changed = true;
      }
    });
  });
  if (changed) saveState();
}

function ensureStoreShape(store) {
  store.roadAddress ||= store.address;
  store.floorPlanImage ||= null;
  store.googleMapsUrl ||= createGoogleMapsSearchUrl(store.name, store.address, store.lat, store.lng);
  store.googleMapsEmbedUrl ||= createGoogleMapsEmbedUrl(store.name, store.address, store.lat, store.lng);
  ensureAdCampaign(store);
  store.seats.forEach((seat, index) => {
    if (!Number.isFinite(seat.x) || !Number.isFinite(seat.y)) {
      const columns = Math.ceil(Math.sqrt(store.seats.length));
      const rows = Math.ceil(store.seats.length / columns);
      const position = getSeatPosition(index, columns, rows);
      seat.x = position.x;
      seat.y = position.y;
    }
  });
}

function ensureAdCampaign(store) {
  store.adCampaign ||= {
    active: false,
    feePerVerifiedVisit: VERIFIED_VISIT_AD_FEE,
    verifiedVisits: 0,
    spend: 0,
    budget: 50000,
  };
}

function getActiveSeat(store) {
  if (!state.activeSeat || state.activeSeat.storeId !== store.id) return null;
  return store.seats.find((seat) => seat.id === state.activeSeat.seatId) || null;
}

function getSelectedStore() {
  return state.stores.find((store) => store.id === selectedStoreId) || state.stores[0];
}

function getStoreStats(store) {
  const available = store.seats.filter((seat) => seat.status === "available").length;
  const occupied = store.totalSeats - available;
  const soon = store.seats.filter((seat) => {
    if (seat.status !== "occupied") return false;
    return seat.expectedEndAt - Date.now() <= 15 * 60 * 1000;
  }).length;
  const reliability = Math.max(72, Math.round(96 - occupied * 1.4 + soon * 1.8));
  let badgeType = "good";
  let label = "여유";
  if (available <= 2 && soon > 0) {
    badgeType = "soon";
    label = "곧 비냥";
  } else if (available <= 2) {
    badgeType = "full";
    label = "빽빽냥";
  }
  return {
    available,
    soon,
    reliability,
    badgeType,
    label,
    soonText: soon > 0 ? `${soon}석 15분 내 예상` : "여유 있음",
  };
}

function getPointCooldown(now = Date.now()) {
  if (!state.lastPointEarnedAt) return { remainingMs: 0 };
  const elapsed = now - state.lastPointEarnedAt;
  return {
    remainingMs: Math.max(0, POINT_COOLDOWN_MS - elapsed),
  };
}

function formatRemainingTime(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

function getSeatTimerInfo(seat) {
  if (seat.status === "available") {
    return {
      label: "비었냥",
      title: "바로 이용 가능",
      isSoon: false,
    };
  }

  const remainingMs = Math.max(0, seat.expectedEndAt - Date.now());
  const isSoon = remainingMs <= 15 * 60 * 1000;
  const countdown = formatSeatCountdown(remainingMs);
  return {
    label: countdown,
    title: `${countdown} 후 비울 예정${seat.memo ? ` · ${seat.memo}` : ""}`,
    isSoon,
  };
}

function formatSeatCountdown(ms) {
  if (ms <= 0) return "곧 비움";
  if (ms < 60 * 1000) return `${Math.ceil(ms / 1000)}초`;
  return formatRemainingTime(ms);
}

function addSeatAt(store, x, y) {
  const index = store.seats.length + 1;
  store.seats.push({
    id: `seat-${Date.now()}-${index}`,
    label: `${index}번 좌석`,
    x: Math.max(5, Math.min(95, Math.round(x))),
    y: Math.max(8, Math.min(92, Math.round(y))),
    status: "available",
    startedAt: null,
    expectedEndAt: null,
    userToken: null,
    memo: "",
  });
  store.totalSeats = store.seats.length;
  store.activity = [
    `${formatClock(Date.now())} 매장주가 ${index}번 좌석을 추가했습니다.`,
    ...store.activity.filter((item) => !item.includes("아직 등록된")),
  ].slice(0, 5);
}

function toggleSeatStatus(store, seat) {
  const now = Date.now();
  if (seat.status === "available") {
    seat.status = "occupied";
    seat.startedAt = now;
    seat.expectedEndAt = now + 45 * 60 * 1000;
    seat.userToken = "owner";
    seat.memo = "매장주 수정";
  } else {
    seat.status = "available";
    seat.startedAt = null;
    seat.expectedEndAt = null;
    seat.userToken = null;
    seat.memo = "";
  }
  store.activity = [
    `${formatClock(now)} 매장주가 ${seat.label} 상태를 수정했습니다.`,
    ...store.activity.filter((item) => !item.includes("아직 등록된")),
  ].slice(0, 5);
}

function sortStoresByDistance(location) {
  state.stores.forEach((store) => {
    store.distanceKm =
      store.lat && store.lng ? calculateDistanceKm(location.lat, location.lng, store.lat, store.lng) : null;
  });
  state.stores.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const radius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getStoreDistanceText(store) {
  const source = getSourceLabel(store.source);
  if (!Number.isFinite(store.distanceKm)) return source;
  return `${store.distanceKm.toFixed(1)}km · ${source}`;
}

function getAuthMethodLabel(method) {
  return {
    email: "이메일",
    phone: "전화번호",
    kakao: "카카오톡",
    google: "구글",
  }[method] || "데모";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function inferCategory(text) {
  if (text.includes("스터디")) return "study";
  if (text.includes("카페") || text.includes("커피")) return "cafe";
  return "food";
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, "");
}

function hashText(value) {
  return Array.from(value).reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 7);
}

function getSourceLabel(source) {
  return source === "google-places" ? "구글 기준" : "데모 기준";
}

function createGoogleMapsSearchUrl(name, address, lat, lng, placeId = null) {
  const query = lat && lng ? `${lat},${lng}` : `${name} ${address}`;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  if (placeId) url.searchParams.set("query_place_id", placeId);
  return url.toString();
}

function createGoogleMapsEmbedUrl(name, address, lat, lng) {
  const query = lat && lng ? `${lat},${lng}` : `${name} ${address}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

function getGoogleTypeLabel(types = []) {
  const typeLabels = {
    cafe: "Google Places 카페",
    restaurant: "Google Places 음식점",
    food: "Google Places 음식점",
    bakery: "Google Places 베이커리",
    bar: "Google Places 바",
    university: "Google Places 학습 공간",
    library: "Google Places 학습 공간",
  };
  return types.map((type) => typeLabels[type]).find(Boolean) || "";
}

function getSeatSubText(seat) {
  if (seat.status === "available") return "톡 눌러 이용 시간을 알려주세요.";
  const minutes = Math.max(0, Math.ceil((seat.expectedEndAt - Date.now()) / 60000));
  const memo = seat.memo ? `${seat.memo} · ` : "";
  return `${memo}${minutes}분 후 비울 예정`;
}

function getCategoryLabel(category) {
  return {
    cafe: "카페",
    study: "스터디 공간",
    food: "음식점",
  }[category];
}

function formatClock(time) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

function formatDateTime(time) {
  if (!time) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function getSessionStatusLabel(status) {
  return {
    active: "이용 중",
    ended: "이용 완료",
    expired: "시간 만료",
    reported: "신고됨",
  }[status] || status || "기록";
}
