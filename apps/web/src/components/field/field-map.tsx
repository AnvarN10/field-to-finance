"use client";

import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { FIELD_CASING, FIELD_STROKE, MAPLIBRE_WORKER_URL, polygonBounds, satelliteStyle } from "../../lib/map";

maplibregl.setWorkerUrl(MAPLIBRE_WORKER_URL);

export function FieldMap({ polygons, height = 360, bare = false }: { polygons: { coordinates: number[][][] }[]; height?: number; bare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bounds = polygonBounds(polygons);
    if (!ref.current || !bounds) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: satelliteStyle(),
      bounds,
      fitBoundsOptions: { padding: 48, maxZoom: 16 },
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource("fields", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: polygons.map((p, i) => ({ type: "Feature", properties: { i }, geometry: { type: "Polygon", coordinates: p.coordinates } })),
        },
      });
      // Wheat (style-lock primary) reads on green and brown imagery; a dark casing keeps the edge visible on pale fields.
      map.addLayer({ id: "fields-fill", type: "fill", source: "fields", paint: { "fill-color": FIELD_STROKE, "fill-opacity": 0.14 } });
      map.addLayer({ id: "fields-casing", type: "line", source: "fields", paint: { "line-color": FIELD_CASING, "line-width": 4, "line-opacity": 0.55 } });
      map.addLayer({ id: "fields-line", type: "line", source: "fields", paint: { "line-color": FIELD_STROKE, "line-width": 2 } });
    });
    return () => map.remove();
  }, [polygons]);

  return <div ref={ref} role="region" aria-label="Field boundary over satellite imagery" style={{ height }} className={`w-full overflow-hidden ${bare ? "rounded-md" : "rounded-lg border border-border bg-card"}`} />;
}
