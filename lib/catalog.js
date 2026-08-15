// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE SERIES
// ─────────────────────────────────────────────────────────────────────────────
// Para agregar una serie nueva:
//   1. Copia uno de los bloques de abajo
//   2. Cambia id, name, description y url
//   3. Deja poster: "" para que se obtenga automáticamente de og:image
//
// El id debe ser "sb:" + el slug de la URL de la serie.
//
// Series con UNA sola página (todos los episodios juntos):
//   → El extractor detecta si hay temporadas automáticamente.
//   → Si hay "TEMPORADA N" en la página, agrupa por temporada.
//   → Si no, pone todo en Temporada 1.
// ─────────────────────────────────────────────────────────────────────────────

module.exports = [
    {
    id: "sb:pablo-el-apostol-audio-latino",
    name: "Pablo, el Apóstol",
    poster: "",
    description: "La historia del apóstol Pablo narrada en episodios. Audio en español latino.",
    url: "https://seriesbiblicas.net/pablo-el-apostol-audio-latino/",
  },
  {
    id: "sb:reyes-audio-latino",
    name: "Reyes",
    poster: "",
    description: "Serie basada en la historia de los reyes de Israel. Audio en español latino.",
    url: "https://seriesbiblicas.net/reyes-audio-latino/",
  },

  {
    id: "sb:josue-hd-ok-ru",
    name: "Josue",
    poster: "",
    description: "Serie después de Moises para Edelfina.",
    url: "https://seriesbiblicas.net/josue-hd-ok-ru/",
  },
    {
    id: "sb:sanson-y-dalila-hd",
    name: "sanson-y-dalila",
    poster: "",
    description: "La historia de Sansón y Dalila relata el trágico romance bíblico entre Sansón, un juez de Israel con fuerza sobrehumana otorgada por Dios, y Dalila, una mujer filistea contratada para traicionarlo",
    url: "https://seriesbiblicas.net/sanson-y-dalila-hd//",
  },
   {
    id: "sb:jesus-audio-latino",
    name: "Jesus",
    poster: "",
    description: "Relata la vida de Jesucristo desde su nacimiento hasta su resurrección.",
    url: "https://seriesbiblicas.net/jesus-audio-latino/",
  },
  {
    id: "sb:jezabel-fhd-latino",
    name: "Jezabel",
    poster: "",
    description: "La Macro-Serie Jezabel es una nueva producción de RecordTV en conjunción con Formatos Producciones. Escrita por Cristianne Fridman y Dirigida por Alexandre Avancini. El personaje bíblico Jezabel fue la esposa de Acab, rey de Israel. Una mujer malvada que promovio la idolatría y abusó de su poder para ponerse activamente en contra de Dios. Después de un acuerdo entre dos reinos, encubierta, Jezabel se casa con el príncipe Acab y se convierte en la más peligrosa del reino de Israel. En el perfil débil y sumiso del marido, la joven pasa a comandar con violencia el reino y manipular a todos a su alrededor, auto-titulándose una gran sacerdotisa y portavoz divina, además de recurrir a la violencia y sacrificios públicos para mostrar su presencia de poder. Profundamente religiosa, Jezabel extendió la idolatría y abusó del poder que poseía, poniéndose activamente en contra del Dios de Israel. El mayor contrapunto de la reina es el profeta Elías, que intenta desenmascararla y sacarla del poder con la ayuda de diversos aliados. Esto hace que Jezabel contrate a Dido para seducir a Eliseo, discípulo de Elías, para descubrir los planes del profeta. También se extiende por todo el reino de Israel impresionantes historias de traición, confabulación, historias complejas de amor jamás contadas, impresionantes guerras entre profetas, los milagros sobrenaturales más impactantes de la historia bíblica, aun mayores que el tiempo de Moises, mas todo con un mismo fin, sobrevivir y acabar con la tiranía de una de las más grandes enemigas del Reino de Israel y del Reino de Dios, la sacerdotisa Jezabel..",
    url: "https://seriesbiblicas.net/jezabel-fhd-latino/",
  },
];
