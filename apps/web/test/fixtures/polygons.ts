/** About 56 ha near Kostanay. Not pilot data. */
export const FIELD_A = {
  type: "Feature",
  properties: { name: "Demo field A" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [63.6, 53.2],
        [63.612, 53.2],
        [63.612, 53.2063],
        [63.6, 53.2063],
        [63.6, 53.2],
      ],
    ],
  },
};

export const FIELD_B = {
  type: "Feature",
  properties: { name: "Demo field B" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [63.62, 53.2],
        [63.63, 53.2],
        [63.63, 53.207],
        [63.62, 53.207],
        [63.62, 53.2],
      ],
    ],
  },
};

export const BOWTIE = {
  type: "Polygon",
  coordinates: [
    [
      [63.6, 53.2],
      [63.61, 53.21],
      [63.61, 53.2],
      [63.6, 53.21],
      [63.6, 53.2],
    ],
  ],
};

export const MULTI = {
  type: "MultiPolygon",
  coordinates: [FIELD_A.geometry.coordinates, FIELD_B.geometry.coordinates],
};
