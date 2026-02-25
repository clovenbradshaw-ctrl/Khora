
const {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo
} = React;

/* ═══════════════════ ICONS ═══════════════════ */
const I = ({
  n,
  s = 17,
  c
}) => {
  const p = {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: c || "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  };
  const d = {
    lock: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "11",
      width: "18",
      height: "11",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 11V7a5 5 0 0 1 10 0v4"
    })),
    unlock: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "11",
      width: "18",
      height: "11",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 11V7a5 5 0 0 1 9.9-1"
    })),
    shield: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    })),
    shieldCheck: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 12l2 2 4-4"
    })),
    users: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M23 21v-2a4 4 0 0 0-3-3.87"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 3.13a4 4 0 0 1 0 7.75"
    })),
    user: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "7",
      r: "4"
    })),
    briefcase: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "7",
      width: "20",
      height: "14",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
    })),
    plus: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "5",
      x2: "12",
      y2: "19"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "5",
      y1: "12",
      x2: "19",
      y2: "12"
    })),
    x: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
      x1: "18",
      y1: "6",
      x2: "6",
      y2: "18"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "6",
      x2: "18",
      y2: "18"
    })),
    check: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "20 6 9 17 4 12"
    })),
    search: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "8"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "21",
      x2: "16.65",
      y2: "16.65"
    })),
    share: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "5",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "19",
      r: "3"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "8.59",
      y1: "13.51",
      x2: "15.42",
      y2: "17.49"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "15.41",
      y1: "6.51",
      x2: "8.59",
      y2: "10.49"
    })),
    key: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"
    })),
    eye: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    })),
    eyeOff: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "1",
      y1: "1",
      x2: "23",
      y2: "23"
    })),
    send: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
      x1: "22",
      y1: "2",
      x2: "11",
      y2: "13"
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "22 2 15 22 11 13 2 9 22 2"
    })),
    trash: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "3 6 5 6 21 6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    })),
    file: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "14 2 14 8 20 8"
    })),
    folder: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
    })),
    home: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "9 22 9 12 15 12 15 22"
    })),
    back: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "15 18 9 12 15 6"
    })),
    chevR: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "9 18 15 12 9 6"
    })),
    logout: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "16 17 21 12 16 7"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "12",
      x2: "9",
      y2: "12"
    })),
    settings: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
    })),
    alert: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "9",
      x2: "12",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "17",
      x2: "12.01",
      y2: "17"
    })),
    clock: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "10"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "12 6 12 12 16 14"
    })),
    msg: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    })),
    inbox: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "22 12 16 12 14 15 10 15 8 12 2 12"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
    })),
    zap: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polygon", {
      points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2"
    })),
    grid: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "3",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "3",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "14",
      y: "14",
      width: "7",
      height: "7"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "14",
      width: "7",
      height: "7"
    })),
    globe: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "2",
      y1: "12",
      x2: "22",
      y2: "12"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
    })),
    bar: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
      x1: "18",
      y1: "20",
      x2: "18",
      y2: "10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "20",
      x2: "12",
      y2: "4"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "20",
      x2: "6",
      y2: "14"
    })),
    clipboard: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "8",
      y: "2",
      width: "8",
      height: "4",
      rx: "1"
    })),
    link: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
    })),
    copy: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "9",
      y: "9",
      width: "13",
      height: "13",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
    })),
    userPlus: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "8.5",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "20",
      y1: "8",
      x2: "20",
      y2: "14"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "23",
      y1: "11",
      x2: "17",
      y2: "11"
    })),
    upload: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "17 8 12 3 7 8"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "3",
      x2: "12",
      y2: "15"
    })),
    download: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "7 10 12 15 17 10"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "15",
      x2: "12",
      y2: "3"
    })),
    sun: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "1",
      x2: "12",
      y2: "3"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "21",
      x2: "12",
      y2: "23"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "4.22",
      y1: "4.22",
      x2: "5.64",
      y2: "5.64"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "18.36",
      y1: "18.36",
      x2: "19.78",
      y2: "19.78"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "1",
      y1: "12",
      x2: "3",
      y2: "12"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "21",
      y1: "12",
      x2: "23",
      y2: "12"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "4.22",
      y1: "19.78",
      x2: "5.64",
      y2: "18.36"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "18.36",
      y1: "5.64",
      x2: "19.78",
      y2: "4.22"
    })),
    moon: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    })),
    'alert-triangle': /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "9",
      x2: "12",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "17",
      x2: "12.01",
      y2: "17"
    })),
    'refresh-cw': /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "23 4 23 10 17 10"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "1 20 1 14 7 14"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"
    })),
    layers: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polygon", {
      points: "12 2 2 7 12 12 22 7 12 2"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "2 17 12 22 22 17"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "2 12 12 17 22 12"
    })),
    chevronDown: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "6 9 12 15 18 9"
    })),
    chevronRight: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "9 18 15 12 9 6"
    })),
    chevronLeft: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "15 18 9 12 15 6"
    })),
    gitBranch: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "3",
      x2: "6",
      y2: "15"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "18",
      cy: "6",
      r: "3"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "6",
      cy: "18",
      r: "3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M18 9a9 9 0 0 1-9 9"
    })),
    activity: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", {
      points: "22 12 18 12 15 21 9 3 6 12 2 12"
    })),
    menu: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("line", {
      x1: "3",
      y1: "12",
      x2: "21",
      y2: "12"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "3",
      y1: "6",
      x2: "21",
      y2: "6"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "3",
      y1: "18",
      x2: "21",
      y2: "18"
    })),
    'more-v': /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "5",
      r: "1"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "19",
      r: "1"
    })),
    bell: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M13.73 21a2 2 0 0 1-3.46 0"
    })),
    filter: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polygon", {
      points: "22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
    })),
    dice: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("rect", {
      x: "2",
      y: "2",
      width: "20",
      height: "20",
      rx: "4"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "8",
      cy: "8",
      r: "1.5",
      fill: "currentColor",
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "1.5",
      fill: "currentColor",
      stroke: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "16",
      cy: "16",
      r: "1.5",
      fill: "currentColor",
      stroke: "none"
    })),
    phone: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
    })),
    mail: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "22,6 12,13 2,6"
    })),
    messageSquare: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
    })),
    dodeca: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", {
      d: "M12 1L22.46 8.6L18.47 20.9L5.53 20.9L1.54 8.6Z M14.94 7.95L16.76 13.55L12 17L7.24 13.55L9.06 7.95Z M12 1L14.94 7.95 M22.46 8.6L16.76 13.55 M18.47 20.9L12 17 M5.53 20.9L7.24 13.55 M1.54 8.6L9.06 7.95"
    })),
    graphNodes: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", { cx: "12", cy: "5", r: "3" }), /*#__PURE__*/React.createElement("circle", { cx: "5", cy: "19", r: "3" }), /*#__PURE__*/React.createElement("circle", { cx: "19", cy: "19", r: "3" }), /*#__PURE__*/React.createElement("line", { x1: "12", y1: "8", x2: "5", y2: "16" }), /*#__PURE__*/React.createElement("line", { x1: "12", y1: "8", x2: "19", y2: "16" }), /*#__PURE__*/React.createElement("line", { x1: "8", y1: "19", x2: "16", y2: "19" })),
    'git-merge': /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("circle", { cx: "18", cy: "18", r: "3" }), /*#__PURE__*/React.createElement("circle", { cx: "6", cy: "6", r: "3" }), /*#__PURE__*/React.createElement("path", { d: "M6 21V9a9 9 0 0 0 9 9" })),
    edit: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), /*#__PURE__*/React.createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })),
    database: /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("ellipse", { cx: "12", cy: "5", rx: "9", ry: "3" }), /*#__PURE__*/React.createElement("path", { d: "M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" }), /*#__PURE__*/React.createElement("path", { d: "M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" })),
    'arr-l': /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", { points: "15 18 9 12 15 6" })),
    'arr-r': /*#__PURE__*/React.createElement("svg", p, /*#__PURE__*/React.createElement("polyline", { points: "9 18 15 12 9 6" }))
  };
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0
    }
  }, d[n]);
};

