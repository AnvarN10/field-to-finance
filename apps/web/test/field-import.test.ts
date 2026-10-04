// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { FieldImportError, areaCheck, cadastralOf, explodeFields, kmlToGeoJson, parseFieldFile } from "../src/lib/field-import";

const ring = (x: number, y: number) => [
  [x, y],
  [x + 0.01, y],
  [x + 0.01, y + 0.01],
  [x, y + 0.01],
  [x, y],
];
const coords = (r: number[][]) => r.map(([a, b]) => `${a},${b},0`).join(" ");

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <Placemark><name>North</name>
    <ExtendedData><Data name="cadastral_number"><value>05-000-000-001</value></Data></ExtendedData>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(ring(82.6, 49.9))}</coordinates></LinearRing></outerBoundaryIs>
      <innerBoundaryIs><LinearRing><coordinates>${coords([[82.602, 49.902], [82.603, 49.902], [82.603, 49.903], [82.602, 49.902]])}</coordinates></LinearRing></innerBoundaryIs>
    </Polygon></Placemark>
  <Placemark><name>South block</name>
    <ExtendedData><SchemaData><SimpleData name="kad_nomer">05-000-000-002</SimpleData></SchemaData></ExtendedData>
    <MultiGeometry>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(ring(82.7, 49.8))}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(ring(82.72, 49.8))}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </MultiGeometry></Placemark>
  <Placemark><name>Road</name><LineString><coordinates>82,49 83,50</coordinates></LineString></Placemark>
</Document></kml>`;

describe("KML to GeoJSON", () => {
  it("converts polygons with holes, multi-geometries and extended data; skips non-areas", () => {
    const fc = kmlToGeoJson(KML, new DOMParser());
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(2);
    const [north, south] = fc.features;
    expect(north!.properties).toMatchObject({ name: "North", cadastral_number: "05-000-000-001" });
    expect(north!.geometry).toMatchObject({ type: "Polygon" });
    expect((north!.geometry as { coordinates: number[][][] }).coordinates).toHaveLength(2);
    expect(south!.geometry.type).toBe("MultiPolygon");
    expect(south!.properties.kad_nomer).toBe("05-000-000-002");
  });

  it("rejects files that are not KML", () => {
    expect(() => kmlToGeoJson("<html></html>", new DOMParser())).toThrow(FieldImportError);
  });
});

describe("explodeFields", () => {
  it("splits a MultiPolygon into one field per part and keeps the properties", () => {
    const fields = explodeFields(kmlToGeoJson(KML, new DOMParser()));
    expect(fields.map((f) => f.name)).toEqual(["North", "South block · part 1", "South block · part 2"]);
    expect(fields.every((f) => f.feature.geometry.type === "Polygon")).toBe(true);
    expect(fields[2]!.cadastralNumber).toBe("05-000-000-002");
  });

  it("accepts a bare geometry and names fields by position", () => {
    const fields = explodeFields({ type: "Polygon", coordinates: [ring(1, 1)] });
    expect(fields).toHaveLength(1);
    expect(fields[0]!.name).toBe("Field 1");
  });

  it("refuses files without polygons and imports above the cap", () => {
    expect(() => explodeFields({ type: "FeatureCollection", features: [] })).toThrow(/no field boundaries/i);
    const many = { type: "MultiPolygon", coordinates: Array.from({ length: 65 }, (_, i) => [ring(i, 1)]) };
    expect(() => explodeFields(many)).toThrow(/at most 64/);
  });
});

describe("parseFieldFile", () => {
  it("reads GeoJSON or KML by name and content", () => {
    expect(parseFieldFile("a.kml", KML, new DOMParser())).toHaveLength(3);
    expect(parseFieldFile("a.geojson", JSON.stringify({ type: "Polygon", coordinates: [ring(1, 1)] }), new DOMParser())).toHaveLength(1);
    expect(() => parseFieldFile("a.geojson", "{oops", new DOMParser())).toThrow(FieldImportError);
  });
});

describe("cadastral numbers and area check", () => {
  it("finds a cadastral number under common property names", () => {
    expect(cadastralOf({ cadastral: "1" })).toBe("1");
    expect(cadastralOf({ "Кадастровый номер": "2" })).toBe("2");
    expect(cadastralOf({ KAD_NOMER: 3 })).toBe("3");
    expect(cadastralOf({ name: "x" })).toBeNull();
  });

  it("flags a polygon whose area differs from the declared area by more than 5%", () => {
    expect(areaCheck(100, 103)).toMatchObject({ ok: true });
    expect(areaCheck(100, 110)).toMatchObject({ ok: false, deltaPct: -9.1 });
    expect(areaCheck(100, null)).toMatchObject({ ok: true, deltaPct: null });
  });
});
