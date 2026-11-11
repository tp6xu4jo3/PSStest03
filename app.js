(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const DESIGNS = window.ROOM_DESIGNS || {};
  const EQUIPMENT = window.ROOM_EQUIPMENT || {};
  const rooms = Object.fromEntries(Object.entries(DESIGNS).map(([key,room]) => [key, `${room.code} · ${room.name}`]));
  const ALL_SLOTS = Array.from({ length: 12 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`);
  const ROOM_TOTALS = Object.fromEntries(Object.entries(DESIGNS).map(([key,room]) => [key,room.seats.length]));

  // 示範座位僅使用測試編號；不捏造館方真實座位排列與設備配置。
  let sb, session = null, profile = null, selectedSeat = null, selectedPreviewNo = null, seatView = null;
  let currentAuth = "login", toastTimer, currentView = "booking";
  let currentQueryId = 0; // 查詢防競爭識別碼
  let realtimeChannel = null, pollingTimer = null, remoteDebounceTimer = null;
  let cachedReservations = [];
  let adminLoadId = 0, filteredAdminReservations = [];
  let mapRoom = null, roomSwitchId = 0, adminSeatReadId = 0;
  let knownCameraAlertIds = null, cameraBadgeRequestId = 0;

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
    const layout = DESIGNS[room]?.seats.find(seat => seat.no === seatNo);
    return { no: seatNo, code: layout?.code || `#${seatNo}`, zone: DESIGNS[room]?.subtitle || "自習包廂", tag:"SEAT",
      features:(layout?.equipment || []).map(key=>EQUIPMENT[key]?.label||key),
      equipment:layout?.equipment||[] };
  }

  // --- 初始化流程 ---
  function init() {
    $("date-select").min = shiftDate(0);
    $("date-select").max = shiftDate(7);
    $("date-select").value = shiftDate(0);

    $("block-date").min = shiftDate(0);
    $("block-date").max = shiftDate(7);
    $("block-date").value = shiftDate(0);
    $("block-slot").innerHTML = ALL_SLOTS.map(s => `<option value="${s}">${s}–${String(Number(s.slice(0, 2)) + 1).padStart(2, "0")}:00</option>`).join("");
    $("vision-date").min = shiftDate(0);
    $("vision-date").max = shiftDate(7);
    $("vision-date").value = shiftDate(0);
    $("vision-slot").innerHTML = $("block-slot").innerHTML;
    $("vision-slot").value = ALL_SLOTS.includes(`${String(Math.min(20, Math.max(9, getTaipeiDateTime().hour))).padStart(2,"0")}:00`)
      ? `${String(Math.min(20, Math.max(9, getTaipeiDateTime().hour))).padStart(2,"0")}:00` : "09:00";

    updateAdminSeatOptions();
    $("admin-room").addEventListener("change", updateAdminSeatOptions);
    $("admin-seat").addEventListener("change", updateAdminSeatState);
    updateVisionSeatOptions();
    $("vision-room").addEventListener("change", updateVisionSeatOptions);
    $("vision-simulate").addEventListener("click", simulateCameraObservation);
    $("camera-refresh").addEventListener("click", loadCameraAlerts);
    ["admin-filter-room", "admin-filter-date-from", "admin-filter-date-to", "admin-filter-status"]
      .forEach(id => $(id).addEventListener("change", loadAdminReservations));

    $("room-select").addEventListener("change", () => {
      selectedSeat = null;
      resetInspector();
      updateRoomFoot();
      updateSummary();
      animateRoomSwitch();
      onDateOrRoomChanged();
    });
    document.querySelectorAll("[data-room]").forEach(button => button.addEventListener("click", () => {
      if ($("room-select").value === button.dataset.room) return;
      $("room-select").value = button.dataset.room;
      $("room-select").dispatchEvent(new Event("change", {bubbles:true}));
    }));

    $("date-select").addEventListener("change", () => {
      selectedSeat = null;
      resetInspector();
      onDateOrRoomChanged();
    });

    $("slot-select").addEventListener("change", () => {
      selectedSeat = null;
      resetInspector();
      refreshSeats();
    });

    $("bookable-only").onchange = renderMap;
    $("clear-filter").onclick = clearFilter;
    $("confirm-booking").addEventListener("click", book);
    $("issue-form").addEventListener("submit", submitIssueReport);
    $("report-reveal").addEventListener("click", () => {
      if (!selectedSeat) return;
      const form = $("issue-form");
      form.classList.toggle("hidden");
      $("report-reveal").setAttribute("aria-expanded", String(!form.classList.contains("hidden")));
    });
    $("reports-refresh").addEventListener("click", loadIssueReports);
    $("auth-open").onclick = () => openAuth();
    $("auth-close").onclick = () => $("auth-modal").classList.add("hidden");
    $("logout").onclick = logout;

    document.querySelectorAll("[data-auth]").forEach(b => b.onclick = () => switchAuth(b.dataset.auth));
    document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => showView(b.dataset.view));
    $("auth-form").onsubmit = authenticate;
    $("admin-refresh").onclick = loadAdmin;
    $("blocked-refresh").onclick = loadBlockedSlots;
    $("admin-export-csv").onclick = exportAdminCsv;
    $("disable-seat").onclick = () => setSeatActive(false);
    $("enable-seat").onclick = () => setSeatActive(true);
    $("block-submit").onclick = blockSlot;

    updateRoomFoot();

    if (!cfg.SUPABASE_URL || !cfg.SUPABASE_PUBLISHABLE_KEY) {
      notify("請先在 config.js 填入 Supabase URL 與 Publishable Key。");
      $("floorplan").innerHTML = '<div class="empty">尚未設定 Supabase。請先編輯 config.js，再重新整理頁面。</div>';
      return;
    }

    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_PUBLISHABLE_KEY);
    updateAdminSeatState();

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
    const code = $("room-select")?.value || "b1a", design = DESIGNS[code];
    if (!design) return;
    $("room-total-seats").textContent = ROOM_TOTALS[code];
    $("room-headline").innerHTML = `${esc(design.name.split(" ")[0])} <em>Room</em>`;
    $("room-description").textContent = design.description;
    $("room-subtitle").textContent = design.subtitle;
    $("room-portal").style.setProperty("--room-accent",design.accent);
    $("room-portal").style.setProperty("--room-glow",design.glow);
    $("summary").style.setProperty("--room-accent",design.accent);
    document.querySelectorAll("[data-room]").forEach(button => {
      const active = button.dataset.room === code;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",String(active));
    });
  }

  function resetInspector() {
    $("seat-inspector").classList.add("hidden");
    $("issue-form").classList.add("hidden");
    $("issue-seat").value = "";
    $("report-reveal").setAttribute("aria-expanded","false");
    selectedPreviewNo = null;
  }

  function animateRoomSwitch() {
    const viewport = $("scene-viewport");
    viewport.classList.remove("room-travel");
    void viewport.offsetWidth;
    viewport.classList.add("room-travel");
    const id = ++roomSwitchId;
    window.setTimeout(() => { if (id === roomSwitchId) viewport.classList.remove("room-travel"); },840);
  }

  function updateAdminSeatOptions() {
    const room = $("admin-room").value, count = ROOM_TOTALS[room] || 12;
    $("admin-seat").innerHTML = Array.from({length:count},(_,i) =>
      `<option value="${i+1}">${esc(DESIGNS[room]?.code||"")}${String(i+1).padStart(2,"0")}</option>`).join("");
    updateAdminSeatState();
  }

  async function updateAdminSeatState() {
    const id = ++adminSeatReadId, room = $("admin-room").value;
    const no = Number($("admin-seat").value), status = $("admin-seat-status");
    $("disable-seat").disabled = $("enable-seat").disabled = true;
    if (!sb || !no) { status.textContent = "尚未載入座位資料"; return; }
    status.textContent = "正在查詢座位狀態…";
    const {data,error} = await sb.from("seats").select("id,is_active").eq("room_code",room).eq("seat_no",no).maybeSingle();
    if (id !== adminSeatReadId) return;
    if (error || !data) { status.textContent = "找不到此座位，請先執行座位增量SQL。"; return; }
    status.textContent = data.is_active ? "目前狀態：已啟用" : "目前狀態：已停用";
    $("disable-seat").disabled = !data.is_active;
    $("enable-seat").disabled = data.is_active;
  }

  // --- 即時更新與輪詢 (Realtime & Polling) ---
  function setupRealtime() {
    if (!sb) return;
    try {
      realtimeChannel = sb.channel("library-realtime-sync")
        .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => onRemoteChange())
        .on("postgres_changes", { event: "*", schema: "public", table: "blocked_slots" }, () => onRemoteChange())
        .on("postgres_changes", { event: "*", schema: "public", table: "seats" }, () => onRemoteChange())
        .on("postgres_changes", { event: "*", schema: "public", table: "camera_alerts" }, () => onRemoteChange())
        .on("postgres_changes", { event: "*", schema: "public", table: "reservation_presence" }, () => onRemoteChange())
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
        if (profile?.role === "librarian") updateCameraBadge();
      }
    }, 5000);
  }

  function onRemoteChange() {
    // 收到即時推播，防抖 200ms 後靜默更新，保護隱私不傳遞學號或個人資訊
    clearTimeout(remoteDebounceTimer);
    remoteDebounceTimer = setTimeout(() => {
      refreshSeats({ isBackground: true });
      if (currentView === "mine") { loadMine(); loadMyReports(); }
      if (currentView === "admin") loadAdmin();
    }, 200);
  }

  // --- 自動尋找最早可訂時段（移除「請選擇時段」） ---
  async function onDateOrRoomChanged() {
    const queryId = ++currentQueryId;
    const room = $("room-select").value;
    const date = $("date-select").value;

    $("availability-count").textContent = "正在搜尋示範時段…";
    if (!$("floorplan").querySelector(".iso-room")) $("floorplan").innerHTML = '<div class="loading">正在讀取時段…</div>';
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
    const [{ data: activeSeats, error: seatError }, {data: alerts, error: alertError}] = await Promise.all([
      sb.from("seats").select("id").eq("room_code", room).eq("is_active", true),
      sb.from("camera_alerts").select("seat_id").eq("room_code", room).eq("status", "open")
    ]);
    if (queryId !== currentQueryId) return null;
    if (seatError || alertError) throw seatError || alertError;
    const totalActive = (activeSeats || []).length;
    if (!totalActive) throw new Error("B1_DEMO_SQL_MISSING");
    const anomalousSeats = new Set((alerts || []).map(item => item.seat_id));
    const usableSeats = (activeSeats || []).filter(seat => !anomalousSeats.has(seat.id));

    // 依序檢查最早有空位的時段
    for (const slot of candidateSlots) {
      if (queryId !== currentQueryId) return null;
      const { data: booked } = await sb.rpc("get_booked_seat_ids", {
        p_room_code: room,
        p_date: date,
        p_start_time: slot + ":00"
      });
      if (queryId !== currentQueryId) return null;
      const bookedIds = new Set((booked || []).map(item => item.seat_id));
      if (usableSeats.some(seat => !bookedIds.has(seat.id))) {
        return slot; // 找到最早有空位的時段
      }
    }

    return candidateSlots[0]; // 即使全滿也顯示已登記座位，方便查看與回報。
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
    $("user-label").textContent = profile ? `${profile.student_id} · ${profile.role === "librarian" ? "原型管理員" : "測試使用者"}` : "訪客模式";
    $("auth-open").classList.toggle("hidden", !!session);
    $("logout").classList.toggle("hidden", !session);
    document.querySelectorAll(".admin-only").forEach(x => x.classList.toggle("hidden", profile?.role !== "librarian"));
    if (profile?.role === "librarian") updateCameraBadge();
    else {
      ++cameraBadgeRequestId;
      knownCameraAlertIds = null;
      $("camera-alert-badge").classList.add("hidden");
    }
  }

  function openAuth() {
    if (!sb) { notify("請先完成 Supabase 設定。"); return; }
    $("auth-modal").classList.remove("hidden");
  }

  function switchAuth(mode) {
    currentAuth = mode;
    document.querySelectorAll("[data-auth]").forEach(b => b.classList.toggle("active", b.dataset.auth === mode));
    $("auth-title").textContent = mode === "login" ? "登入原型測試帳號" : "建立原型測試帳號";
    $("auth-submit").innerHTML = (mode === "login" ? "登入" : "註冊帳號") + " <span>↗</span>";
    $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  }

  function validStudent(id) {
    return /^[0-9]{9}$/.test(id) && Number(id.slice(0, 3)) <= 115;
  }

  async function authenticate(e) {
    e.preventDefault();
    const id = $("student-id").value.trim(), pw = $("password").value;
    if (!validStudent(id)) { notify("請輸入 9 位數虛構測試編號（前三碼 000–115）。"); return; }
    if (pw.length < 8) { notify("密碼至少需要 8 個字元。"); return; }
    const btn = $("auth-submit");
    setBusy(btn, true);
    try {
      if (currentAuth === "register") {
        const { data, error } = await sb.functions.invoke("account", {
          body: { student_id: id, password: pw }
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const email = `${id}@students.library.invalid`;
        const { error: loginError } = await sb.auth.signInWithPassword({ email, password: pw });
        if (loginError) throw loginError;
        notify("測試帳號建立成功。");
        $("auth-modal").classList.add("hidden");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: `${id}@students.library.invalid`, password: pw });
        if (error) throw error;
        notify("登入成功。");
        $("auth-modal").classList.add("hidden");
      }
    } catch (err) {
      console.error(err);
      notify(err.message?.includes("already") ? "此測試編號已註冊，請直接登入。" : (err.message || "操作失敗，請稍後再試。"));
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
    if (name === "mine") { loadMine(); loadMyReports(); }
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
        if (!$("floorplan").querySelector(".iso-room")) $("floorplan").innerHTML = '<div class="loading">請先選擇日期與時段。</div>';
        $("availability-count").textContent = "請選擇日期與時段";
        showEmpty("");
      }
      return;
    }

    if (!isBackground) {
      if (!$("floorplan").querySelector(".iso-room")) $("floorplan").innerHTML = '<div class="loading">正在讀取座位資料…</div>';
    }

    if (!sb) return;

    try {
      const [{ data: seats, error: sErr }, { data: booked, error: bErr },
        { data: blocked, error: kErr }, {data: cameraAlerts, error: aErr},
        {data: presenceRows, error: pErr}] = await Promise.all([
        sb.from("seats").select("id,seat_no,is_active").eq("room_code", room).order("seat_no"),
        sb.rpc("get_booked_seat_ids", { p_room_code: room, p_date: date, p_start_time: time + ":00" }),
        sb.from("blocked_slots").select("id").eq("room_code", room).eq("reservation_date", date).eq("start_time", time + ":00"),
        sb.from("camera_alerts").select("id,seat_id,object_type").eq("room_code", room).eq("status", "open"),
        sb.rpc("get_seat_presence", {p_room_code:room,p_date:date,p_start_time:time+":00"})
      ]);

      // 若在此期間有更新的查詢發起，立即丟棄此過期回應，確保只顯示最新條件
      if (queryId !== currentQueryId) return;
      if ($("room-select").value !== room || $("date-select").value !== date || $("slot-select").value !== time) {
        return;
      }

      if (sErr || bErr || kErr || aErr || pErr) throw sErr || bErr || kErr || aErr || pErr;

      const newSeatView = {
        room,
        seats: seats || [],
        bookedSet: new Set((booked || []).map(x => x.seat_id)),
        alertMap: new Map((cameraAlerts || []).map(a => [a.seat_id, a])),
        presenceMap: new Map((presenceRows || []).map(item => [item.seat_id, item.presence_state])),
        isBlocked: (blocked || []).length > 0
      };

      seatView = newSeatView;

      if (selectedPreviewNo !== null) {
        const refreshed = seatView.seats.find(s => s.seat_no === selectedPreviewNo);
        selectedSeat = refreshed?.id || null;
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

  const isBookable = (seat, view) => seat.is_active && !view.bookedSet.has(seat.id) && !view.isBlocked && !view.alertMap?.has(seat.id);
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


  function renderMap() {
    const map = $("floorplan");
    if (!seatView) { showEmpty(""); return; }
    const { room, seats, isBlocked } = seatView;
    const design = DESIGNS[room];
    if (!design) return;

    const available = bookableSeats().length;
    const activeCount = seats.filter(seat => seat.is_active && !seatView.alertMap?.has(seat.id)).length;
    $("availability-count").textContent = isBlocked ? "此時段已封鎖" : `可登記 ${available} / ${activeCount} 席`;
    const expected = ROOM_TOTALS[room];
    showEmpty(seats.length < expected
      ? `尚有 ${expected - seats.length} 席未建置；可先查看配置，完成資料庫更新後才能登記。` : "");

    if (mapRoom !== room || !map.querySelector(".iso-room")) {
      buildRoomScene(map, room, design);
      mapRoom = room;
    }
    updateSeatNodes();
  }

  function buildRoomScene(map, room, design) {
    const world = document.createElement("div");
    world.className = `iso-room iso-${design.floor} iso-outline-${design.outline} iso-window-${design.window} scene-enter`;
    world.style.setProperty("--scene-accent", design.accent);
    world.style.setProperty("--scene-glow", design.glow);
    world.innerHTML = `
      <div class="room-base"></div><div class="floor-grid" aria-hidden="true"></div>
      <div class="room-wall wall-top"></div><div class="room-wall wall-left"></div>
      <div class="room-wall wall-right"></div><div class="room-wall wall-bottom"></div>
      <div class="room-window"><i></i><i></i><i></i></div>
      <div class="room-door" aria-hidden="true"></div>
      <div class="room-furniture" aria-hidden="true"></div>
      <div class="room-seat-layer"></div>
      <div class="room-people" aria-hidden="true"></div>`;
    const furniture = world.querySelector(".room-furniture");
    for (const decor of design.decor) {
      const item = document.createElement("span");
      item.className = `room-prop prop-${decor.type}`;
      item.style.left = `${decor.x}%`;
      item.style.top = `${decor.y}%`;
      if (decor.type === "plant") item.innerHTML = '<i class="prop-leaf"></i><i class="prop-pot"></i>';
      else if (decor.type === "column") item.innerHTML = '<i class="prop-column"></i>';
      else if (decor.type === "workbench") {
        item.dataset.benchId = decor.id;
        item.style.width = `${decor.width}%`;
        const places = design.seats.filter(seat => seat.benchId === decor.id);
        item.innerHTML = `
          <i class="prop-bench-top"></i>
          <i class="prop-bench-support"></i>
          <span class="bench-places">
            ${places.map(seat => `
              <span class="bench-place bench-${seat.side}" data-bench-seat="${seat.no}"
                style="left:${seat.slot * 100 / (seat.side === "north" ? 3 : 2)}%;width:${100 / (seat.side === "north" ? 3 : 2)}%">
              </span>
            `).join("")}
          </span>`;
      }
      else item.innerHTML = '<i></i>';
      furniture.appendChild(item);
    }

    const layer = world.querySelector(".room-seat-layer");
    for (const place of design.seats) layer.appendChild(createSeatButton(place, room));

    const people = world.querySelector(".room-people");
    for (const walker of design.walkers) {
      const person = document.createElement("div");
      person.className = "visitor";
      person.style.left = `${walker.x}%`;
      person.style.top = `${walker.y}%`;
      person.style.setProperty("--walk-x", `${walker.dx}px`);
      person.style.setProperty("--walk-y", `${walker.dy}px`);
      person.style.animationDelay = `${walker.delay - Math.random() * 4}s`;
      person.innerHTML = '<i class="person-head"></i><i class="person-body"></i><i class="person-shadow"></i>';
      people.appendChild(person);
    }
    map.replaceChildren(world);
  }

  function createSeatButton(place, room) {
    const cfg = getSeatConfig(room, place.no);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `seat-object seat-form-${place.shape} facing-${place.facing}`;
    button.dataset.seatNo = String(place.no);
    button.style.left = `${place.x}%`;
    button.style.top = `${place.y}%`;
    const icons = place.equipment.slice(0, 3).map(key =>
      `<span class="desk-equipment" title="${esc(EQUIPMENT[key]?.label || key)}">${esc(EQUIPMENT[key]?.mark || "•")}</span>`).join("");

    if (place.shape === "recliner") {
      button.innerHTML = `
        <span class="seat-model pod-model" aria-hidden="true">
          <span class="pod-shell"><span class="pod-canopy"></span><span class="pod-headrest"></span><span class="pod-cushion"></span><span class="pod-footrest"></span></span>
          <span class="pod-gear">${icons}</span>
        </span><span class="seat-label">${esc(cfg.code)}</span><span class="seat-point"></span>`;
    } else if (place.shape === "workbench") {
      button.innerHTML = `
        <span class="seat-model workbench-model" aria-hidden="true">
          <span class="seat-chair"><span class="chair-back"></span><span class="chair-cushion"></span></span>
          <span class="bench-chair-gear">${icons}</span>
        </span><span class="seat-label">${esc(cfg.code)}</span><span class="seat-point"></span>`;
    } else {
      button.innerHTML = `
        <span class="seat-model lounge-model" aria-hidden="true">
          <span class="desk-edge"></span><span class="desk-surface"><span class="desk-lamp"></span><span class="desk-gear">${icons}</span></span>
          <span class="seat-chair"><span class="chair-back"></span><span class="chair-cushion"></span></span><span class="seat-ottoman"></span>
        </span><span class="seat-label">${esc(cfg.code)}</span><span class="seat-point"></span>`;
    }

    button.onclick = () => {
      if (seatView?.room !== room) return;
      const actual = seatView.seats.find(item => item.seat_no === place.no);
      if (selectedPreviewNo !== place.no) {
        $("issue-form").classList.add("hidden");
        $("report-reveal").setAttribute("aria-expanded", "false");
      }
      selectedPreviewNo = place.no;
      selectedSeat = actual?.id || null;
      updateSeatNodes();
      updateSummary();
      if (window.matchMedia("(max-width: 860px)").matches) {
        $("summary").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };
    return button;
  }

  const presenceNames = {
    pending: "已登記・待報到",
    present: "已報到",
    away: "暫離中",
    returned: "已回座"
  };

  function updateSeatNodes() {
    if (!seatView) return;
    const seatsByNo = new Map(seatView.seats.map(seat => [seat.seat_no, seat]));
    const emphasize = $("bookable-only").checked;
    for (const button of $("floorplan").querySelectorAll(".seat-object")) {
      const no = Number(button.dataset.seatNo);
      const actual = seatsByNo.get(no);
      const booked = !!actual && seatView.bookedSet.has(actual.id);
      const cameraAlert = actual ? seatView.alertMap?.get(actual.id) : null;
      const presence = booked ? seatView.presenceMap?.get(actual.id) || "pending" : null;
      const hasPerson = booked && (presence === "present" || presence === "returned");
      const available = !!actual && isBookable(actual, seatView);
      const selected = selectedPreviewNo === no;
      const state = !actual ? "未建置" : !actual.is_active ? "停用" : seatView.isBlocked ? "封鎖"
        : cameraAlert ? "模擬偵測異常・已通報管理員" : booked ? presenceNames[presence] : "可登記";
      button.classList.toggle("seat-missing", !actual);
      button.classList.toggle("seat-offline", !!actual && (!actual.is_active || seatView.isBlocked));
      button.classList.toggle("seat-occupied", booked);
      button.classList.toggle("seat-pending", booked && presence === "pending");
      button.classList.toggle("seat-present", booked && presence === "present");
      button.classList.toggle("seat-away", booked && presence === "away");
      button.classList.toggle("seat-returned", booked && presence === "returned");
      button.classList.toggle("seat-anomaly", !!cameraAlert);
      button.classList.toggle("seat-open", available);
      button.classList.toggle("is-selected", selected);
      button.classList.toggle("is-dimmed", emphasize && !available);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", `${DESIGNS[seatView.room].code}${String(no).padStart(2, "0")}，${state}，可點擊查看詳情`);
      const model = button.querySelector(".seat-model");
      const reader = model.querySelector(".desk-reader");
      if (hasPerson && !reader) {
        const person = document.createElement("span");
        person.className = "desk-reader";
        person.innerHTML = '<i class="person-head"></i><i class="person-body"></i>';
        model.appendChild(person);
      } else if (!hasPerson && reader) reader.remove();
      const awayMarker = model.querySelector(".away-indicator");
      if (booked && presence === "away" && !awayMarker) {
        const indicator = document.createElement("span");
        indicator.className = "away-indicator";
        indicator.textContent = "暫";
        indicator.setAttribute("aria-hidden","true");
        model.appendChild(indicator);
      } else if (presence !== "away" && awayMarker) awayMarker.remove();
      const modelObject = model.querySelector(".detected-object");
      if (cameraAlert && !button.classList.contains("seat-form-workbench")) {
        if (!modelObject || !modelObject.classList.contains(`object-${cameraAlert.object_type}`)) {
          if (modelObject) modelObject.remove();
          model.appendChild(createDetectedObject(cameraAlert.object_type));
        }
      } else if (modelObject) modelObject.remove();
    }
    for (const place of $("floorplan").querySelectorAll(".bench-place")) {
      const no = Number(place.dataset.benchSeat);
      const seat = seatsByNo.get(no);
      const booked = !!seat && seatView.bookedSet.has(seat.id);
      const cameraAlert = seat ? seatView.alertMap?.get(seat.id) : null;
      const presence = booked ? seatView.presenceMap?.get(seat.id) || "pending" : null;
      place.classList.toggle("is-booked", booked);
      place.classList.toggle("is-away", booked && presence === "away");
      place.classList.toggle("is-present", booked && (presence === "present" || presence === "returned"));
      place.classList.toggle("is-anomaly", !!cameraAlert);
      const existingObject = place.querySelector(".detected-object");
      if (cameraAlert) {
        if (!existingObject || !existingObject.classList.contains(`object-${cameraAlert.object_type}`)) {
          if (existingObject) existingObject.remove();
          place.appendChild(createDetectedObject(cameraAlert.object_type));
        }
      } else if (existingObject) existingObject.remove();
      place.classList.toggle("is-selected", selectedPreviewNo === no);
      place.classList.toggle("is-offline", !seat || !seat.is_active || seatView.isBlocked);
    }
  }


  function createDetectedObject(kind) {
    const item = document.createElement("span");
    item.className = `detected-object object-${["books","person"].includes(kind) ? kind : "bag"}`;
    item.setAttribute("aria-hidden", "true");
    item.innerHTML = kind === "books"
      ? '<i class="book-bottom"></i><i class="book-top"></i>'
      : kind === "person"
      ? '<i class="person-head"></i><i class="person-body"></i>'
      : '<i class="bag-handle"></i><i class="bag-body"></i><i class="bag-pocket"></i>';
    return item;
  }

  // --- 預約摘要面板更新 ---

  function updateSummary() {
    const room = $("room-select").value;
    const date = $("date-select").value;
    const time = $("slot-select").value;
    const seat = seatView?.seats.find(item => item.id === selectedSeat) || null;
    const seatNo = selectedPreviewNo ?? seat?.seat_no;
    const config = seatNo ? getSeatConfig(room, seatNo) : null;
    const canBook = !!session && !!seat && isBookable(seat, seatView);
    $("sum-seat").textContent = config?.code || "尚未選位";
    $("sum-room").textContent = rooms[room] || "—";
    $("sum-zone").textContent = config?.zone || "—";
    $("sum-date").textContent = date || "—";
    $("sum-slot").textContent = time
      ? `${time}–${String(Number(time.slice(0, 2)) + 1).padStart(2, "0")}:00` : "—";
    $("sum-features").innerHTML = config?.equipment.length
      ? config.equipment.map(key => `<span class="feature-badge"><b>${esc(EQUIPMENT[key]?.mark || "•")}</b>${esc(EQUIPMENT[key]?.label || key)}</span>`).join("")
      : "";

    $("seat-inspector").classList.toggle("hidden", !config);
    if (config) {
      const booked = !!seat && seatView.bookedSet.has(seat.id);
      const alert = seat ? seatView.alertMap?.get(seat.id) : null;
      const presence = booked ? seatView.presenceMap?.get(seat.id) || "pending" : null;
      const status = !seat ? "未建置" : !seat.is_active ? "停用"
        : seatView.isBlocked ? "時段封鎖" : alert ? "模擬占位異常・已通報"
        : booked ? presenceNames[presence] : "可登記";
      $("vision-seat-status").classList.toggle("hidden", !alert);
      $("vision-seat-status").textContent = alert
        ? `模擬偵測到${alert.object_type === "books" ? "書籍" : alert.object_type === "person" ? "人員" : "背包"}，但系統顯示空位；已向管理員發出異常通報。排除前暫停登記。`
        : "";
      $("presence-seat-status").classList.toggle("hidden", !booked || !!alert);
      $("presence-seat-status").textContent = booked && !alert
        ? `${presenceNames[presence]}｜依模擬攝影機訊號推估，不能用於確認預約者身分。`
        : "";
      $("inspection-status").textContent = status;
      $("inspection-status").dataset.status = !seat || !seat.is_active || seatView.isBlocked
        ? "offline" : alert ? "alert" : booked ? "booked" : "available";
      $("inspection-code").textContent = config.code;
      $("issue-seat").value = seat?.id || "";
      $("report-reveal").classList.toggle("hidden", !seat || !!alert);
      if (!seat || alert) $("issue-form").classList.add("hidden");
    } else {
      $("issue-seat").value = "";
      $("issue-form").classList.add("hidden");
      $("vision-seat-status").classList.add("hidden");
      $("vision-seat-status").textContent = "";
      $("presence-seat-status").classList.add("hidden");
      $("presence-seat-status").textContent = "";
    }
    $("confirm-booking").disabled = !canBook;
    $("summary-hint").textContent = !config ? "點選座位查看資訊。"
      : !seat ? "此座位尚未建置，需完成資料庫更新。"
      : !session ? "登入後可登記或回報。"
      : !canBook ? "此座位目前不可登記，仍可回報問題。"
      : "確認後即可登記。";
  }

  // --- 送出預約 ---
  async function book() {
    const seat = seatView?.seats.find(s => s.id === selectedSeat);
    if (!session || !seat || !isBookable(seat, seatView)) {
      notify("請先登入並選擇可登記的座位。");
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
      selectedPreviewNo = null;
      notify("模擬登記完成，已加入我的登記；不代表校方座位。");
      await refreshSeats();
    } catch (e) {
      console.error(e);
      selectedSeat = null;
      selectedPreviewNo = null;
      notify(e.message?.includes("SLOT_TAKEN")
        ? "手慢了一步，座位剛被其他讀者預約，請重新選位。"
        : e.message?.includes("SEAT_ANOMALY_OPEN")
        ? "偵測到疑似占位物品，暫停登記，待管理員排除後才能使用。"
        : e.message?.includes("SLOT_BLOCKED")
        ? "此時段已被館員封鎖，請改選其他時段。"
        : e.message?.includes("DATE_RANGE")
        ? "只能預約今天至第 7 天的時段。"
        : e.message?.includes("TIME_RANGE")
        ? "開放預約時間為每日 09:00–21:00。"
        : "預約失敗，請重新載入座位並再試一次。");
      await refreshSeats();
    } finally {
      setBusy(btn, false, "確認模擬登記 ↗");
    }
  }

  // --- 我的預約與行事曆下載 (.ics Export) ---
  async function loadMyReports() {
    const target = $("my-reports");
    if (!session) {
      target.innerHTML = '<div class="empty">登入後可查看自己提交的回報。</div>';
      return;
    }
    const viewer = session.user.id;
    target.textContent = "載入中…";
    const {data, error} = await sb.from("seat_reports")
      .select("id,room_code,issue_type,status,created_at,seats(seat_no)")
      .eq("reported_by",viewer).order("created_at",{ascending:false}).limit(50);
    if (session?.user.id !== viewer) return;
    if (error) {
      console.error(error);
      target.textContent = "回報紀錄無法載入，請確認資料庫已設定。";
      return;
    }
    if (!data?.length) {
      target.innerHTML = '<div class="empty">尚未提交任何問題回報。</div>';
      return;
    }
    const names = {occupied:"座位遭占用", equipment:"設備異常", mismatch:"座位資訊不符", other:"其他"};
    target.innerHTML = `<table>
      <thead><tr><th>提交時間</th><th>座位</th><th>問題</th><th>狀態</th></tr></thead>
      <tbody>${data.map(item => `<tr>
        <td>${esc(new Date(item.created_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"}))}</td>
        <td>${esc(DESIGNS[item.room_code]?.code||"")}${String(item.seats?.seat_no||"").padStart(2,"0")}</td>
        <td>${esc(names[item.issue_type]||item.issue_type)}</td>
        <td>${item.status === "resolved" ? "已處理" : "待處理"}</td>
      </tr>`).join("")}</tbody></table>`;
  }

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
    updateAdminSeatState();
    await Promise.all([loadAdminReservations(), loadBlockedSlots(), loadIssueReports(), loadCameraAlerts(), updateCameraBadge()]);
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

  async function setSeatActive(active) {
    if (profile?.role !== "librarian") { notify("此功能僅限原型管理員使用。"); return; }
    const room = $("admin-room").value, no = Number($("admin-seat").value);
    const {data,error} = await sb.from("seats").select("id,is_active").eq("room_code",room).eq("seat_no",no).maybeSingle();
    if (error || !data) { notify("找不到此座位，請確認SQL已更新。"); return; }
    if (data.is_active === active) { notify("座位已經是該狀態。"); updateAdminSeatState(); return; }
    const {data:changed,error:e} = await sb.from("seats").update({is_active:active})
      .eq("id",data.id).eq("is_active",!active).select("id").maybeSingle();
    if (e || !changed) { notify("更新失敗或狀態已改變，請重新整理。"); updateAdminSeatState(); return; }
    notify(`${rooms[room]} ${String(no).padStart(2,"0")} 已${active?"啟用":"停用"}。`);
    await Promise.all([updateAdminSeatState(),refreshSeats()]);
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


  function updateVisionSeatOptions() {
    const room = $("vision-room").value;
    const positions = DESIGNS[room]?.seats || [];
    $("vision-seat").innerHTML = positions.map(pos =>
      `<option value="${pos.no}">${esc(pos.code)}</option>`).join("");
  }

  async function simulateCameraObservation() {
    if (profile?.role !== "librarian") return;
    const room = $("vision-room").value;
    const number = Number($("vision-seat").value);
    const date = $("vision-date").value;
    const slot = $("vision-slot").value;
    if (!date || !slot || !number) { notify("請選擇觀察時段及座位。"); return; }
    const button = $("vision-simulate");
    setBusy(button, true);
    try {
      const { data: seat, error: seatError } = await sb.from("seats").select("id")
        .eq("room_code",room).eq("seat_no",number).maybeSingle();
      if (seatError || !seat) throw new Error("SEAT_NOT_FOUND");
      const { error } = await sb.rpc("simulate_camera_observation", {
        p_seat_id: seat.id,
        p_date: date,
        p_start_time: slot + ":00",
        p_object_type: $("vision-object").value
      });
      if (error) throw error;
      notify("模擬偵測成立：系統顯示空位，但座位上有物品，已向管理員通報。");
      await Promise.all([loadCameraAlerts(), refreshSeats({isBackground:true})]);
    } catch (e) {
      console.error(e);
      const message = e.message || "";
      notify(message.includes("SEAT_ALREADY_REGISTERED")
        ? "該時段已有人登記，不符合「空位卻有物品」的異常條件。"
        : message.includes("SEAT_NOT_FOUND")
        ? "座位資料尚未建立，請先執行座位SQL。"
        : message.includes("SEAT_DISABLED")
        ? "這個座位已停用，無法產生模擬偵測。"
        : message.includes("DATE_RANGE") || message.includes("TIME_RANGE")
        ? "模擬日期需在7天內，時段需為09:00–21:00的整點。"
        : "模擬偵測無法完成，請先在Supabase執行攝影機異常SQL。");
    } finally { setBusy(button, false, "模擬偵測並比對"); }
  }

  async function updateCameraBadge() {
    if (profile?.role !== "librarian" || !sb) return;
    const requestId = ++cameraBadgeRequestId;
    const {data, error} = await sb.from("camera_alerts")
      .select("id").eq("status","open").limit(500);
    if (requestId !== cameraBadgeRequestId || profile?.role !== "librarian" || error) return;
    const current = new Set((data || []).map(item => item.id));
    const newCount = knownCameraAlertIds === null ? 0
      : [...current].filter(id => !knownCameraAlertIds.has(id)).length;
    knownCameraAlertIds = current;
    const badge = $("camera-alert-badge");
    badge.textContent = String(current.size);
    badge.classList.toggle("hidden", current.size === 0);
    if (newCount > 0) notify(`有${newCount}筆新的座位物品異常，請至管理頁處理。`);
  }

  async function loadCameraAlerts() {
    if (profile?.role !== "librarian") return;
    const target = $("camera-alerts");
    target.textContent = "載入中…";
    const {data, error} = await sb.from("camera_alerts")
      .select("id,room_code,seat_id,object_type,status,observed_date,observed_slot,detected_at,seats(seat_no)")
      .order("detected_at",{ascending:false}).limit(100);
    if (error) {
      console.error(error);
      target.textContent = "讀取失敗，請確認已執行攝影機異常SQL。";
      return;
    }
    if (!data?.length) {
      target.innerHTML = '<div class="empty">目前沒有模擬異常通報。</div>';
      return;
    }
    const sorted = [...data].sort((a,b) => Number(b.status === "open") - Number(a.status === "open"));
    target.innerHTML = `<table>
      <thead><tr><th>通報時間</th><th>包廂</th><th>座位</th><th>物品</th><th>比對時段</th><th>狀態</th><th>處理</th></tr></thead>
      <tbody>${sorted.map(a => `<tr>
        <td>${esc(new Date(a.detected_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"}))}</td>
        <td>${esc(rooms[a.room_code] || a.room_code)}</td>
        <td>${esc(DESIGNS[a.room_code]?.code || "")}${String(a.seats?.seat_no || "").padStart(2,"0")}</td>
        <td>${a.object_type === "books" ? "書籍" : "背包"}</td>
        <td>${esc(a.observed_date)} ${esc(String(a.observed_slot).slice(0,5))}</td>
        <td>${a.status === "open" ? '<span class="camera-alert-open">待排除</span>' : "已解除"}</td>
        <td>${a.status === "open"
          ? `<button type="button" class="unblock-button" data-resolve-camera="${esc(a.id)}">確認排除・解除通報</button>`
          : "—"}</td>
      </tr>`).join("")}</tbody></table>`;
    target.querySelectorAll("[data-resolve-camera]").forEach(button => {
      button.onclick = () => resolveCameraAlert(button.dataset.resolveCamera);
    });
  }

  async function resolveCameraAlert(id) {
    if (profile?.role !== "librarian") return;
    if (!confirm("請先確認現場物品已清除。確定解除這筆模擬攝影機警報嗎？")) return;
    const {error} = await sb.rpc("resolve_camera_alert", {p_alert_id:id});
    if (error) {
      console.error(error);
      notify("解除通報失敗，請確認管理員權限。");
      return;
    }
    notify("已解除通報，座位恢復依登記狀態顯示。");
    await Promise.all([loadCameraAlerts(), refreshSeats({isBackground:true})]);
  }

  // --- 模擬座位異常回報：RLS 將權限限制為提交者與原型管理員 ---
  async function submitIssueReport(event) {
    event.preventDefault();
    if (!session) {
      openAuth();
      notify("請先登入測試帳號，再送出模擬回報。");
      return;
    }
    const seatId = $("issue-seat").value;
    const seat = seatView?.seats.find(item => item.id === seatId);
    if (!seat) { notify("請先從當前分區選擇一個示範座位。"); return; }
    const btn = $("issue-submit");
    setBusy(btn, true);
    try {
      const { error } = await sb.from("seat_reports").insert({
        seat_id: seat.id,
        room_code: $("room-select").value,
        reported_by: session.user.id,
        issue_type: $("issue-type").value,
        details: $("issue-details").value.trim().slice(0, 300)
      });
      if (error) throw error;
      $("issue-details").value = "";
      $("issue-form").classList.add("hidden");
      $("report-reveal").setAttribute("aria-expanded","false");
      notify("回報已送出原型管理員，可在「我的登記」查看處理狀態。");
    } catch (err) {
      console.error(err);
      notify(err.code === "23505" ? "相同問題尚未結案，無須重複回報。"
        : "回報失敗，請先執行新版 Supabase SQL 並確認登入權限。");
    } finally {
      setBusy(btn, false, "送出模擬回報");
    }
  }

  const reportTypeNames = {
    occupied: "座位遭占用", equipment: "設備異常",
    mismatch: "資料與現場不一致", other: "其他"
  };
  async function loadIssueReports() {
    if (profile?.role !== "librarian") return;
    const target = $("seat-issue-reports");
    if (!target) return;
    target.textContent = "載入中…";
    const { data, error } = await sb.from("seat_reports")
      .select("id,room_code,seat_id,issue_type,details,status,created_at,seats(seat_no)")
      .order("created_at", { ascending: false }).limit(200);
    if (error) {
      console.error(error);
      target.textContent = "無法讀取回報，請確認 SQL 已執行且帳號具原型管理權限。";
      return;
    }
    if (!data?.length) {
      target.innerHTML = '<div class="empty">尚無模擬回報。</div>';
      return;
    }
    target.innerHTML = `<table>
      <thead><tr><th>時間</th><th>區域</th><th>示範座位</th><th>類型</th><th>內容</th><th>狀態</th><th>操作</th></tr></thead>
      <tbody>${data.map(r => `<tr>
        <td>${esc(new Date(r.created_at).toLocaleString("zh-TW",{timeZone:"Asia/Taipei"}))}</td>
        <td>${esc(rooms[r.room_code] || r.room_code)}</td>
        <td>${esc(r.seats?.seat_no ?? "—")}</td>
        <td>${esc(reportTypeNames[r.issue_type] || r.issue_type)}</td>
        <td class="report-details">${esc(r.details || "—")}</td>
        <td>${r.status === "open" ? "待處理" : "已結案"}</td>
        <td>${r.status === "open" ? `<button class="unblock-button" type="button" data-resolve-report="${esc(r.id)}">結案</button>` : "—"}</td>
      </tr>`).join("")}</tbody></table>`;
    target.querySelectorAll("[data-resolve-report]").forEach(button => {
      button.onclick = () => resolveIssueReport(button.dataset.resolveReport);
    });
  }

  async function resolveIssueReport(id) {
    if (profile?.role !== "librarian") return;
    if (!confirm("將此測試回報標記為已結案？")) return;
    const { error } = await sb.from("seat_reports").update({
      status: "resolved", resolved_at: new Date().toISOString()
    }).eq("id", id);
    if (error) { notify("結案失敗，請確認原型管理權限。"); return; }
    notify("已標記結案。");
    loadIssueReports();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
