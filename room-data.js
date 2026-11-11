(() => {
  "use strict";
  const equipment = {
    power: { label: "電源插座", mark: "⚡" },
    lamp: { label: "閱讀燈", mark: "✦" },
    usb: { label: "USB充電", mark: "⌁" },
    recline: { label: "平躺休憩椅", mark: "◒" },
    privacy: { label: "包覆式遮蔽", mark: "◫" },
    divider: { label: "桌面隔板", mark: "▥" },
    monitor: { label: "外接螢幕", mark: "▣" }
  };

  const locations = (values, room, shape, equip) => values.map(([x, y, facing = "front"], i) => ({
    no: i + 1,
    code: room + String(i + 1).padStart(2, "0"),
    x, y, facing, shape,
    equipment: equip(i)
  }));

  const disciplineTables = [
    { id: "c1", x: 29, y: 28, width: 38 },
    { id: "c2", x: 75, y: 28, width: 38 },
    { id: "c3", x: 29, y: 73, width: 38 },
    { id: "c4", x: 75, y: 73, width: 38 }
  ];
  const disciplineSeats = disciplineTables.flatMap((table, group) => {
    const stations = [
      { dx: -13, dy: -12, side: "north", slot: 0 },
      { dx: 0, dy: -12, side: "north", slot: 1 },
      { dx: 13, dy: -12, side: "north", slot: 2 },
      { dx: -8, dy: 11, side: "south", slot: 0 },
      { dx: 8, dy: 11, side: "south", slot: 1 }
    ];
    return stations.map((station, index) => {
      const no = group * 5 + index + 1;
      return {
        no, code: "C" + String(no).padStart(2, "0"),
        x: table.x + station.dx, y: table.y + station.dy,
        facing: station.side, side: station.side, slot: station.slot,
        benchId: table.id, shape: "workbench",
        equipment: ["power", "divider", ...(no % 4 === 1 ? ["lamp"] : []), ...(no % 5 === 3 ? ["monitor"] : [])]
      };
    });
  });

  const data = {
    b1a: {
      code: "A", name: "Cozy Room", subtitle: "柔和光線 · 自在閱讀",
      description: "植栽、暖木桌與圍合式閱讀角落。",
      accent: "#99c8ae", glow: "153,200,174", floor: "cozy",
      outline: "soft-bay", window: "top",
      seats: locations([
        [17,20],[37,14],[64,15],[83,22],
        [16,47],[35,40],[68,42],[85,51],
        [17,78],[39,72],[65,74],[83,81]
      ], "A", "lounge", i => ["power", ...(i % 3 !== 1 ? ["lamp"] : []), ...(i % 4 === 0 ? ["usb"] : [])]),
      decor: [
        {type:"plant",x:7,y:9},{type:"plant",x:92,y:11},
        {type:"plant",x:92,y:89},{type:"plant",x:7,y:66},
        {type:"round-table",x:51,y:25},{type:"rug",x:51,y:58},
        {type:"sofa",x:8,y:91},{type:"shelf",x:94,y:69}
      ],
      walkers: [{x:51,y:38,dx:0,dy:82,delay:-2.7},{x:45,y:88,dx:65,dy:0,delay:-5.1}]
    },
    b1b: {
      code: "B", name: "Sleepy Room", subtitle: "靜謐休憩 · 低刺激",
      description: "類航廈休憩躺椅、獨立遮光罩與柔和間接光。",
      accent: "#b4b2dd", glow: "180,178,221", floor: "sleepy",
      outline: "alcove", window: "right",
      seats: locations([
        [14,16,"east"],[14,33,"east"],[14,50,"east"],[14,67,"east"],[14,84,"east"],
        [86,16,"west"],[86,33,"west"],[86,50,"west"],[86,67,"west"],[86,84,"west"],
        [37,22],[63,22],[34,50],[66,50],[37,78],[63,78]
      ], "B", "recliner", i => ["recline","privacy","power", ...(i % 3 === 0 ? ["usb"] : [])]),
      decor: [
        {type:"plant",x:5,y:7},{type:"plant",x:93,y:93},
        {type:"column",x:50,y:7},{type:"column",x:50,y:92},
        {type:"light-strip",x:50,y:12},{type:"shelf",x:6,y:91}
      ],
      walkers: [{x:49,y:29,dx:0,dy:78,delay:-1.9},{x:47,y:69,dx:52,dy:0,delay:-6.2}]
    },
    b1c: {
      code: "C", name: "Discipline Room", subtitle: "清晰分區 · 集中工作",
      description: "共享工作長桌與座位隔板，保留中央通行軸線。",
      accent: "#e4be8c", glow: "228,190,140", floor: "discipline",
      outline: "stepped", window: "left",
      seats: disciplineSeats,
      decor: [
        ...disciplineTables.map(table => ({ ...table, type: "workbench" })),
        {type:"column",x:52,y:9},{type:"column",x:52,y:91},
        {type:"plant",x:6,y:48},{type:"plant",x:94,y:51},
        {type:"shelf",x:5,y:94}
      ],
      walkers: [{x:53,y:40,dx:0,dy:60,delay:-3.7},{x:47,y:53,dx:80,dy:0,delay:-5.6}]
    }
  };

  Object.freeze(equipment);
  for (const room of Object.values(data)) {
    room.seats.forEach(seat => Object.freeze(seat));
    Object.freeze(room.seats);
    Object.freeze(room);
  }
  window.ROOM_DESIGNS = Object.freeze(data);
  window.ROOM_EQUIPMENT = equipment;
})();
