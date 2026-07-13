import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Kanagawa (Wave) palette — https://github.com/rebelot/kanagawa.nvim
// Warm dark theme inspired by Hokusai's "The Great Wave off Kanagawa".
export const kanagawa = {
  sumiInk0: "#16161D",
  sumiInk1: "#1F1F28", // body background
  sumiInk2: "#2A2A37", // surfaces (cards, inputs, hover)
  sumiInk3: "#363646",
  sumiInk4: "#54546D", // borders
  fujiWhite: "#DCD7BA", // primary text
  oldWhite: "#C8C093",
  fujiGray: "#727169", // dimmed text
  crystalBlue: "#7E9CD8", // primary accent
  springBlue: "#7FB4CA",
  waveAqua2: "#7AA89F",
  dragonBlue: "#658594",
  oniViolet: "#957FB8",
  springGreen: "#98BB6C",
  carpYellow: "#E6C384",
  waveRed: "#E46876",
  sakuraPink: "#D27E99",
  // muted "autumn" tones — good for category accents (darker, not bright)
  autumnRed: "#C34043",
  autumnGreen: "#76946A",
  autumnYellow: "#DCA561",
  boatYellow2: "#C0A36E",
} as const;

// Mantine "dark" tuple: index 0 = lightest (text) → 9 = darkest (bg).
const dark: MantineColorsTuple = [
  kanagawa.fujiWhite, // 0 text
  kanagawa.oldWhite,  // 1
  "#a6a292",          // 2
  kanagawa.fujiGray,  // 3 dimmed
  kanagawa.sumiInk4,  // 4 borders
  kanagawa.sumiInk3,  // 5
  kanagawa.sumiInk2,  // 6 surfaces / hover
  kanagawa.sumiInk1,  // 7 body background
  kanagawa.sumiInk0,  // 8
  "#12121A",          // 9
];

// Accent scale built around crystalBlue.
const blue: MantineColorsTuple = [
  "#f2f4fb",
  "#e0e6f5",
  "#bfcdec",
  "#9db2e2",
  "#8aa4dc",
  kanagawa.crystalBlue, // 5 — primary shade in dark mode
  "#6d8ccb",
  "#5c78b3",
  "#4a6091",
  "#38496f",
];

export const theme = createTheme({
  primaryColor: "kanagawa",
  primaryShade: { light: 6, dark: 5 },
  colors: { dark, kanagawa: blue },
  defaultRadius: "md",
});

// Semantic colors for data viz, mapped to the Kanagawa palette. Components import
// these by meaning (chartColors.deep) rather than repeating hex values.
export const chartColors = {
  deep: kanagawa.dragonBlue,
  light: kanagawa.crystalBlue,
  rem: kanagawa.oniViolet,
  awake: kanagawa.sumiInk4,
  load: kanagawa.waveAqua2,
} as const;
