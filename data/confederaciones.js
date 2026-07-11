// Confederación de cada selección (para comparar pistas en el modo "Adivina el Jugador")
const TEAM_CONFEDERATION = {
  "Brasil": "CONMEBOL", "Croacia": "UEFA", "México": "CONCACAF", "Camerún": "CAF",
  "España": "UEFA", "Países Bajos": "UEFA", "Chile": "CONMEBOL", "Australia": "AFC",
  "Colombia": "CONMEBOL", "Grecia": "UEFA", "Costa de Marfil": "CAF", "Japón": "AFC",
  "Uruguay": "CONMEBOL", "Costa Rica": "CONCACAF", "Inglaterra": "UEFA", "Italia": "UEFA",
  "Suiza": "UEFA", "Ecuador": "CONMEBOL", "Francia": "UEFA", "Honduras": "CONCACAF",
  "Argentina": "CONMEBOL", "Bosnia y Herzegovina": "UEFA", "Irán": "AFC", "Nigeria": "CAF",
  "Alemania": "UEFA", "Portugal": "UEFA", "Ghana": "CAF", "Estados Unidos": "CONCACAF",
  "Bélgica": "UEFA", "Argelia": "CAF", "Rusia": "UEFA", "Corea del Sur": "AFC",
  "Arabia Saudita": "AFC", "Egipto": "CAF", "Marruecos": "CAF", "Perú": "CONMEBOL",
  "Dinamarca": "UEFA", "Islandia": "UEFA", "Serbia": "UEFA", "Suecia": "UEFA",
  "Panamá": "CONCACAF", "Túnez": "CAF", "Polonia": "UEFA", "Senegal": "CAF",
  "Catar": "AFC", "Gales": "UEFA", "Canadá": "CONCACAF",
  "Sudáfrica": "CAF", "Chequia": "UEFA", "Haití": "CONCACAF", "Escocia": "UEFA",
  "Paraguay": "CONMEBOL", "Turquía": "UEFA", "Curazao": "CONCACAF", "Nueva Zelanda": "OFC",
  "Noruega": "UEFA", "Irak": "AFC", "Cabo Verde": "CAF", "Austria": "UEFA",
  "Jordania": "AFC", "Uzbekistán": "AFC", "R.D. Congo": "CAF",
  "Eslovenia": "UEFA", "Eslovaquia": "UEFA", "Corea del Norte": "AFC",
  "Ucrania": "UEFA", "Togo": "CAF", "Serbia y Montenegro": "UEFA", "Trinidad y Tobago": "CONCACAF", "Angola": "CAF",
  "China": "AFC", "Irlanda": "UEFA",
  "Yugoslavia": "UEFA", "Rumania": "UEFA", "Jamaica": "CONCACAF", "Bulgaria": "UEFA",
  "Bolivia": "CONMEBOL",
  "Checoslovaquia": "UEFA", "Unión Soviética": "UEFA", "Alemania Occidental": "UEFA", "Emiratos Árabes Unidos": "AFC",
};

if (typeof window !== "undefined") window.TEAM_CONFEDERATION = TEAM_CONFEDERATION;
if (typeof module !== "undefined" && module.exports) module.exports = TEAM_CONFEDERATION;