/* ═══════════════════ SPINNING DODECA ICON ═══════════════════ */
const SpinningDodeca = ({ size = 32 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const anglesRef = useRef({ ax: 0.3, ay: 0.5 });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    ctx.scale(dpr, dpr);

    const phi = (1 + Math.sqrt(5)) / 2, ip = 1 / phi;
    const V = [
      [-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1],
      [0,-ip,-phi],[0,-ip,phi],[0,ip,-phi],[0,ip,phi],
      [-ip,-phi,0],[-ip,phi,0],[ip,-phi,0],[ip,phi,0],
      [-phi,0,-ip],[-phi,0,ip],[phi,0,-ip],[phi,0,ip]
    ];
    const edges = [];
    const thr = 2 / phi + 0.01;
    for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) {
      const dx = V[i][0]-V[j][0], dy = V[i][1]-V[j][1], dz = V[i][2]-V[j][2];
      if (Math.sqrt(dx*dx + dy*dy + dz*dz) < thr) edges.push([i, j]);
    }

    const draw = () => {
      const a = anglesRef.current;
      ctx.clearRect(0, 0, size, size);
      a.ax += 0.004; a.ay += 0.006;
      const light = document.documentElement.classList.contains('light');
      const edgeRgb = light ? '105,56,192' : '176,144,212';
      const vertRgb = light ? '130,80,200' : '212,184,240';
      const sa = Math.sin(a.ax), ca = Math.cos(a.ax), sb = Math.sin(a.ay), cb = Math.cos(a.ay);
      const P = V.map(v => {
        const y1 = v[1]*ca - v[2]*sa, z1 = v[1]*sa + v[2]*ca;
        const x2 = v[0]*cb - z1*sb, z2 = v[0]*sb + z1*cb;
        const s = size * 0.27;
        return [size/2 + x2*s, size/2 + y1*s, z2];
      });
      edges.forEach(e => {
        const ea = P[e[0]], eb = P[e[1]];
        const dz = (ea[2] + eb[2]) / 2;
        const op = 0.2 + 0.5 * ((dz + 2) / 4);
        ctx.beginPath(); ctx.moveTo(ea[0], ea[1]); ctx.lineTo(eb[0], eb[1]);
        ctx.strokeStyle = 'rgba(' + edgeRgb + ',' + op + ')'; ctx.lineWidth = 0.8; ctx.stroke();
      });
      P.forEach(p => {
        const op = 0.25 + 0.5 * ((p[2] + 2) / 4);
        ctx.beginPath(); ctx.arc(p[0], p[1], 1, 0, 6.283);
        ctx.fillStyle = 'rgba(' + vertRgb + ',' + op + ')'; ctx.fill();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [size]);

  return React.createElement('canvas', {
    ref: canvasRef,
    style: { width: size, height: size, display: 'block' }
  });
};

/* ═══════════════════ THEME SYSTEM ═══════════════════ */
const getInitialTheme = () => {
  const stored = localStorage.getItem('khora-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

// Apply theme immediately to avoid flash
(() => {
  const t = getInitialTheme();
  if (t === 'light') document.documentElement.classList.add('light');
})();
const ThemeContext = React.createContext({
  theme: 'dark',
  toggle: () => {}
});
const ThemeProvider = ({
  children
}) => {
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('khora-theme', theme);
  }, [theme]);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = e => {
      if (!localStorage.getItem('khora-theme')) setTheme(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const toggle = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return /*#__PURE__*/React.createElement(ThemeContext.Provider, {
    value: {
      theme,
      toggle
    }
  }, children);
};
const useTheme = () => React.useContext(ThemeContext);
const ThemeToggle = ({
  style: sx
}) => {
  const {
    theme,
    toggle
  } = useTheme();
  const isDark = theme === 'dark';
  return /*#__PURE__*/React.createElement("button", {
    onClick: toggle,
    "aria-label": isDark ? 'Switch to light mode' : 'Switch to dark mode',
    title: isDark ? 'Switch to light mode' : 'Switch to dark mode',
    style: {
      background: 'var(--bg-3)',
      border: '1px solid var(--border-1)',
      borderRadius: 'var(--r)',
      padding: '6px 8px',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--tx-1)',
      fontSize: 11,
      fontFamily: 'var(--sans)',
      fontWeight: 500,
      transition: 'all .18s',
      ...sx
    },
    onMouseEnter: e => {
      e.currentTarget.style.borderColor = 'var(--gold)';
      e.currentTarget.style.color = 'var(--tx-0)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.borderColor = 'var(--border-1)';
      e.currentTarget.style.color = 'var(--tx-1)';
    }
  }, /*#__PURE__*/React.createElement(I, {
    n: isDark ? 'moon' : 'sun',
    s: 14
  }), isDark ? 'Dark' : 'Light');
};
