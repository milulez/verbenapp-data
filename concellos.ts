// VerbenApp — índice maestro de CONCELLOS de Galicia (313 ayuntamientos)
// Combina las 4 provincias. Importa esto en la app.
import { concellosCoruna, type Concello, type FiestaConcello } from "./concellos-coruna";
import { concellosLugo } from "./concellos-lugo";
import { concellosOurense } from "./concellos-ourense";
import { concellosPontevedra } from "./concellos-pontevedra";

export type { Concello, FiestaConcello };

export const concellos: Concello[] = [
  ...concellosCoruna,
  ...concellosLugo,
  ...concellosOurense,
  ...concellosPontevedra,
];

// Todas las fiestas patronais aplanadas, con su concello/comarca/provincia.
export const fiestasPatronais = concellos.flatMap(c =>
  c.fiestas.map(f => ({ ...f, concello: c.nombre, comarca: c.comarca, provincia: c.provincia }))
);
