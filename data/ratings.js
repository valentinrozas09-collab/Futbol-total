// Sistema de valoración de jugadores (estilo videojuego, escala 60-99) — usado solo en el modo Draft.
//
// Cómo se calcula: como investigar el rendimiento real de cada jugador en cada partido es
// inviable para miles de jugadores, el rating combina señales reales de rendimiento que sí
// están documentadas:
//   1) Qué tan lejos llegó su equipo en ese Mundial (campeón, subcampeón o resto).
//   2) Premios individuales reales de esa edición (Balón de Oro y Bota de Oro del torneo).
//   3) Reconocimiento como figura histórica/estrella (lista curada de grandes jugadores).
//   4) Una variación determinística (mismo jugador + mismo año → siempre el mismo número)
//      para que el plantel no quede parejo entre titulares y suplentes de un mismo equipo.

const STAR_PLAYERS = new Set([
  // 1986-1990
  "Diego Maradona", "Michel Platini", "Karl-Heinz Rummenigge", "Lothar Matthäus",
  "Paolo Rossi", "Zico", "Sócrates", "Falcão", "Bruno Conti", "Gaetano Scirea",
  "Franco Baresi", "Paolo Maldini", "Enzo Scifo", "Preben Elkjær Larsen", "Michael Laudrup",
  "Gary Lineker", "Peter Shilton", "Bryan Robson", "Rudi Völler", "Jürgen Klinsmann",
  "Andreas Brehme", "Emilio Butragueño", "Hugo Sánchez", "Careca", "Roberto Baggio",
  "Salvatore Schillaci", "Frank Rijkaard", "Ruud Gullit", "Marco van Basten", "Igor Belanov",
  "Zbigniew Boniek", "Alessandro Altobelli", "Dragan Stojković", "Rüştü Reçber",
  // 1994-1998
  "Romário", "Bebeto", "Ronaldo", "Gabriel Batistuta", "Diego Simeone", "Zinedine Zidane",
  "Youri Djorkaeff", "Davor Šuker", "Robert Prosinečki", "Hristo Stoichkov", "Dennis Bergkamp",
  "Marc Overmars", "Edgar Davids", "Alessandro Del Piero", "Christian Vieri", "Fabien Barthez",
  "Rivaldo", "Dunga", "Cafu", "Roberto Carlos", "David Beckham", "Michael Owen", "Alan Shearer",
  "Gheorghe Hagi", "Hernán Crespo", "Fernando Redondo", "Iker Casillas", "Roy Keane",
  "Paul Scholes", "Rui Costa", "Luís Figo",
  // 2002-2006
  "Ronaldinho", "Thierry Henry", "David Trezeguet", "Patrick Vieira", "Gianluigi Buffon",
  "Fabio Cannavaro", "Francesco Totti", "Kaká", "Adriano", "Miroslav Klose", "Michael Ballack",
  "Wayne Rooney", "Deco", "Cristiano Ronaldo", "Andrea Pirlo", "Gennaro Gattuso",
  "Frank Lampard", "Steven Gerrard", "Xabi Alonso", "Andrés Iniesta", "Xavi",
  "Didier Drogba", "Samuel Eto'o", "Michael Essien", "Oliver Kahn",
  // 2010-2014
  "Lionel Messi", "Carles Puyol", "Sergio Ramos", "David Villa", "Fernando Torres",
  "Diego Forlán", "Luis Suárez", "Edinson Cavani", "Mesut Özil", "Thomas Müller",
  "Manuel Neuer", "Toni Kroos", "Neymar", "Arjen Robben", "Wesley Sneijder",
  "Robin van Persie", "James Rodríguez", "Luka Modrić", "Ivan Rakitić", "Philipp Lahm",
  "Bastian Schweinsteiger", "Sami Khedira", "Marco Reus", "Karim Benzema",
  // 2018-2022
  "Kylian Mbappé", "Antoine Griezmann", "N'Golo Kanté", "Paul Pogba", "Harry Kane",
  "Robert Lewandowski", "Kevin De Bruyne", "Eden Hazard", "Thibaut Courtois", "Alisson",
  "Mohamed Salah", "Virgil van Dijk", "Casemiro", "Dele Alli", "Raheem Sterling",
  "Hugo Lloris", "Raphaël Varane", "Ousmane Dembélé", "Jude Bellingham",
  // 2026
  "Erling Haaland", "Vinícius Júnior", "Jamal Musiala", "Lamine Yamal", "Pedri",
  "Florian Wirtz", "Rodri", "Bukayo Saka", "Achraf Hakimi", "Federico Valverde",
]);

function hashInt(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function playerRating(year, team, name) {
  const edition = window.WORLD_CUPS && window.WORLD_CUPS[year];
  if (!edition) return 75;

  // El Balón de Oro del torneo es, por definición, el mejor jugador de esa edición: 99 fijo.
  if (edition.goldenBall && edition.goldenBall === name) return 99;

  let base = 68;

  if (edition.winner && team === edition.winner) base += 14;
  else if (edition.runnerUp && team === edition.runnerUp) base += 8;

  if (STAR_PLAYERS.has(name)) base += 11;

  const isGoldenBoot = edition.goldenBoot && edition.goldenBoot === name;
  if (isGoldenBoot) base = Math.max(base, 90);

  const variance = hashInt(`${year}|${team}|${name}`) % (isGoldenBoot ? 6 : 9);
  base += variance;

  return Math.max(60, Math.min(98, base));
}

if (typeof window !== "undefined") window.playerRating = playerRating;
if (typeof module !== "undefined" && module.exports) module.exports = playerRating;
