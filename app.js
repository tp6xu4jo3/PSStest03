(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const rooms = { north: "北側閱覽室", south: "南側閱覽室", floor2: "2 樓閱覽區" };
  const ALL_SLOTS = Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`);
  const ROOM_TOTALS = { north: 24, south: 20, floor2: 10 };

  // --- 座位建築分區與特色配置 ---
  const NORTH_SEATS_CONFIG = [
    // 景觀吧台區 (1..6)
    { no: 1, zone: "景觀吧台區", tag: "靠窗 🪟", features: ["靠窗", "插座 ⚡", "高腳軟椅"] },
    { no: 2, zone: "景觀吧台區", tag: "靠窗 🪟", features: ["靠窗", "插座 ⚡", "高腳軟椅"] },
    { no: 3, zone: "景觀吧台區", tag: "靠窗 🪟", features: ["靠窗", "插座 ⚡", "高腳軟椅"] },
    { no: 4, zone: "景觀吧台區", tag: "靠窗 🪟", features: ["靠窗", "插座 ⚡", "高腳軟椅"] },
    { no: 5, zone: "景觀吧台區", tag: "靠窗 🪟", features: ["靠窗", "插座 ⚡", "高腳軟椅"] },
    { no: 6, zone: "景觀吧台區", tag: "靠窗 🪟", features: ["靠窗", "插座 ⚡", "高腳軟椅"] },
    // 專注 K 書區 (7..14)
    { no: 7, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 8, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 9, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 10, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 11, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 12, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 13, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    { no: 14, zone: "專注 K 書區", tag: "獨立桌 🖥️", features: ["獨立隔板", "防眩檯燈 💡", "插座 ⚡"] },
    // 研討閱覽長桌區 (15..20)
    { no: 15, zone: "研討閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 16, zone: "研討閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 17, zone: "研討閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 18, zone: "研討閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 19, zone: "研討閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 20, zone: "研討閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    // 沉浸沙發區 (21..24)
    { no: 21, zone: "沉浸沙發區", tag: "沙發座 🛋️", features: ["單人沙發", "閱讀立燈 💡"] },
    { no: 22, zone: "沉浸沙發區", tag: "沙發座 🛋️", features: ["單人沙發", "閱讀立燈 💡"] },
    { no: 23, zone: "沉浸沙發區", tag: "沙發座 🛋️", features: ["單人沙發", "側邊茶几 ☕"] },
    { no: 24, zone: "沉浸沙發區", tag: "沙發座 🛋️", features: ["單人沙發", "側邊茶几 ☕"] }
  ];

  const SOUTH_SEATS_CONFIG = [
    // 庭園吧台區 (1..4)
    { no: 1, zone: "庭園吧台區", tag: "靠窗 🪟", features: ["庭園視野", "充電插座 ⚡"] },
    { no: 2, zone: "庭園吧台區", tag: "靠窗 🪟", features: ["庭園視野", "充電插座 ⚡"] },
    { no: 3, zone: "庭園吧台區", tag: "靠窗 🪟", features: ["庭園視野", "充電插座 ⚡"] },
    { no: 4, zone: "庭園吧台區", tag: "靠窗 🪟", features: ["庭園視野", "充電插座 ⚡"] },
    // 靜音 K 書艙 (5..10)
    { no: 5, zone: "靜音 K 書艙", tag: "獨立桌 🖥️", features: ["三面隔板", "專屬檯燈 💡", "插座 ⚡"] },
    { no: 6, zone: "靜音 K 書艙", tag: "獨立桌 🖥️", features: ["三面隔板", "專屬檯燈 💡", "插座 ⚡"] },
    { no: 7, zone: "靜音 K 書艙", tag: "獨立桌 🖥️", features: ["三面隔板", "專屬檯燈 💡", "插座 ⚡"] },
    { no: 8, zone: "靜音 K 書艙", tag: "獨立桌 🖥️", features: ["三面隔板", "專屬檯燈 💡", "插座 ⚡"] },
    { no: 9, zone: "靜音 K 書艙", tag: "獨立桌 🖥️", features: ["三面隔板", "專屬檯燈 💡", "插座 ⚡"] },
    { no: 10, zone: "靜音 K 書艙", tag: "獨立桌 🖥️", features: ["三面隔板", "專屬檯燈 💡", "插座 ⚡"] },
    // 中央閱覽桌 (11..16)
    { no: 11, zone: "中央閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 12, zone: "中央閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 13, zone: "中央閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 14, zone: "中央閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 15, zone: "中央閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    { no: 16, zone: "中央閱覽桌", tag: "大桌面 📚", features: ["實木大桌", "雙向插座 ⚡"] },
    // 休閒沙發區 (17..20)
    { no: 17, zone: "休閒沙發區", tag: "沙發座 🛋️", features: ["休閒沙發", "側邊矮几 ☕"] },
    { no: 18, zone: "休閒沙發區", tag: "沙發座 🛋️", features: ["休閒沙發", "側邊矮几 ☕"] },
    { no: 19, zone: "休閒沙發區", tag: "沙發座 🛋️", features: ["休閒沙發", "立燈 💡"] },
    { no: 20, zone: "休閒沙發區", tag: "沙發座 🛋️", features: ["休閒沙發", "立燈 💡"] }
  ];

  const FLOOR2_SEATS_CONFIG = Array.from({ length: 10 }, (_, index) => {
    const no = index + 1;
    const zone = no <= 4 ? "窗邊閱讀桌" : no <= 8 ? "中央共讀桌" : "安靜角落";
    return { no, zone, tag: "獨立座位", features: ["桌椅", "插座 ⚡"] };
  });

  let sb, session = null, profile = null, selectedSeat = null, seatView = null;
  let currentAuth = "login", toastTimer, currentView = "booking";
  let currentQueryId = 0; // 查詢防競爭識別碼
  let realtimeChannel = null, pollingTimer = null, remoteDebounceTimer = null;
  let cachedReservations = [];
  let adminLoadId = 0, filteredAdminReservations = [];

  // --- 台北時區處理 ---
  function getTaipeiDateTime() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(new Date());
    const map = {};
    parts.forEach(p => map[p.type] = p.value);
    return {
      dateStr: `${map.year}-${map.month}-${map.day}`,
      hour: Number(map.hour),
      minute: Number(map.minute)
    };
  }

  const localDate = () => getTaipeiDateTime().dateStr;

  const shiftDate = (n) => {
    const [y, m, d] = localDate().split("-").map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + n));
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  };

  const shiftDateFrom = (baseStr, n) => {
    const [y, m, d] = baseStr.split("-").map(Number);
    const x = new Date(Date.UTC(y, m - 1, d + n));
    return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
  };

  function isSlotUpcoming(slot, selectedDate) {
    const { dateStr, hour } = getTaipeiDateTime();
    if (selectedDate < dateStr) return false;
    if (selectedDate > dateStr) return true;
    const slotHour = Number(slot.slice(0, 2));
    // 當日時段：已開始或結束的時段不算尚未開始
    return slotHour > hour;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  function notify(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3300);
  }

  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.dataset.label ??= btn.textContent;
    btn.textContent = busy ? "處理中…" : label || btn.dataset.label;
  }

  function getSeatConfig(room, seatNo) {
    const list = room === "north" ? NORTH_SEATS_CONFIG
      : room === "south" ? SOUTH_SEATS_CONFIG
      : FLOOR2_SEATS_CONFIG;
    return list.find(s => s.no === seatNo) || { no: seatNo, zone: "一般座位", tag: "閱覽座", features: [] };
  }

  // --- 初始化流程 ---
  function init() {
    $("year").textContent = new Date().getFullYear();
    $("today-label").textContent = localDate().replaceAll("-", ".");
    $("date-select").min = shiftDate(0);
    $("date-select").max = shiftDate(7);
    $("date-select").value = shiftDate(0);

    $("block-date").min = shiftDate(0);
    $("block-date").max = shiftDate(7);
    $("block-date").value = shiftDate(0);
    $("block-slot").innerHTML = ALL_SLOTS.map(s => `<option value="${s}">${s}–${String(Number(s.slice(0, 2)) + 1).padStart(2, "0")}:00</option>`).join("");

    updateAdminSeatOptions();
    $("admin-room").addEventListener("change", updateAdminSeatOptions);
    ["admin-filter-room", "admin-filter-date-from", "admin-filter-date-to", "admin-filter-status"]
      .forEach(id => $(id).addEventListener("change", loadAdminReservations));

    $("room-select").addEventListener("change", () => {
      selectedSeat = null;
      updateRoomFoot();
      onDateOrRoomChanged();
    });

    $("date-select").addEventListener("change", () => {
      selectedSeat = null;
      onDateOrRoomChanged();
    });

    $("slot-select").addEventListener("change", () => {
      selectedSeat = null;
      refreshSeats();
    });

    $("bookable-only").onchange = renderMap;
    $("clear-filter").onclick = clearFilter;
    $("confirm-booking").addEventListener("click", book);
    $("auth-open").onclick = () => openAuth();
    $("auth-close").onclick = () => $("auth-modal").classList.add("hidden");
    $("logout").onclick = logout;

    document.querySelectorAll("[data-auth]").forEach(b => b.onclick = () => switchAuth(b.dataset.auth));
    document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => showView(b.dataset.view));
    $("auth-form").onsubmit = authenticate;
    $("admin-refresh").onclick = loadAdmin;
    $("blocked-refresh").onclick = loadBlockedSlots;
    $("admin-export-csv").onclick = exportAdminCsv;
    $("toggle-seat").onclick = toggleSeat;
    $("block-submit").onclick = blockSlot;

    updateRoomFoot();

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      notify("請先在 config.js 填入 Supabase URL 與 Publishable Key。");
      $("floorplan").innerHTML = '<div class="empty">尚未設定 Supabase。請先編輯 config.js，再重新整理頁面。</div>';
      return;
    }

    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);

    setupRealtime();
    startPolling();

    sb.auth.getSession().then(({ data }) => {
      session = data.session;
      loadProfile().finally(() => onDateOrRoomChanged());
    });

    sb.auth.onAuthStateChange((_event, s) => {
      session = s;
      loadProfile().finally(() => {
        updateAccount();
        refreshSeats({ isBackground: true });
      });
    });

    onDateOrRoomChanged();
  }

  function updateRoomFoot() {
    const room = $("room-select") ? $("room-select").value : "north";
    const total = ROOM_TOTALS[room] || 24;
    const el = $("room-total-seats");
    if (el) el.textContent = total;
  }

  function updateAdminSeatOptions() {
    const room = $("admin-room").value;
    const count = ROOM_TOTALS[room] || 24;
    $("admin-seat").innerHTML = Array.from({ length: count }, (_, i) =>
      `<option value="${i + 1}">座位 ${String(i + 1).padStart(2, "0")}</option>`
    ).join("");
  }

  // --- 即時更新與輪詢 (Realtime & Polling) ---
  function setupRealtime() {
    if (!sb) return;
    try {
      realtimeChannel = sb.channel("library-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => onRemoteChange())
        .on("postgres_changes", { event: "*", schema: "public", table: "blocked_slots" }, () => onRemoteChange())
        .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, () => onRemoteChange())
        .subscribe((status) => {
          console.log("[Supabase Realtime] 連線狀態:", status);
        });
    } catch (err) {
      console.warn("Realtime 初始化警告:", err);
    }
  }

  function startPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    // 每 5 秒自動靜默重新整理目前選定條件，無須重整頁面
    pollingTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshSeats({ isBackground: true });
      }
    }, 5000);
  }

  function onRemoteChange() {
    // 收到即時推播，防抖 200ms 後靜默更新，保護隱私不傳遞學號或個人資訊
    clearTimeout(remoteDebounceTimer);
    remoteDebounceTimer = setTimeout(() => {
      refreshSeats({ isBackground: true });
      if (currentView === "mine") loadMine();
      if (currentView === "admin") loadAdmin();
    }, 200);
  }

  // --- 自動尋找最早可訂時段（移除「請選擇時段」） ---
  async function onDateOrRoomChanged() {
    const queryId = ++currentQueryId;
    const room = $("room-select").value;
    const date = $("date-select").value;

    $("availability-count").textContent = "正在搜尋最早可預約時段…";
    $("floorplan").innerHTML = '<div class="loading">正在搜尋最早可預約時段…</div>';
    showEmpty("");
    $("confirm-booking").disabled = true;

    try {
      const earliestSlot = await findEarliestBookableSlot(room, date, queryId);
      if (queryId !== currentQueryId) return; // 舊查詢作廢

      if (!earliestSlot) {
        // 本日無可預約時段
        $("slot-select").innerHTML = '<option value="">（本日無可預約時段）</option>';
        $("availability-count").textContent = "此日期已無可預約時段";
        $("floorplan").innerHTML = `
          <div class="empty-state" style="margin:30px auto;max-width:420px;padding:26px;">
            <p style="font-size:13px;color:var(--text);margin-bottom:8px;"><strong>此日期已無任何可預約時段</strong></p>
            <p style="margin-bottom:18px;">所有開放時段皆已結束、客滿或被館員封鎖。請選擇其他日期。</p>
            <button id="btn-next-available-day" class="primary-button" type="button" style="justify-content:center;height:42px;">
              查看下一天（${shiftDateFrom(date, 1)}）➔
            </button>
          </div>
        `;
        const nextBtn = $("btn-next-available-day");
        if (nextBtn) {
          nextBtn.onclick = () => {
            const nextDate = shiftDateFrom(date, 1);
            if (nextDate <= shiftDate(7)) {
              $("date-select").value = nextDate;
              onDateOrRoomChanged();
            } else {
              notify("已達最長預約天數（7天以內）。");
            }
          };
        }
        seatView = null;
        updateSummary();
        return;
      }

      // 填入時段選單（移除「請選擇時段」選項），並選取最早可訂時段
      fillSlots(earliestSlot);
      refreshSeats({ overrideSlot: earliestSlot, designatedQueryId: queryId });
    } catch (err) {
      if (queryId !== currentQueryId) return;
      console.error(err);
      $("availability-count").textContent = "時段載入失敗";
      fillSlots(ALL_SLOTS[0]);
      refreshSeats();
    }
  }

  async function findEarliestBookableSlot(room, date, queryId) {
    const upcoming = ALL_SLOTS.filter(s => isSlotUpcoming(s, date));
    if (!upcoming.length) return null;

    // 取得當天被封鎖的時段
    const { data: blocked } = await sb.from("blocked_slots").select("start_time").eq("room_code", room).eq("reservation_date", date);
    if (queryId !== currentQueryId) return null;
    const blockedTimes = new Set((blocked || []).map(b => b.start_time.slice(0, 5)));

    const candidateSlots = upcoming.filter(s => !blockedTimes.has(s));
    if (!candidateSlots.length) return null;

    // 取得該室總啟用席數
    const { data: activeSeats, error: seatError } = await sb.from("seats").select("id").eq("room_code", room).eq("is_active", true);
    if (queryId !== currentQueryId) return null;
    if (seatError) throw seatError;
    const totalActive = (activeSeats || []).length;
    if (!totalActive) return null;

    // 依序檢查最早有空位的時段
    for (const slot of candidateSlots) {
      if (queryId !== currentQueryId) return null;
      const { data: booked } = await sb.rpc("get_booked_seat_ids", {
        p_room_code: room,
        p_date: date,
        p_start_time: slot + ":00"
      });
      if (queryId !== currentQueryId) return null;
      const bookedCount = (booked || []).length;
      if (bookedCount < totalActive) {
        return slot; // 找到最早有空位的時段
      }
    }

    return null; // 全部客滿
  }

  function fillSlots(selectedVal) {
    const html = ALL_SLOTS.map(s => `<option value="${s}">${s}–${String(Number(s.slice(0, 2)) + 1).padStart(2, "0")}:00</option>`).join("");
    $("slot-select").innerHTML = html;
    if (selectedVal && ALL_SLOTS.includes(selectedVal)) {
      $("slot-select").value = selectedVal;
    }
  }

  // --- 讀取帳號與權限 ---
  async function loadProfile() {
    profile = null;
    if (session) {
      const { data, error } = await sb.from("profiles").select("student_id,role").eq("id", session.user.id).maybeSingle();
      if (!error) profile = data;
    }
    updateAccount();
  }

  function updateAccount() {
    $("user-label").textContent = profile ? `${profile.student_id} · ${profile.role === "librarian" ? "館員" : "學生"}` : "訪客模式";
    $("auth-open").classList.toggle("hidden", !!session);
    $("logout").classList.toggle("hidden", !session);
    document.querySelectorAll(".admin-only").forEach(x => x.classList.toggle("hidden", profile?.role !== "librarian"));
  }

  function openAuth() {
    if (!sb) { notify("請先完成 Supabase 設定。"); return; }
    $("auth-modal").classList.remove("hidden");
  }

  function switchAuth(mode) {
    currentAuth = mode;
    document.querySelectorAll("[data-auth]").forEach(b => b.classList.toggle("active", b.dataset.auth === mode));
    $("auth-title").textContent = mode === "login" ? "歡迎回到夜讀" : "建立你的夜讀帳號";
    $("auth-submit").innerHTML = (mode === "login" ? "登入" : "註冊帳號") + " <span>↗</span>";
    $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  }

  function validStudent(id) {
    return /^[0-9]{9}$/.test(id) && Number(id.slice(0, 3)) <= 115;
  }

  async function authenticate(e) {
    e.preventDefault();
    const id = $("student-id").value.trim(), pw = $("password").value;
    if (!validStudent(id)) { notify("學號需為 9 位數，前三碼須介於 000–115。"); return; }
    if (pw.length < 8) { notify("密碼至少需要 8 個字元。"); return; }
    const btn = $("auth-submit");
    setBusy(btn, true);
    try {
      if (currentAuth === "register") {
        const { data, error } = await sb.functions.invoke("account", { body: { student_id: id, password: pw } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const email = `${id}@students.library.invalid`;
        const { error: loginError } = await sb.auth.signInWithPassword({ email, password: pw });
        if (loginError) throw loginError;
        notify("帳號建立成功，歡迎加入夜讀。");
        $("auth-modal").classList.add("hidden");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: `${id}@students.library.invalid`, password: pw });
        if (error) throw error;
        notify("登入成功。");
        $("auth-modal").classList.add("hidden");
      }
    } catch (err) {
      console.error(err);
      notify(err.message?.includes("already") ? "此學號已註冊，請直接登入。" : (err.message || "操作失敗，請稍後再試。"));
    } finally {
      setBusy(btn, false);
    }
  }

  async function logout() {
    await sb.auth.signOut();
    selectedSeat = null;
    notify("已登出。");
    showView("booking");
  }

  function showView(name) {
    currentView = name;
    document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
    $(`${name}-view`).classList.remove("hidden");
    document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === name));
    if (name === "mine") loadMine();
    if (name === "admin") {
      if (profile?.role !== "librarian") {
        notify("此頁面僅限館員使用。");
        showView("booking");
        return;
      }
      loadAdmin();
    }
  }

  // --- 座位更新與防競爭機制 (Anti-Race & Freshness Guarantee) ---
  async function refreshSeats(options = {}) {
    const { isBackground = false, overrideSlot = null, designatedQueryId = null } = options;
    const queryId = designatedQueryId || ++currentQueryId;

    const room = $("room-select").value;
    const date = $("date-select").value;
    const time = overrideSlot || $("slot-select").value;

    syncFilter();
    updateRoomFoot();

    if (!date || !time) {
      if (!isBackground) {
        $("floorplan").innerHTML = '<div class="loading">請先選擇日期與時段，即可查看座位。</div>';
        $("availability-count").textContent = "請選擇日期與時段";
        showEmpty("");
      }
      return;
    }

    if (!isBackground) {
      $("floorplan").innerHTML = '<div class="loading">正在讀取座位資料…</div>';
    }

    if (!sb) return;

    try {
      const [{ data: seats, error: sErr }, { data: booked, error: bErr }, { data: blocked, error: kErr }] = await Promise.all([
        sb.from("seats").select("id,seat_no,is_active").eq("room_code", room).order("seat_no"),
        sb.rpc("get_booked_seat_ids", { p_room_code: room, p_date: date, p_start_time: time + ":00" }),
        sb.from("blocked_slots").select("id").eq("room_code", room).eq("reservation_date", date).eq("start_time", time + ":00")
      ]);

      // 若在此期間有更新的查詢發起，立即丟棄此過期回應，確保只顯示最新條件
      if (queryId !== currentQueryId) return;
      if ($("room-select").value !== room || $("date-select").value !== date || $("slot-select").value !== time) {
        return;
      }

      if (sErr || bErr || kErr) throw sErr || bErr || kErr;

      const newSeatView = {
        room,
        seats: seats || [],
        bookedSet: new Set((booked || []).map(x => x.seat_id)),
        isBlocked: (blocked || []).length > 0
      };

      seatView = newSeatView;

      // 如果更新後發現目前選中的座位已被搶訂或封鎖，取消選取並提示重選
      if (selectedSeat) {
        const currentSeatObj = seatView.seats.find(s => s.id === selectedSeat);
        const stillBookable = currentSeatObj && isBookable(currentSeatObj, seatView);
        if (!stillBookable) {
          selectedSeat = null;
          notify("您先前選取的座位已被其他讀者預約，請重新選位。");
        }
      }

      renderMap();
      updateSummary();
    } catch (e) {
      if (queryId !== currentQueryId) return;
      console.error(e);
      if (!isBackground) {
        seatView = null;
        $("floorplan").innerHTML = '<div class="empty">座位資料載入失敗，請確認網路或重新整理。</div>';
        $("availability-count").textContent = "座位資料載入失敗";
        showEmpty("");
        notify("無法取得座位資料。");
      }
    }
  }

  const isBookable = (seat, view) => seat.is_active && !view.bookedSet.has(seat.id) && !view.isBlocked;
  const bookableSeats = () => seatView ? seatView.seats.filter(s => isBookable(s, seatView)) : [];

  function syncFilter() {
    const ready = !!$("date-select").value && !!$("slot-select").value && $("slot-select").value !== "";
    $("bookable-only").disabled = !ready;
    if (!ready) $("bookable-only").checked = false;
  }

  function clearFilter() {
    $("bookable-only").checked = false;
    renderMap();
  }

  function showEmpty(message) {
    $("empty-state").classList.toggle("hidden", !message);
    $("empty-message").textContent = message;
  }

  // --- 建築平面圖渲染 ---
  function renderMap() {
    const map = $("floorplan");
    if (!seatView) { showEmpty(""); return; }

    const { room, seats, bookedSet, isBlocked } = seatView;
    const totalDesignSeats = ROOM_TOTALS[room] || 24;
    const bookableCount = bookableSeats().length;
    const bookableOnly = $("bookable-only").checked;

    $("availability-count").textContent = isBlocked
      ? "此時段已封鎖"
      : `目前可預約 ${bookableCount} / ${totalDesignSeats} 席`;

    map.innerHTML = "";

    // 建立建築平面圖容器
    const plan = document.createElement("div");
    plan.className = `arch-plan arch-${room}`;

    // 頂部大片落地窗牆
    const windowWall = document.createElement("div");
    windowWall.className = "arch-wall-top";
    windowWall.innerHTML = `
      <div class="arch-window-label">
        <span class="window-glass-bar"></span>
        <span>${room === "north" ? "北向大片景觀採光窗 · NATURAL LIGHT & MOUNTAIN VIEW" : room === "south" ? "南向庭園綠意採光窗 · BOTANICAL GARDEN VIEW" : "二樓採光閱讀區 · LEVEL 2 READING AREA"}</span>
        <span class="window-glass-bar"></span>
      </div>
    `;
    plan.appendChild(windowWall);

    if (room === "north") {
      renderNorthPlan(plan, seats, bookedSet, isBlocked, bookableOnly);
    } else if (room === "south") {
      renderSouthPlan(plan, seats, bookedSet, isBlocked, bookableOnly);
    } else {
      renderFloor2Plan(plan, seats, bookedSet, isBlocked, bookableOnly);
    }

    map.appendChild(plan);

    showEmpty(bookableCount ? "" : isBlocked ? "此時段已被館員封鎖，請換個時段。" : "此時段已無可預約座位，請換個時段看看。");
  }

  function createSeatButton(no, room, dbSeats, bookedSet, isBlocked, bookableOnly) {
    const cfg = getSeatConfig(room, no);
    const seatInDb = dbSeats.find(s => s.seat_no === no);
    const isRegistered = !!seatInDb;
    const isActive = isRegistered ? seatInDb.is_active : false;
    const isBooked = isRegistered ? bookedSet.has(seatInDb.id) : false;
    const bookable = isRegistered && isActive && !isBooked && !isBlocked;
    const selected = isRegistered && selectedSeat === seatInDb.id;

    const label = !isRegistered ? "待同步" : !isActive ? "停用" : isBlocked ? "封鎖" : isBooked ? "已預約" : "空位";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "seat";

    if (!isRegistered) btn.classList.add("unregistered-seat");
    else if (!isActive || isBlocked) btn.classList.add("disabled-seat");
    else if (isBooked) btn.classList.add("booked");

    if (selected) btn.classList.add("selected");
    btn.classList.toggle("dimmed", bookableOnly && !bookable);
    btn.disabled = !bookable;

    btn.setAttribute("aria-pressed", String(selected));
    btn.setAttribute("aria-label", `座位 ${String(no).padStart(2, "0")}，${cfg.zone}，${label}，${cfg.features.join(" ")}`);

    const chipsHtml = cfg.features.map(f => `<span class="chip">${f}</span>`).join("");

    btn.innerHTML = `
      <div class="seat-header">
        <strong class="seat-num">${String(no).padStart(2, "0")}</strong>
        <span class="seat-tag">${cfg.tag}</span>
      </div>
      <div class="seat-status-bar">
        <span class="status-dot"></span>
        <span class="status-text">${label}</span>
      </div>
      <div class="seat-feature-chips">
        ${chipsHtml}
      </div>
    `;

    btn.onclick = () => {
      if (!isRegistered) {
        notify("此座位增量資料尚未同步至資料庫，請由館員執行 setup_incremental_seats.sql。");
        return;
      }
      if (!session) {
        openAuth();
        notify("請先登入，再選擇座位。");
        return;
      }
      selectedSeat = seatInDb.id;
      renderMap();
      updateSummary();
    };

    return btn;
  }

  // --- 北側閱覽室建築配置 (24 席) ---
  function renderNorthPlan(plan, dbSeats, bookedSet, isBlocked, bookableOnly) {
    // Zone A: 景觀吧台區 (1..6)
    const zoneBar = document.createElement("div");
    zoneBar.className = "arch-zone zone-bar";
    zoneBar.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE A</span>
        <strong>景觀吧台區</strong>
        <small>高腳椅 · 面窗視野 · 桌面獨立插座</small>
      </div>
    `;
    const barDesk = document.createElement("div");
    barDesk.className = "bar-counter-desk";
    for (let i = 1; i <= 6; i++) {
      barDesk.appendChild(createSeatButton(i, "north", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneBar.appendChild(barDesk);
    plan.appendChild(zoneBar);

    // 中段左右配置：專注 K 書區 (左) + 中央走道 + 研討閱覽長桌區 (右)
    const midGrid = document.createElement("div");
    midGrid.className = "arch-middle-grid";

    // Zone B: 專注 K 書區 (7..14)
    const zoneCubicle = document.createElement("div");
    zoneCubicle.className = "arch-zone zone-cubicle";
    zoneCubicle.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE B</span>
        <strong>專注 K 書區</strong>
        <small>獨立隔板 · 防眩檯燈 · 雙孔插座</small>
      </div>
    `;
    const cubicleGrid = document.createElement("div");
    cubicleGrid.className = "cubicle-grid";
    for (let i = 7; i <= 14; i++) {
      cubicleGrid.appendChild(createSeatButton(i, "north", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneCubicle.appendChild(cubicleGrid);
    midGrid.appendChild(zoneCubicle);

    // 中央主走道
    const aisle = document.createElement("div");
    aisle.className = "arch-aisle";
    aisle.innerHTML = '<span class="aisle-line"></span><span class="aisle-text">主走道 · SILENT AISLE</span><span class="aisle-line"></span>';
    midGrid.appendChild(aisle);

    // Zone C: 研討閱覽長桌區 (15..20)
    const zoneTable = document.createElement("div");
    zoneTable.className = "arch-zone zone-table";
    zoneTable.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE C</span>
        <strong>研討閱覽長桌區</strong>
        <small>實木桌面 · 雙向內嵌電源</small>
      </div>
    `;
    const tableGrid = document.createElement("div");
    tableGrid.className = "table-grid";
    for (let i = 15; i <= 20; i++) {
      tableGrid.appendChild(createSeatButton(i, "north", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneTable.appendChild(tableGrid);
    midGrid.appendChild(zoneTable);

    plan.appendChild(midGrid);

    // 下段配置：沉浸沙發區 (21..24) + 北側入口
    const botGrid = document.createElement("div");
    botGrid.className = "arch-bottom-grid";

    // Zone D: 沉浸沙發區 (21..24)
    const zoneSofa = document.createElement("div");
    zoneSofa.className = "arch-zone zone-sofa";
    zoneSofa.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE D</span>
        <strong>沉浸沙發閱讀區</strong>
        <small>舒適單人沙發 · 閱讀立燈 · 茶几</small>
      </div>
    `;
    const sofaCluster = document.createElement("div");
    sofaCluster.className = "sofa-cluster";
    for (let i = 21; i <= 24; i++) {
      sofaCluster.appendChild(createSeatButton(i, "north", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneSofa.appendChild(sofaCluster);
    botGrid.appendChild(zoneSofa);

    // 入口
    const entranceBlock = document.createElement("div");
    entranceBlock.className = "arch-entrance-block";
    entranceBlock.innerHTML = `
      <div class="arch-entrance">
        <span class="entrance-icon">🚪</span>
        <div class="entrance-info">
          <strong>北側閱覽室主入口 · ENTRANCE</strong>
          <small>請放輕腳步入座 · 全館保持安靜</small>
        </div>
        <span class="entrance-arrow">➔</span>
      </div>
    `;
    botGrid.appendChild(entranceBlock);

    plan.appendChild(botGrid);
  }

  // --- 南側閱覽室建築配置 (20 席) ---
  function renderSouthPlan(plan, dbSeats, bookedSet, isBlocked, bookableOnly) {
    // Zone A: 庭園吧台區 (1..4)
    const zoneBar = document.createElement("div");
    zoneBar.className = "arch-zone zone-bar";
    zoneBar.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE A</span>
        <strong>庭園景觀吧台區</strong>
        <small>景觀綠意視野 · 筆電充電座</small>
      </div>
    `;
    const barDesk = document.createElement("div");
    barDesk.className = "bar-counter-desk bar-4";
    for (let i = 1; i <= 4; i++) {
      barDesk.appendChild(createSeatButton(i, "south", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneBar.appendChild(barDesk);
    plan.appendChild(zoneBar);

    // 中段配置：靜音 K 書艙 (左) + 走道 + 中央閱覽桌 (右)
    const midGrid = document.createElement("div");
    midGrid.className = "arch-middle-grid south-middle";

    // Zone B: 靜音 K 書艙 (5..10)
    const zoneCubicle = document.createElement("div");
    zoneCubicle.className = "arch-zone zone-cubicle";
    zoneCubicle.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE B</span>
        <strong>靜音 K 書艙</strong>
        <small>三面隔板 · 專屬檯燈 · 插座</small>
      </div>
    `;
    const cubicleGrid = document.createElement("div");
    cubicleGrid.className = "cubicle-grid cubicle-6";
    for (let i = 5; i <= 10; i++) {
      cubicleGrid.appendChild(createSeatButton(i, "south", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneCubicle.appendChild(cubicleGrid);
    midGrid.appendChild(zoneCubicle);

    // 走道
    const aisle = document.createElement("div");
    aisle.className = "arch-aisle";
    aisle.innerHTML = '<span class="aisle-line"></span><span class="aisle-text">中庭步道 · WALKWAY</span><span class="aisle-line"></span>';
    midGrid.appendChild(aisle);

    // Zone C: 中央實木閱覽桌 (11..16)
    const zoneTable = document.createElement("div");
    zoneTable.className = "arch-zone zone-table";
    zoneTable.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE C</span>
        <strong>中央實木閱覽桌</strong>
        <small>寬敞木桌 · 雙向內嵌電源</small>
      </div>
    `;
    const tableGrid = document.createElement("div");
    tableGrid.className = "table-grid";
    for (let i = 11; i <= 16; i++) {
      tableGrid.appendChild(createSeatButton(i, "south", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneTable.appendChild(tableGrid);
    midGrid.appendChild(zoneTable);

    plan.appendChild(midGrid);

    // 下段配置：休閒沙發區 (17..20) + 南側入口
    const botGrid = document.createElement("div");
    botGrid.className = "arch-bottom-grid";

    // Zone D: 休閒沙發區 (17..20)
    const zoneSofa = document.createElement("div");
    zoneSofa.className = "arch-zone zone-sofa";
    zoneSofa.innerHTML = `
      <div class="zone-title">
        <span class="zone-badge">ZONE D</span>
        <strong>休閒閱讀沙發區</strong>
        <small>單人休閒沙發 · 側邊矮几</small>
      </div>
    `;
    const sofaCluster = document.createElement("div");
    sofaCluster.className = "sofa-cluster";
    for (let i = 17; i <= 20; i++) {
      sofaCluster.appendChild(createSeatButton(i, "south", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    zoneSofa.appendChild(sofaCluster);
    botGrid.appendChild(zoneSofa);

    // 入口
    const entranceBlock = document.createElement("div");
    entranceBlock.className = "arch-entrance-block";
    entranceBlock.innerHTML = `
      <div class="arch-entrance">
        <span class="entrance-icon">🚪</span>
        <div class="entrance-info">
          <strong>南側閱覽室入口 · SOUTH ENTRANCE</strong>
          <small>請放輕腳步入座</small>
        </div>
        <span class="entrance-arrow">➔</span>
      </div>
    `;
    botGrid.appendChild(entranceBlock);

    plan.appendChild(botGrid);
  }

  function renderFloor2Plan(plan, dbSeats, bookedSet, isBlocked, bookableOnly) {
    const body = document.createElement("div");
    body.className = "floor2-body";

    const windowTables = document.createElement("section");
    windowTables.className = "arch-zone floor2-table-group";
    windowTables.innerHTML = `
      <div class="zone-title"><span class="zone-badge">ZONE A</span><strong>窗邊長桌</strong><small>採光閱讀 · 4 席</small></div>
      <div class="floor2-seat-grid floor2-four"></div>
    `;
    const windowGrid = windowTables.querySelector(".floor2-seat-grid");
    for (let no = 1; no <= 4; no++) {
      windowGrid.appendChild(createSeatButton(no, "floor2", dbSeats, bookedSet, isBlocked, bookableOnly));
    }
    body.appendChild(windowTables);

    const aisle = document.createElement("div");
    aisle.className = "arch-aisle floor2-walkway";
    aisle.innerHTML = '<span class="aisle-line"></span><span class="aisle-text">中央走道 · WALKWAY</span><span class="aisle-line"></span>';
    body.appendChild(aisle);

    const centralTables = document.createElement("div");
    centralTables.className = "floor2-central-tables";
    [
      { title: "中央共讀桌 A", start: 5, end: 7 },
      { title: "中央共讀桌 B", start: 8, end: 10 }
    ].forEach((table, index) => {
      const group = document.createElement("section");
      group.className = "arch-zone floor2-table-group";
      group.innerHTML = `
        <div class="zone-title"><span class="zone-badge">ZONE ${index === 0 ? "B" : "C"}</span><strong>${table.title}</strong><small>桌椅 · 插座 · ${table.end - table.start + 1} 席</small></div>
        <div class="floor2-seat-grid"></div>
      `;
      const grid = group.querySelector(".floor2-seat-grid");
      for (let no = table.start; no <= table.end; no++) {
        grid.appendChild(createSeatButton(no, "floor2", dbSeats, bookedSet, isBlocked, bookableOnly));
      }
      centralTables.appendChild(group);
    });
    body.appendChild(centralTables);
    plan.appendChild(body);

    const entrance = document.createElement("div");
    entrance.className = "arch-entrance";
    entrance.innerHTML = `
      <span class="entrance-icon">🚪</span>
      <div class="entrance-info"><strong>2 樓閱覽區入口 · ENTRANCE</strong><small>由樓梯與電梯進入，請保持走道暢通</small></div>
      <span class="entrance-arrow">➔</span>
    `;
    plan.appendChild(entrance);
  }

  // --- 預約摘要面板更新 ---
  function updateSummary() {
    const room = $("room-select").value;
    const date = $("date-select").value;
    const time = $("slot-select").value;
    const seat = seatView && selectedSeat ? seatView.seats.find(s => s.id === selectedSeat) : null;
    const cfg = seat ? getSeatConfig(room, seat.seat_no) : null;

    let hint = "選擇地圖上的空位，確認後完成預約。";
    if (!session) hint = "登入後即可選位並完成預約。";
    else if (seat) hint = "確認資料無誤後送出預約。";
    else if (seatView && !bookableSeats().length) hint = "此時段已無可預約座位，請換個時段。";

    $("sum-seat").textContent = seat ? `座位 ${String(seat.seat_no).padStart(2, "0")}` : "尚未選位";
    $("sum-room").textContent = rooms[room];
    $("sum-zone").textContent = cfg ? cfg.zone : "—";
    $("sum-date").textContent = date || "—";
    $("sum-slot").textContent = time ? `${time}–${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:00` : "—";

    const featuresContainer = $("sum-features");
    if (featuresContainer) {
      if (cfg && cfg.features.length) {
        featuresContainer.innerHTML = cfg.features.map(f => `<span class="chip">${f}</span>`).join("");
      } else {
        featuresContainer.innerHTML = "";
      }
    }

    $("confirm-booking").disabled = !seat || !session;
    $("summary-hint").textContent = hint;
  }

  // --- 送出預約 ---
  async function book() {
    if (!session || !selectedSeat) {
      notify("請先登入並選擇空位。");
      return;
    }
    const btn = $("confirm-booking");
    setBusy(btn, true);
    try {
      const { data, error } = await sb.rpc("book_seat", {
        p_seat_id: selectedSeat,
        p_date: $("date-select").value,
        p_start_time: $("slot-select").value + ":00"
      });
      if (error) throw error;
      selectedSeat = null;
      notify("預約成功！已加入我的預約。");
      await refreshSeats();
    } catch (e) {
      console.error(e);
      selectedSeat = null;
      notify(e.message?.includes("SLOT_TAKEN")
        ? "手慢了一步，座位剛被其他讀者預約，請重新選位。"
        : e.message?.includes("SLOT_BLOCKED")
        ? "此時段已被館員封鎖，請改選其他時段。"
        : e.message?.includes("DATE_RANGE")
        ? "只能預約今天至第 7 天的時段。"
        : e.message?.includes("TIME_RANGE")
        ? "開放預約時間為每日 09:00–21:00。"
        : "預約失敗，請重新載入座位並再試一次。");
      await refreshSeats();
    } finally {
      setBusy(btn, false, "確認預約 ↗");
    }
  }

  // --- 我的預約與行事曆下載 (.ics Export) ---
  async function loadMine() {
    if (!session) {
      $("my-reservations").innerHTML = '<div class="empty">請先登入，查看你的預約紀錄。</div>';
      return;
    }
    $("my-reservations").innerHTML = '<div class="loading">正在讀取預約…</div>';
    const { data, error } = await sb.from("reservations")
      .select("id,room_code,seat_id,reservation_date,start_time,status,seats(seat_no)")
      .order("reservation_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      $("my-reservations").textContent = "載入失敗，請稍後重試。";
      return;
    }

    cachedReservations = data || [];
    // 依規定：有效預約顯示「加入行事曆」按鈕；已取消的預約不顯示
    const rows = cachedReservations.filter(r => r.status === "confirmed");

    if (!rows.length) {
      $("my-reservations").innerHTML = '<div class="empty">目前沒有有效預約。回到座位預約，挑選一個安靜的位置吧。</div>';
      return;
    }

    $("my-reservations").innerHTML = rows.map(r => {
      const seatNo = String(r.seats?.seat_no || "").padStart(2, "0");
      const roomName = esc(rooms[r.room_code] || "閱覽室");
      const startTimeFormatted = esc(r.start_time.slice(0, 5));
      const endHour = Number(r.start_time.slice(0, 2)) + 1;
      const endHourFormatted = String(endHour).padStart(2, "0") + ":00";

      return `
        <div class="reservation-row">
          <div>
            <strong>${roomName}</strong>
            <small>閱覽室</small>
          </div>
          <div>
            ${esc(r.reservation_date)}
            <small>預約日期</small>
          </div>
          <div>
            ${startTimeFormatted}–${endHourFormatted} · 座位 ${seatNo}
            <small>一小時</small>
          </div>
          <div class="reservation-actions">
            <button class="calendar-button" data-ics="${r.id}" title="下載行事曆 .ics 檔案">加入行事曆 📅</button>
            <button class="cancel-button" data-cancel="${r.id}">取消預約</button>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll("[data-ics]").forEach(b => {
      b.onclick = () => {
        const target = cachedReservations.find(x => x.id === b.dataset.ics);
        if (target) downloadIcs(target);
      };
    });

    document.querySelectorAll("[data-cancel]").forEach(b => {
      b.onclick = () => cancelBooking(b.dataset.cancel);
    });
  }

  // --- 生成並下載符合 RFC 5545 台北標準時間的 .ics 檔案 ---
  function downloadIcs(r) {
    const roomName = rooms[r.room_code] || "閱覽室";
    const seatNo = String(r.seats?.seat_no || "").padStart(2, "0");
    const dateFormatted = r.reservation_date.replaceAll("-", "");
    const startHourNum = Number(r.start_time.slice(0, 2));
    const endHourNum = startHourNum + 1;
    const startStr = `${String(startHourNum).padStart(2, "0")}0000`;
    const endStr = `${String(endHourNum).padStart(2, "0")}0000`;

    const dtStart = `${dateFormatted}T${startStr}`;
    const dtEnd = `${dateFormatted}T${endStr}`;

    const now = new Date();
    const dtStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const uid = `library-reservation-${r.id}@nightread.library.local`;

    // 嚴格遵循 RFC 5545 標準：
    // 事件名稱固定為「閱覽室座位預約」
    // 包含館室、座號、起訖時間
    // 嚴格排除學號或其他讀者個人隱私資料
    // 加入 Asia/Taipei VTIMEZONE，匯入行事曆時準確顯示台北時間
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Night Reading Library//Seat Reservation//ZH-TW",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Taipei",
      "X-LIC-LOCATION:Asia/Taipei",
      "BEGIN:STANDARD",
      "TZOFFSETFROM:+0800",
      "TZOFFSETTO:+0800",
      "TZNAME:CST",
      "DTSTART:19700101T000000",
      "END:STANDARD",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;TZID=Asia/Taipei:${dtStart}`,
      `DTEND;TZID=Asia/Taipei:${dtEnd}`,
      "SUMMARY:閱覽室座位預約",
      `LOCATION:${roomName} 座位 ${seatNo}`,
      `DESCRIPTION:閱覽室座位預約\\n館室：${roomName}\\n座號：座位 ${seatNo}\\n時段：${r.reservation_date} ${r.start_time.slice(0, 5)} - ${String(endHourNum).padStart(2, "0")}:00 (台北時間)\\n請準時入座並維護閱覽室安靜環境。`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR"
    ];

    const icsContent = lines.join("\r\n");
    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `閱覽室預約_${r.reservation_date}_${r.start_time.slice(0, 2)}00.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify("行事曆檔案 (.ics) 下載成功！");
  }

  async function cancelBooking(id) {
    if (!confirm("確定取消這筆預約？")) return;
    const { error } = await sb.rpc("cancel_reservation", { p_reservation_id: id });
    if (error) {
      notify("取消失敗，請稍後重試。");
      return;
    }
    notify("預約已取消。");
    loadMine();
    refreshSeats();
  }

  // --- 館員管理 ---
  async function loadAdmin() {
    if (profile?.role !== "librarian") return;
    await Promise.all([loadAdminReservations(), loadBlockedSlots()]);
  }

  function getAdminFilters() {
    return {
      room: $("admin-filter-room").value,
      dateFrom: $("admin-filter-date-from").value,
      dateTo: $("admin-filter-date-to").value,
      status: $("admin-filter-status").value
    };
  }

  async function loadAdminReservations() {
    if (profile?.role !== "librarian") return;
    const requestId = ++adminLoadId;
    const filters = getAdminFilters();
    const exportButton = $("admin-export-csv");
    $("all-reservations").textContent = "載入中…";
    $("admin-result-count").textContent = "";
    exportButton.disabled = true;

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      filteredAdminReservations = [];
      $("all-reservations").innerHTML = '<div class="empty">起始日期不可晚於結束日期。</div>';
      $("admin-result-count").textContent = "請調整日期範圍。";
      exportButton.disabled = false;
      return;
    }

    try {
      const rows = [];
      const pageSize = 1000;
      let offset = 0;
      while (true) {
        let query = sb.from("reservations")
          .select("reservation_date,start_time,room_code,status,student_id,seat_id,seats(seat_no)")
          .order("reservation_date", { ascending: false })
          .order("start_time", { ascending: true })
          .order("seat_id", { ascending: true });
        if (filters.room) query = query.eq("room_code", filters.room);
        if (filters.dateFrom) query = query.gte("reservation_date", filters.dateFrom);
        if (filters.dateTo) query = query.lte("reservation_date", filters.dateTo);
        if (filters.status) query = query.eq("status", filters.status);

        const { data, error } = await query.range(offset, offset + pageSize - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
        offset += pageSize;
      }
      if (requestId !== adminLoadId || profile?.role !== "librarian") return;
      filteredAdminReservations = rows;
      renderAdminReservations(rows);
    } catch (error) {
      if (requestId !== adminLoadId) return;
      console.error(error);
      filteredAdminReservations = [];
      $("all-reservations").textContent = "讀取失敗，請確認館員權限。";
      $("admin-result-count").textContent = "無法載入預約。";
    } finally {
      if (requestId === adminLoadId) exportButton.disabled = false;
    }
  }

  function renderAdminReservations(rows) {
    $("admin-result-count").textContent = `符合篩選條件：${rows.length} 筆`;
    if (!rows.length) {
      $("all-reservations").innerHTML = '<div class="empty">沒有符合目前篩選條件的預約。</div>';
      return;
    }
    const statusNames = { confirmed: "已確認", cancelled: "已取消" };
    $("all-reservations").innerHTML = `
      <table>
        <thead><tr><th>日期</th><th>時段</th><th>閱覽室</th><th>座位</th><th>學號</th><th>狀態</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${esc(r.reservation_date)}</td>
              <td>${esc(r.start_time.slice(0, 5))}–${esc(window.AppUtils.endTime(r.start_time))}</td>
              <td>${esc(rooms[r.room_code] || "閱覽室")}</td>
              <td>${String(r.seats?.seat_no || "").padStart(2, "0")}</td>
              <td>${esc(r.student_id || "")}</td>
              <td>${esc(statusNames[r.status] || r.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  function exportAdminCsv() {
    if (profile?.role !== "librarian") {
      notify("此功能僅限館員使用。");
      return;
    }
    if (!filteredAdminReservations.length) {
      notify("目前篩選沒有預約可匯出。");
      return;
    }

    const statusNames = { confirmed: "已確認", cancelled: "已取消" };
    const headers = ["館室", "座號", "日期", "開始時間", "結束時間", "狀態"];
    const rows = window.AppUtils.reservationCsvRows(filteredAdminReservations, rooms, statusNames);
    const csv = `\ufeff${window.AppUtils.toCsv(headers, rows)}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `閱覽室預約_${localDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    notify(`已匯出 ${rows.length} 筆符合篩選條件的預約。`);
  }

  async function loadBlockedSlots() {
    if (profile?.role !== "librarian") return;
    $("blocked-slots").textContent = "載入中…";
    const { data, error } = await sb.from("blocked_slots")
      .select("id,room_code,reservation_date,start_time,reason")
      .order("reservation_date", { ascending: false })
      .order("start_time", { ascending: true });
    if (error) {
      console.error(error);
      $("blocked-slots").textContent = "讀取封鎖時段失敗，請確認館員權限。";
      return;
    }
    if (!data?.length) {
      $("blocked-slots").innerHTML = '<div class="empty">目前沒有已封鎖時段。</div>';
      return;
    }
    $("blocked-slots").innerHTML = `
      <table>
        <thead><tr><th>館室</th><th>日期</th><th>時段</th><th>原因</th><th>操作</th></tr></thead>
        <tbody>
          ${data.map(slot => `
            <tr>
              <td>${esc(rooms[slot.room_code] || "閱覽室")}</td>
              <td>${esc(slot.reservation_date)}</td>
              <td>${esc(slot.start_time.slice(0, 5))}–${esc(window.AppUtils.endTime(slot.start_time))}</td>
              <td>${esc(slot.reason)}</td>
              <td><button class="unblock-button" type="button" data-unblock="${esc(slot.id)}" aria-label="解除 ${esc(rooms[slot.room_code] || "閱覽室")} ${esc(slot.reservation_date)} ${esc(slot.start_time.slice(0, 5))} 封鎖">解除封鎖</button></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    document.querySelectorAll("[data-unblock]").forEach(button => {
      button.onclick = () => unblockSlot(button.dataset.unblock);
    });
  }

  async function unblockSlot(id) {
    if (profile?.role !== "librarian") {
      notify("此功能僅限館員使用。");
      return;
    }
    const button = Array.from($("blocked-slots").querySelectorAll("[data-unblock]"))
      .find(candidate => candidate.dataset.unblock === id);
    const row = button?.closest("tr");
    const description = row ? row.cells[0].textContent + " " + row.cells[1].textContent + " " + row.cells[2].textContent : "此筆封鎖";
    if (!confirm(`確定解除「${description}」的時段封鎖？`)) return;

    const { data, error } = await sb.from("blocked_slots").delete().eq("id", id).select("id").maybeSingle();
    if (error || !data) {
      notify("解除封鎖失敗，請確認館員權限並重新整理清單。");
      return;
    }
    notify("時段封鎖已解除。");
    await Promise.all([loadBlockedSlots(), refreshSeats()]);
  }

  async function toggleSeat() {
    if (profile?.role !== "librarian") {
      notify("此功能僅限館員使用。");
      return;
    }
    const room = $("admin-room").value, n = Number($("admin-seat").value);
    const { data, error } = await sb.from("seats").select("id,is_active").eq("room_code", room).eq("seat_no", n).maybeSingle();
    if (error || !data) {
      notify(`找不到此座位（可能尚未執行增量 SQL 新增第 ${n} 席）。`);
      return;
    }
    const { error: e } = await sb.from("seats").update({ is_active: !data.is_active }).eq("id", data.id);
    if (e) {
      notify("更新失敗，請確認館員權限。");
      return;
    }
    notify(`座位 ${n} 已${data.is_active ? "停用" : "啟用"}。`);
    refreshSeats();
  }

  async function blockSlot() {
    if (profile?.role !== "librarian") {
      notify("此功能僅限館員使用。");
      return;
    }
    const payload = {
      room_code: $("block-room").value,
      reservation_date: $("block-date").value,
      start_time: $("block-slot").value + ":00",
      reason: $("block-reason").value.trim() || "館員封鎖"
    };
    const { error } = await sb.from("blocked_slots").upsert(payload, { onConflict: "room_code,reservation_date,start_time" });
    if (error) {
      notify("封鎖失敗，請確認館員權限或是否已有資料。");
      return;
    }
    notify("時段已封鎖。");
    refreshSeats();
    loadAdmin();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
