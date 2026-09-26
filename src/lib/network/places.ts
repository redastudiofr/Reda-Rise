/**
 * Where members say they are, on purpose only at the scale of a large city.
 * A member picks the nearest city in this list: no address, no postcode, no
 * GPS position is ever asked for or stored. Coordinates are the city centre,
 * used only to place the city on the map.
 */

export type Region = { id: string; name: string };

export const REGIONS: Region[] = [
  { id: 'ara', name: 'Auvergne-Rhône-Alpes' },
  { id: 'bfc', name: 'Bourgogne-Franche-Comté' },
  { id: 'bre', name: 'Bretagne' },
  { id: 'cvl', name: 'Centre-Val de Loire' },
  { id: 'cor', name: 'Corse' },
  { id: 'ges', name: 'Grand Est' },
  { id: 'hdf', name: 'Hauts-de-France' },
  { id: 'idf', name: 'Île-de-France' },
  { id: 'nor', name: 'Normandie' },
  { id: 'naq', name: 'Nouvelle-Aquitaine' },
  { id: 'occ', name: 'Occitanie' },
  { id: 'pdl', name: 'Pays de la Loire' },
  { id: 'pac', name: 'Provence-Alpes-Côte d’Azur' },
];

export type City = { id: string; name: string; region: string; lat: number; lon: number };

export const CITIES: City[] = [
  { id: 'paris', name: 'Paris', region: 'idf', lat: 48.857, lon: 2.352 },
  { id: 'boulogne-billancourt', name: 'Boulogne-Billancourt', region: 'idf', lat: 48.836, lon: 2.24 },
  { id: 'saint-denis', name: 'Saint-Denis', region: 'idf', lat: 48.936, lon: 2.357 },
  { id: 'versailles', name: 'Versailles', region: 'idf', lat: 48.805, lon: 2.12 },
  { id: 'cergy', name: 'Cergy', region: 'idf', lat: 49.036, lon: 2.063 },
  { id: 'evry', name: 'Évry', region: 'idf', lat: 48.629, lon: 2.441 },
  { id: 'creteil', name: 'Créteil', region: 'idf', lat: 48.79, lon: 2.455 },
  { id: 'marseille', name: 'Marseille', region: 'pac', lat: 43.296, lon: 5.37 },
  { id: 'nice', name: 'Nice', region: 'pac', lat: 43.71, lon: 7.262 },
  { id: 'toulon', name: 'Toulon', region: 'pac', lat: 43.124, lon: 5.928 },
  { id: 'aix-en-provence', name: 'Aix-en-Provence', region: 'pac', lat: 43.53, lon: 5.447 },
  { id: 'avignon', name: 'Avignon', region: 'pac', lat: 43.949, lon: 4.806 },
  { id: 'cannes', name: 'Cannes', region: 'pac', lat: 43.552, lon: 7.017 },
  { id: 'lyon', name: 'Lyon', region: 'ara', lat: 45.764, lon: 4.836 },
  { id: 'saint-etienne', name: 'Saint-Étienne', region: 'ara', lat: 45.44, lon: 4.387 },
  { id: 'grenoble', name: 'Grenoble', region: 'ara', lat: 45.188, lon: 5.724 },
  { id: 'clermont-ferrand', name: 'Clermont-Ferrand', region: 'ara', lat: 45.778, lon: 3.087 },
  { id: 'annecy', name: 'Annecy', region: 'ara', lat: 45.899, lon: 6.129 },
  { id: 'chambery', name: 'Chambéry', region: 'ara', lat: 45.564, lon: 5.918 },
  { id: 'valence', name: 'Valence', region: 'ara', lat: 44.933, lon: 4.892 },
  { id: 'toulouse', name: 'Toulouse', region: 'occ', lat: 43.605, lon: 1.444 },
  { id: 'montpellier', name: 'Montpellier', region: 'occ', lat: 43.611, lon: 3.877 },
  { id: 'nimes', name: 'Nîmes', region: 'occ', lat: 43.837, lon: 4.36 },
  { id: 'perpignan', name: 'Perpignan', region: 'occ', lat: 42.699, lon: 2.895 },
  { id: 'beziers', name: 'Béziers', region: 'occ', lat: 43.344, lon: 3.216 },
  { id: 'nantes', name: 'Nantes', region: 'pdl', lat: 47.218, lon: -1.554 },
  { id: 'angers', name: 'Angers', region: 'pdl', lat: 47.478, lon: -0.563 },
  { id: 'le-mans', name: 'Le Mans', region: 'pdl', lat: 48.006, lon: 0.199 },
  { id: 'saint-nazaire', name: 'Saint-Nazaire', region: 'pdl', lat: 47.274, lon: -2.214 },
  { id: 'la-roche-sur-yon', name: 'La Roche-sur-Yon', region: 'pdl', lat: 46.67, lon: -1.426 },
  { id: 'laval', name: 'Laval', region: 'pdl', lat: 48.073, lon: -0.77 },
  { id: 'strasbourg', name: 'Strasbourg', region: 'ges', lat: 48.573, lon: 7.752 },
  { id: 'reims', name: 'Reims', region: 'ges', lat: 49.258, lon: 4.032 },
  { id: 'metz', name: 'Metz', region: 'ges', lat: 49.119, lon: 6.176 },
  { id: 'nancy', name: 'Nancy', region: 'ges', lat: 48.692, lon: 6.184 },
  { id: 'mulhouse', name: 'Mulhouse', region: 'ges', lat: 47.75, lon: 7.336 },
  { id: 'troyes', name: 'Troyes', region: 'ges', lat: 48.297, lon: 4.074 },
  { id: 'bordeaux', name: 'Bordeaux', region: 'naq', lat: 44.838, lon: -0.579 },
  { id: 'limoges', name: 'Limoges', region: 'naq', lat: 45.834, lon: 1.262 },
  { id: 'poitiers', name: 'Poitiers', region: 'naq', lat: 46.58, lon: 0.34 },
  { id: 'pau', name: 'Pau', region: 'naq', lat: 43.296, lon: -0.37 },
  { id: 'la-rochelle', name: 'La Rochelle', region: 'naq', lat: 46.16, lon: -1.151 },
  { id: 'bayonne', name: 'Bayonne', region: 'naq', lat: 43.493, lon: -1.475 },
  { id: 'lille', name: 'Lille', region: 'hdf', lat: 50.629, lon: 3.057 },
  { id: 'amiens', name: 'Amiens', region: 'hdf', lat: 49.894, lon: 2.296 },
  { id: 'roubaix', name: 'Roubaix', region: 'hdf', lat: 50.69, lon: 3.181 },
  { id: 'dunkerque', name: 'Dunkerque', region: 'hdf', lat: 51.034, lon: 2.377 },
  { id: 'calais', name: 'Calais', region: 'hdf', lat: 50.951, lon: 1.858 },
  { id: 'beauvais', name: 'Beauvais', region: 'hdf', lat: 49.43, lon: 2.081 },
  { id: 'rennes', name: 'Rennes', region: 'bre', lat: 48.117, lon: -1.678 },
  { id: 'brest', name: 'Brest', region: 'bre', lat: 48.39, lon: -4.486 },
  { id: 'quimper', name: 'Quimper', region: 'bre', lat: 47.996, lon: -4.102 },
  { id: 'lorient', name: 'Lorient', region: 'bre', lat: 47.748, lon: -3.37 },
  { id: 'vannes', name: 'Vannes', region: 'bre', lat: 47.658, lon: -2.76 },
  { id: 'saint-brieuc', name: 'Saint-Brieuc', region: 'bre', lat: 48.514, lon: -2.765 },
  { id: 'rouen', name: 'Rouen', region: 'nor', lat: 49.443, lon: 1.1 },
  { id: 'le-havre', name: 'Le Havre', region: 'nor', lat: 49.494, lon: 0.108 },
  { id: 'caen', name: 'Caen', region: 'nor', lat: 49.183, lon: -0.371 },
  { id: 'cherbourg', name: 'Cherbourg', region: 'nor', lat: 49.639, lon: -1.616 },
  { id: 'dijon', name: 'Dijon', region: 'bfc', lat: 47.322, lon: 5.041 },
  { id: 'besancon', name: 'Besançon', region: 'bfc', lat: 47.238, lon: 6.024 },
  { id: 'belfort', name: 'Belfort', region: 'bfc', lat: 47.64, lon: 6.863 },
  { id: 'auxerre', name: 'Auxerre', region: 'bfc', lat: 47.799, lon: 3.573 },
  { id: 'tours', name: 'Tours', region: 'cvl', lat: 47.394, lon: 0.685 },
  { id: 'orleans', name: 'Orléans', region: 'cvl', lat: 47.903, lon: 1.909 },
  { id: 'bourges', name: 'Bourges', region: 'cvl', lat: 47.081, lon: 2.398 },
  { id: 'chartres', name: 'Chartres', region: 'cvl', lat: 48.447, lon: 1.489 },
  { id: 'ajaccio', name: 'Ajaccio', region: 'cor', lat: 41.919, lon: 8.738 },
  { id: 'bastia', name: 'Bastia', region: 'cor', lat: 42.697, lon: 9.451 },
];

