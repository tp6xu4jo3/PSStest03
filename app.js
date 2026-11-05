(() => {
  const cfg = window.APP_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const rooms = { north: "北側閱覽室", south: "南側閱覽室" };
  const slots = Array.from({length:12},(_,i)=>`${String(i+9).padStart(2,"0")}:00`);
  let sb, session=null, profile=null, selectedSeat=null, currentAuth="login", toastTimer;
  const localDate = (d=new Date()) => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  const shiftDate = (n) => { const [y,m,d]=localDate().split("-").map(Number); const x=new Date(Date.UTC(y,m-1,d+n)); return `${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,"0")}-${String(x.getUTCDate()).padStart(2,"0")}`; };
  const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function notify(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),3300)}
  function setBusy(btn,busy,label){btn.disabled=busy;btn.dataset.label??=btn.textContent;btn.textContent=busy?"處理中…":label||btn.dataset.label}
  function init(){
    $("year").textContent=new Date().getFullYear(); $("today-label").textContent=localDate().replaceAll("-",".");
    $("date-select").min=shiftDate(0);$("date-select").max=shiftDate(7);$("date-select").value=shiftDate(0);
    $("block-date").min=shiftDate(0);$("block-date").max=shiftDate(7);$("block-date").value=shiftDate(0);
    fillSlots();
    $("slot-select").value="09:00";
    $("admin-seat").innerHTML=Array.from({length:12},(_,i)=>`<option value="${i+1}">座位 ${String(i+1).padStart(2,"0")}</option>`).join("");
    $("room-select").addEventListener("change",refreshSeats);$("date-select").addEventListener("change",()=>{selectedSeat=null;refreshSeats()});$("slot-select").addEventListener("change",()=>{selectedSeat=null;refreshSeats()});
    $("confirm-booking").addEventListener("click",book);$("auth-open").onclick=()=>openAuth();$("auth-close").onclick=()=> $("auth-modal").classList.add("hidden");$("logout").onclick=logout;
    document.querySelectorAll("[data-auth]").forEach(b=>b.onclick=()=>switchAuth(b.dataset.auth));
    document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
    $("auth-form").onsubmit=authenticate;$("admin-refresh").onclick=loadAdmin;$("toggle-seat").onclick=toggleSeat;$("block-submit").onclick=blockSlot;
    if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){notify("請先在 config.js 填入 Supabase URL 與 Publishable Key。");$("floorplan").innerHTML='<div class="empty">尚未設定 Supabase。請先編輯 config.js，再重新整理頁面。</div>';return}
    sb=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
    sb.auth.getSession().then(({data})=>{session=data.session;loadProfile().finally(refreshSeats)});
    sb.auth.onAuthStateChange((_event,s)=>{session=s;loadProfile().finally(()=>{updateAccount();refreshSeats()})});
    refreshSeats();
  }
  function fillSlots(){const html=slots.map(s=>`<option value="${s}">${s}–${String(Number(s.slice(0,2))+1).padStart(2,"0")}:00</option>`).join("");$("slot-select").innerHTML=html;$("block-slot").innerHTML=html}
  async function loadProfile(){profile=null;if(session){const {data,error}=await sb.from("profiles").select("student_id,role").eq("id",session.user.id).maybeSingle();if(!error)profile=data}updateAccount()}
  function updateAccount(){$("user-label").textContent=profile?`${profile.student_id} · ${profile.role==="librarian"?"館員":"學生"}`:"訪客模式";$("auth-open").classList.toggle("hidden",!!session);$("logout").classList.toggle("hidden",!session);document.querySelectorAll(".admin-only").forEach(x=>x.classList.toggle("hidden",profile?.role!=="librarian"))}
  function openAuth(){if(!sb){notify("請先完成 Supabase 設定。");return}$("auth-modal").classList.remove("hidden")}
  function switchAuth(mode){currentAuth=mode;document.querySelectorAll("[data-auth]").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));$("auth-title").textContent=mode==="login"?"歡迎回到夜讀":"建立你的夜讀帳號";$("auth-submit").innerHTML=(mode==="login"?"登入":"註冊帳號")+" <span>↗</span>";$("password").autocomplete=mode==="login"?"current-password":"new-password"}
  function validStudent(id){return /^[0-9]{9}$/.test(id)&&Number(id.slice(0,3))<=115}
  async function authenticate(e){e.preventDefault();const id=$("student-id").value.trim(),pw=$("password").value;if(!validStudent(id)){notify("學號需為 9 位數，前三碼須介於 000–115。");return}if(pw.length<8){notify("密碼至少需要 8 個字元。");return}
    const btn=$("auth-submit");setBusy(btn,true);
    try{
      if(currentAuth==="register"){
        const {data,error}=await sb.functions.invoke("account",{body:{student_id:id,password:pw}});
        if(error)throw error;if(data?.error)throw new Error(data.error);
        // 註冊函式建立已確認的 Supabase Auth 使用者，再以合成 Email 登入。
        const email=`${id}@students.library.invalid`;const {error:loginError}=await sb.auth.signInWithPassword({email,password:pw});if(loginError)throw loginError;
        notify("帳號建立成功，歡迎加入夜讀。");$("auth-modal").classList.add("hidden");
      }else{
        const {error}=await sb.auth.signInWithPassword({email:`${id}@students.library.invalid`,password:pw});if(error)throw error;
        notify("登入成功。");$("auth-modal").classList.add("hidden");
      }
    }catch(err){console.error(err);notify(err.message?.includes("already")?"此學號已註冊，請直接登入。":(err.message||"操作失敗，請稍後再試。"))}
    finally{setBusy(btn,false)}
  }
  async function logout(){await sb.auth.signOut();selectedSeat=null;notify("已登出。");showView("booking")}
  function showView(name){document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));$(`${name}-view`).classList.remove("hidden");document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(name==="mine")loadMine();if(name==="admin"){if(profile?.role!=="librarian"){notify("此頁面僅限館員使用。");showView("booking");return}loadAdmin()}}
  async function refreshSeats(){
    selectedSeat=null;updateSummary();
    if(!sb)return;
    const room=$("room-select").value,date=$("date-select").value,time=$("slot-select").value;
    $("floorplan").innerHTML='<div class="loading">正在讀取座位資料…</div>';
    try{
      const [{data:seats,error:sErr},{data:booked,error:bErr},{data:blocked,error:kErr}]=await Promise.all([
        sb.from("seats").select("id,seat_no,is_active").eq("room_code",room).order("seat_no"),
        sb.rpc("get_booked_seat_ids",{p_room_code:room,p_date:date,p_start_time:time+":00"}),
        sb.from("blocked_slots").select("id").eq("room_code",room).eq("reservation_date",date).eq("start_time",time+":00")
      ]);
      if(sErr||bErr||kErr)throw sErr||bErr||kErr;
      const bookedSet=new Set((booked||[]).map(x=>x.seat_id)),isBlocked=(blocked||[]).length>0;
      renderSeats(seats||[],bookedSet,isBlocked);
      const available=(seats||[]).filter(s=>s.is_active&&!bookedSet.has(s.id)).length;
      $("availability-count").textContent=isBlocked?"此時段已封鎖":`目前 ${available} / 12 個空位`;
      if(!available&&!isBlocked)$("summary-hint").textContent="此時段已無空位，請改選其他時段。";
    }catch(e){console.error(e);$("floorplan").innerHTML='<div class="empty">座位資料載入失敗，請確認網路或重新整理。</div>';notify("無法取得座位資料。")}
  }
  function renderSeats(seats,bookedSet,isBlocked){
    const map=$("floorplan");map.innerHTML="";
    // 每列三座，中間留出主走道；共四列、十二席。
    for(let row=0;row<4;row++){
      for(let col=0;col<6;col++){
        if(col===3){const aisle=document.createElement("div");aisle.className="aisle";aisle.textContent=row===1?"主走道 · AISLE":"·";map.appendChild(aisle)}
        const n=row*3+(col<3?col+1:col-2),seat=seats.find(s=>s.seat_no===n);if(!seat)continue;
        const booked=bookedSet.has(seat.id),disabled=!seat.is_active||isBlocked;
        const b=document.createElement("button");b.type="button";b.className="seat";b.innerHTML=`<span>${String(n).padStart(2,"0")}</span><small>${disabled?"停用":booked?"已預約":"空位"}</small>`;
        if(disabled)b.classList.add("disabled-seat");else if(booked)b.classList.add("booked");else if(selectedSeat===seat.id)b.classList.add("selected");
        b.disabled=disabled||booked;
        b.setAttribute("aria-label",`座位 ${n}，${disabled?"停用":booked?"已預約":selectedSeat===seat.id?"已選取":"空位"}`);
        b.onclick=()=>{if(!session){openAuth();notify("請先登入，再選擇座位。");return}selectedSeat=seat.id;renderSeats(seats,bookedSet,isBlocked);updateSummary()};
        map.appendChild(b);
      }
    }
  }
  function updateSummary(){const room=$("room-select").value,date=$("date-select").value,time=$("slot-select").value;$("sum-seat").textContent=selectedSeat?`已選取`:"尚未選位";$("sum-room").textContent=rooms[room];$("sum-date").textContent=date||"—";$("sum-slot").textContent=time?`${time}–${String(Number(time.slice(0,2))+1).padStart(2,"0")}:00`:"—";$("confirm-booking").disabled=!selectedSeat||!session;$("summary-hint").textContent=!session?"登入後即可選位並完成預約。":selectedSeat?"確認資料無誤後送出預約。":"選擇地圖上的空位，確認後完成預約。"}
  async function book(){if(!session||!selectedSeat){notify("請先登入並選擇空位。");return}const btn=$("confirm-booking");setBusy(btn,true);
    try{const {data,error}=await sb.rpc("book_seat",{p_seat_id:selectedSeat,p_date:$("date-select").value,p_start_time:$("slot-select").value+":00"});if(error)throw error;selectedSeat=null;notify("預約成功！已加入我的預約。");await refreshSeats()}
    catch(e){console.error(e);selectedSeat=null;notify(e.message?.includes("SLOT_TAKEN")?"手慢了一步，座位剛被預約，請重新選位。":e.message?.includes("SLOT_BLOCKED")?"此時段已被館員封鎖，請改選其他時段。":e.message?.includes("DATE_RANGE")?"只能預約今天至第 7 天的時段。":e.message?.includes("TIME_RANGE")?"開放預約時間為每日 09:00–21:00。":"預約失敗，請重新載入座位並再試一次。");await refreshSeats()}
    finally{setBusy(btn,false,"確認預約 ↗")}
  }
  async function loadMine(){if(!session){$("my-reservations").innerHTML='<div class="empty">請先登入，查看你的預約紀錄。</div>';return}
    $("my-reservations").innerHTML='<div class="loading">正在讀取預約…</div>';
    const {data,error}=await sb.from("reservations").select("id,room_code,seat_id,reservation_date,start_time,status,seats(seat_no)").order("reservation_date",{ascending:true}).order("start_time",{ascending:true});
    if(error){$("my-reservations").textContent="載入失敗，請稍後重試。";return}
    const rows=(data||[]).filter(r=>r.status==="confirmed");
    if(!rows.length){$("my-reservations").innerHTML='<div class="empty">目前沒有有效預約。回到座位預約，挑選一個安靜的位置吧。</div>';return}
    $("my-reservations").innerHTML=rows.map(r=>`<div class="reservation-row"><div><strong>${esc(rooms[r.room_code])}</strong><small>閱覽室</small></div><div>${esc(r.reservation_date)}<small>預約日期</small></div><div>${esc(r.start_time.slice(0,5))} · 座位 ${String(r.seats?.seat_no||"").padStart(2,"0")}<small>一小時</small></div><button class="cancel-button" data-cancel="${r.id}">取消預約</button></div>`).join("");
    document.querySelectorAll("[data-cancel]").forEach(b=>b.onclick=()=>cancelBooking(b.dataset.cancel));
  }
  async function cancelBooking(id){if(!confirm("確定取消這筆預約？"))return;const {error}=await sb.rpc("cancel_reservation",{p_reservation_id:id});if(error){notify("取消失敗，請稍後重試。");return}notify("預約已取消。");loadMine();refreshSeats()}
  async function loadAdmin(){if(profile?.role!=="librarian")return;$("all-reservations").textContent="載入中…";const {data,error}=await sb.from("reservations").select("reservation_date,start_time,room_code,status,student_id,seat_id,seats(seat_no)").order("reservation_date",{ascending:false}).limit(100);
    if(error){$("all-reservations").textContent="讀取失敗，請確認館員權限。";return}if(!data?.length){$("all-reservations").textContent="目前沒有預約。";return}
    $("all-reservations").innerHTML=`<table><thead><tr><th>日期</th><th>時段</th><th>閱覽室</th><th>座位</th><th>學號</th><th>狀態</th></tr></thead><tbody>${data.map(r=>`<tr><td>${esc(r.reservation_date)}</td><td>${esc(r.start_time.slice(0,5))}</td><td>${esc(rooms[r.room_code])}</td><td>${String(r.seats?.seat_no||"").padStart(2,"0")}</td><td>${esc(r.student_id||"")}</td><td>${esc(r.status)}</td></tr>`).join("")}</tbody></table>`}
  async function toggleSeat(){const room=$("admin-room").value,n=Number($("admin-seat").value);const {data,error}=await sb.from("seats").select("id,is_active").eq("room_code",room).eq("seat_no",n).single();if(error){notify("找不到座位。");return}const {error:e}=await sb.from("seats").update({is_active:!data.is_active}).eq("id",data.id);if(e){notify("更新失敗，請確認館員權限。");return}notify(`座位 ${n} 已${data.is_active?"停用":"啟用"}。`);refreshSeats()}
  async function blockSlot(){const payload={room_code:$("block-room").value,reservation_date:$("block-date").value,start_time:$("block-slot").value+":00",reason:$("block-reason").value.trim()||"館員封鎖"};const {error}=await sb.from("blocked_slots").upsert(payload,{onConflict:"room_code,reservation_date,start_time"});if(error){notify("封鎖失敗，請確認館員權限或是否已有資料。");return}notify("時段已封鎖。");refreshSeats();loadAdmin()}
  document.addEventListener("DOMContentLoaded",init);
})();