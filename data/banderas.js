// Emoji de bandera por selección (todas las que aparecen en mundiales.js)
const TEAM_FLAG = {
  "Brasil": "🇧🇷", "Croacia": "🇭🇷", "México": "🇲🇽", "Camerún": "🇨🇲",
  "España": "🇪🇸", "Países Bajos": "🇳🇱", "Chile": "🇨🇱", "Australia": "🇦🇺",
  "Colombia": "🇨🇴", "Grecia": "🇬🇷", "Costa de Marfil": "🇨🇮", "Japón": "🇯🇵",
  "Uruguay": "🇺🇾", "Costa Rica": "🇨🇷", "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿", "Italia": "🇮🇹",
  "Suiza": "🇨🇭", "Ecuador": "🇪🇨", "Francia": "🇫🇷", "Honduras": "🇭🇳",
  "Argentina": "🇦🇷", "Bosnia y Herzegovina": "🇧🇦", "Irán": "🇮🇷", "Nigeria": "🇳🇬",
  "Alemania": "🇩🇪", "Portugal": "🇵🇹", "Ghana": "🇬🇭", "Estados Unidos": "🇺🇸",
  "Bélgica": "🇧🇪", "Argelia": "🇩🇿", "Rusia": "🇷🇺", "Corea del Sur": "🇰🇷",
  "Arabia Saudita": "🇸🇦", "Egipto": "🇪🇬", "Marruecos": "🇲🇦", "Perú": "🇵🇪",
  "Dinamarca": "🇩🇰", "Islandia": "🇮🇸", "Serbia": "🇷🇸", "Suecia": "🇸🇪",
  "Panamá": "🇵🇦", "Túnez": "🇹🇳", "Polonia": "🇵🇱", "Senegal": "🇸🇳",
  "Catar": "🇶🇦", "Gales": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Canadá": "🇨🇦",
  "Sudáfrica": "🇿🇦", "Chequia": "🇨🇿", "Haití": "🇭🇹", "Escocia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Paraguay": "🇵🇾", "Turquía": "🇹🇷", "Curazao": "🇨🇼", "Nueva Zelanda": "🇳🇿",
  "Noruega": "🇳🇴", "Irak": "🇮🇶", "Cabo Verde": "🇨🇻", "Austria": "🇦🇹",
  "Jordania": "🇯🇴", "Uzbekistán": "🇺🇿", "R.D. Congo": "🇨🇩",
  "Eslovenia": "🇸🇮", "Eslovaquia": "🇸🇰", "Corea del Norte": "🇰🇵",
  "Ucrania": "🇺🇦", "Togo": "🇹🇬", "Serbia y Montenegro": "🇷🇸", "Trinidad y Tobago": "🇹🇹", "Angola": "🇦🇴",
  "China": "🇨🇳", "Irlanda": "🇮🇪",
  "Yugoslavia": "🇷🇸", "Rumania": "🇷🇴", "Jamaica": "🇯🇲", "Bulgaria": "🇧🇬",
  "Bolivia": "🇧🇴",
  "Checoslovaquia": "🇨🇿", "Unión Soviética": "🇷🇺", "Alemania Occidental": "🇩🇪", "Emiratos Árabes Unidos": "🇦🇪",
  "Hungría": "🇭🇺", "Irlanda del Norte": "🏴󠁧󠁢󠁮󠁩󠁲󠁿",
  "Kuwait": "🇰🇼", "El Salvador": "🇸🇻",
};

if (typeof window !== "undefined") window.TEAM_FLAG = TEAM_FLAG;
if (typeof module !== "undefined" && module.exports) module.exports = TEAM_FLAG;