export function cityById(id: string | undefined): City | undefined {
  return id ? CITIES.find((c) => c.id === id) : undefined;
}

export function regionById(id: string | undefined): Region | undefined {
  return id ? REGIONS.find((r) => r.id === id) : undefined;
}

/**
 * Below this many members, a city is not shown on its own on the map: its
 * members are counted with the region, so nobody is the only dot in a town.
 */
export const MIN_CITY_COUNT = 3;

export type MapPoint = { cityId: string; name: string; lat: number; lon: number; count: number };
export type MapRegion = { regionId: string; name: string; count: number; hidden: number };

/**
 * Map aggregates from the places of visible members. Only counts, never
 * people. Members who chose "region only" are counted in their region and
 * never placed on a city.
 */
export function aggregate(entries: { cityId: string; regionOnly?: boolean }[]): {
  points: MapPoint[];
  regions: MapRegion[];
  total: number;
} {
  const perCity = new Map<string, number>();
  const regions = new Map<string, MapRegion>();
  const region = (id: string) => {
    let r = regions.get(id);
    if (!r) regions.set(id, (r = { regionId: id, name: regionById(id)!.name, count: 0, hidden: 0 }));
    return r;
  };
  let total = 0;
  for (const e of entries) {
    const c = cityById(e.cityId);
    if (!c) continue;
    total++;
    if (e.regionOnly) {
      const r = region(c.region);
      r.count++;
      r.hidden++;
    } else perCity.set(c.id, (perCity.get(c.id) ?? 0) + 1);
  }
  const points: MapPoint[] = [];
  for (const [id, count] of perCity) {
    const c = cityById(id)!;
    const r = region(c.region);
    r.count += count;
    if (count >= MIN_CITY_COUNT) points.push({ cityId: id, name: c.name, lat: c.lat, lon: c.lon, count });
    else r.hidden += count;
  }
  return {
    points: points.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr')),
    regions: [...regions.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr')),
    total,
  };
}
