export interface DebrisMaterialTheme {
  category: string;
  name: string;
  primaryColor: string;    // Main diffuse/albedo color
  accentColor: string;     // Secondary detail/trim
  emissiveColor: string;   // Subtle glow for visibility against dark space
  emissiveIntensity: number;
  orbitRingColor: string;  // Subtle trace ring color in 3D viewport
  metalness: number;
  roughness: number;
}

export const DEBRIS_MATERIAL_THEMES: Record<string, DebrisMaterialTheme> = {
  rocket_booster: {
    category: "spent_booster",
    name: "Spent Rocket Booster Stage",
    primaryColor: "#E2E8F0",   // Aerospace titanium-white ceramic alloy
    accentColor: "#60A5FA",    // Liquid oxygen cryogenic blue band
    emissiveColor: "#93C5FD",  // Soft ice-blue starlight reflection
    emissiveIntensity: 0.22,
    orbitRingColor: "#93C5FD", // Ice blue
    metalness: 0.85,
    roughness: 0.25
  },
  solar_array: {
    category: "photovoltaic",
    name: "Defunct Solar Array",
    primaryColor: "#FBBF24",   // Gold Kapton aerospace thermal insulation foil
    accentColor: "#38BDF8",    // Photovoltaic silicon blue wafer
    emissiveColor: "#F59E0B",  // Warm solar reflection glow
    emissiveIntensity: 0.25,
    orbitRingColor: "#FBBF24", // Sunburst gold
    metalness: 0.80,
    roughness: 0.25
  },
  chondrite: {
    category: "asteroid_chondrite",
    name: "Chondrite Meteorite Fragment",
    primaryColor: "#D97706",   // Silicate-rich stony chondrule ochre / bronze
    accentColor: "#F59E0B",    // Olivine-pyroxene inclusions
    emissiveColor: "#B45309",  // Deep amber-terracotta mineral luminescence
    emissiveIntensity: 0.24,
    orbitRingColor: "#F59E0B", // Amber gold
    metalness: 0.25,
    roughness: 0.85
  },
  reaction_wheel: {
    category: "attitude_control",
    name: "Reaction Wheel Core",
    primaryColor: "#818CF8",   // Precision cobalt-beryllium gyroscopic alloy
    accentColor: "#6366F1",    // Electromagnetic stator blue
    emissiveColor: "#4F46E5",  // Indigo field sheen
    emissiveIntensity: 0.22,
    orbitRingColor: "#818CF8", // Electric indigo
    metalness: 0.85,
    roughness: 0.22
  },
  aluminium_fairing: {
    category: "aero_shroud",
    name: "Aluminium Fairing & Thrust Ring",
    primaryColor: "#A5F3FC",   // Polished milled aerospace aluminium 7075
    accentColor: "#06B6D4",    // Refraction cyan
    emissiveColor: "#22D3EE",  // Cyan rim highlight
    emissiveIntensity: 0.22,
    orbitRingColor: "#22D3EE", // Vibrant cyan
    metalness: 0.90,
    roughness: 0.18
  },
  ferrous_meteorite: {
    category: "asteroid_ferrous",
    name: "Ferrous Meteorite Shard",
    primaryColor: "#34D399",   // Native kamacite-taenite nickel-iron emerald luster
    accentColor: "#10B981",    // High-specular nickel grain
    emissiveColor: "#059669",  // Emerald-aurora mineral shimmer
    emissiveIntensity: 0.24,
    orbitRingColor: "#34D399", // Emerald mint
    metalness: 0.85,
    roughness: 0.40
  },
  battery_unit: {
    category: "power_cell",
    name: "Nickel-Cadmium Battery Unit",
    primaryColor: "#FB923C",   // High-visibility aerospace hazard bronze/orange
    accentColor: "#EA580C",    // Industrial telemetry casing
    emissiveColor: "#F97316",  // Warm orange beacon
    emissiveIntensity: 0.25,
    orbitRingColor: "#FB923C", // Tangerine orange
    metalness: 0.70,
    roughness: 0.35
  },
  titanium_shield: {
    category: "thermal_shield",
    name: "Titanium Shielding Shard",
    primaryColor: "#E879F9",   // Anodized iridescent titanium fuchsia/lilac
    accentColor: "#C084FC",    // Whipple shield violet
    emissiveColor: "#D946EF",  // Iridescent violet glow
    emissiveIntensity: 0.22,
    orbitRingColor: "#E879F9", // Violet fuchsia
    metalness: 0.88,
    roughness: 0.25
  }
};

const DEFAULT_MATERIAL_THEME: DebrisMaterialTheme = {
  category: "generic_debris",
  name: "Orbital Debris",
  primaryColor: "#93C5FD",
  accentColor: "#38BDF8",
  emissiveColor: "#60A5FA",
  emissiveIntensity: 0.20,
  orbitRingColor: "#38BDF8",
  metalness: 0.80,
  roughness: 0.30
};

export function getDebrisMaterialTheme(material?: string): DebrisMaterialTheme {
  if (!material) return DEFAULT_MATERIAL_THEME;
  const mat = material.toLowerCase();

  if (mat.includes("solar")) return DEBRIS_MATERIAL_THEMES.solar_array;
  if (mat.includes("battery")) return DEBRIS_MATERIAL_THEMES.battery_unit;
  if (mat.includes("chondrite")) return DEBRIS_MATERIAL_THEMES.chondrite;
  if (mat.includes("ferrous")) return DEBRIS_MATERIAL_THEMES.ferrous_meteorite;
  if (mat.includes("fairing") || mat.includes("aluminium") || mat.includes("aluminum")) {
    return DEBRIS_MATERIAL_THEMES.aluminium_fairing;
  }
  if (mat.includes("wheel") || mat.includes("reaction")) {
    return DEBRIS_MATERIAL_THEMES.reaction_wheel;
  }
  if (mat.includes("shield") || mat.includes("titanium")) {
    return DEBRIS_MATERIAL_THEMES.titanium_shield;
  }
  if (mat.includes("rocket") || mat.includes("booster") || mat.includes("engine") || mat.includes("stage")) {
    return DEBRIS_MATERIAL_THEMES.rocket_booster;
  }
  if (mat.includes("meteorite") || mat.includes("shard")) {
    return DEBRIS_MATERIAL_THEMES.chondrite;
  }

  return DEFAULT_MATERIAL_THEME;
}
