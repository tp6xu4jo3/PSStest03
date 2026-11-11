/* 三間「額外新建」包廂的設計提案配置。非北科大館方核定平面圖、設備或即時數據。 */
(() => {
  "use strict";
  const gear = {
    power: { icon: "plug-zap", label: "電源插座", mark: "⚡" },
    lamp: { icon: "lamp-desk", label: "個人檯燈", mark: "✦" },
    divider: { icon: "panels-top-left", label: "隔板", mark: "▣" },
    monitor: { icon: "monitor", label: "外接螢幕", mark: "▤" },
    usb: { icon: "usb", label: "USB充電", mark: "⌁" }
  };
  const coords = (xs, ys) => ys.flatMap((y, row) => xs.map((x, col) => ({ x, y, row, col })));
  const cozy = coords([17, 38, 62, 83], [23, 47, 71]);
  // B室分為兩條沿牆工作檯與中央兩組桌，形成兩道走道。
  const sleepy = [
    ...[15, 32, 50, 68].map((y) => ({x: 14, y})),
    ...[15, 32, 50, 68].map((y) => ({x: 85, y})),
    ...coords([38, 62], [18, 38, 58, 78])
  ];
  // C室採5×4規律排列，適合偏好明確秩序的使用者。
  const discipline = coords([12, 30, 50, 70, 88], [16, 36, 56, 76]);
  const seats = (positions, code, chooser) => positions.map((p,i) => ({
    no: i + 1,
    code: `${code}${String(i + 1).padStart(2, "0")}`,
    x: p.x, y: p.y,
    equipment: chooser(i,p),
    facing: code === "B" && i < 8 ? (i < 4 ? "right" : "left") : "up"
  }));
  const data = {
    b1a: {
      code: "A", name: "Cozy Room", subtitle: "溫柔明亮・留一點餘裕",
      description: "像自己的閱讀角落，木質桌面、綠意與柔和光線構成安靜的包廂。",
      accent: "#97c8aa", glow: "151,200,170", floor: "cozy",
      seats: seats(cozy, "A", (i) => ["power", ...(i % 3 !== 1 ? ["lamp"] : []), ...(i < 4 ? ["usb"] : [])]),
      walkers: [{x:49,y:26,path:"vertical",delay:-2.1},{x:48,y:72,path:"horizontal",delay:-4.6}],
      decor: [{type:"plant",x:5,y:10},{type:"plant",x:94,y:86},{type:"sofa",x:8,y:88}]
    },
    b1b: {
      code: "B", name: "Sleepy Room", subtitle: "低刺激・沉靜思緒",
      description: "深色軟裝、柔霧燈帶與略有遮蔽的書桌，適合偏好低刺激環境的人。",
      accent: "#b4b2dd", glow: "180,178,221", floor: "sleepy",
      seats: seats(sleepy, "B", (i) => ["power", "divider", ...(i % 4 === 0 ? ["lamp", "usb"] : [])]),
      walkers: [{x:49,y:17,path:"vertical",delay:-3.8},{x:49,y:78,path:"horizontal",delay:-5.7}],
      decor: [{type:"plant",x:94,y:8},{type:"shelf",x:5,y:82}]
    },
    b1c: {
      code: "C", name: "Discipline Room", subtitle: "節奏清晰・專注推進",
      description: "整齊配置與清楚動線，讓每個座位都有同樣明確的工作節奏。",
      accent: "#e4be8c", glow: "228,190,140", floor: "discipline",
      seats: seats(discipline, "C", (i) => ["power", ...(i % 2 === 0 ? ["lamp"] : []), ...(i % 5 === 2 ? ["monitor"] : [])]),
      walkers: [{x:41,y:12,path:"vertical",delay:-1.2},{x:61,y:81,path:"horizontal",delay:-2.8}],
      decor: [{type:"plant",x:5,y:8},{type:"plant",x:95,y:92}]
    }
  };
  Object.freeze(gear);
  for (const room of Object.values(data)) {
    room.seats.forEach((seat) => Object.freeze(seat));
    Object.freeze(room.seats);
    Object.freeze(room);
  }
  window.ROOM_DESIGNS = Object.freeze(data);
  window.ROOM_EQUIPMENT = gear;
})();
