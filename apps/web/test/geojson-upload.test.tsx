// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GeojsonUpload } from "../src/components/farmer/geojson-upload";
import { FIELD_A, FIELD_B, MULTI } from "./fixtures/polygons";

beforeEach(() => {
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      n += 1;
      return Response.json({ polygonHash: String(n).repeat(64).slice(0, 64), areaHa: 56.01, areaHaX100: 5601, polygon: FIELD_A.geometry });
    }),
  );
});

const file = (obj: unknown, name = "fields.geojson") => new File([JSON.stringify(obj)], name, { type: "application/geo+json" });

describe("GeojsonUpload", () => {
  it("uploads each feature as its own field and reports the computed area", async () => {
    const onUploaded = vi.fn();
    render(<GeojsonUpload onUploaded={onUploaded} />);
    await userEvent.upload(screen.getByLabelText("Field boundaries (GeoJSON)"), file({ type: "FeatureCollection", features: [FIELD_A, FIELD_B] }));
    expect(await screen.findByText("2 fields ready")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(2);
    const fields = onUploaded.mock.calls.at(-1)![0];
    expect(fields).toHaveLength(2);
    expect(fields[0]).toMatchObject({ name: "Demo field A", areaHaX100: 5601, declaredHa: "56.01" });
  });

  it("explains a MultiPolygon instead of uploading it", async () => {
    render(<GeojsonUpload onUploaded={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText("Field boundaries (GeoJSON)"), file(MULTI));
    expect(await screen.findByRole("alert")).toHaveTextContent("Field 1 is a MultiPolygon. Split it into one Polygon per field.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a file that is not JSON", async () => {
    render(<GeojsonUpload onUploaded={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText("Field boundaries (GeoJSON)"), new File(["not json"], "x.geojson"));
    expect(await screen.findByRole("alert")).toHaveTextContent("The file is not valid JSON. Export the boundaries as GeoJSON, or use the sample file.");
  });
});
