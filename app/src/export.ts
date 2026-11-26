/** Traits de la carte, repris par le SVG exporte et par la note : valeurs en dur, le SVG doit tenir seul. */
const POLICE = "font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;";
export const STYLES_TRACE = `
svg .contour { fill: none; stroke: #1a1a1a; stroke-width: 1.4; }
svg .contour-echelle { fill: none; stroke: #6a6862; stroke-width: 0.8; }
svg .maillage rect { fill: none; stroke: #ffffff; stroke-opacity: 0.6; stroke-width: 0.5; }
svg .ouverture { fill: #ffffff; }
svg .decolle rect { fill: #a8442a; fill-opacity: 0.35; stroke: none; }
svg .poteau { fill: #e7eaee; stroke: #1a1a1a; stroke-width: 1.2; }
svg .voile { stroke: #1a1a1a; stroke-width: 4; stroke-linecap: square; }
svg .cote { stroke: #6a6862; stroke-width: 0.8; fill: #6a6862; font-size: 11px; ${POLICE} }
svg text.cote { stroke: none; }
svg .titre-carte { fill: #4a4842; font-size: 12px; font-weight: 600; ${POLICE} }
`;
