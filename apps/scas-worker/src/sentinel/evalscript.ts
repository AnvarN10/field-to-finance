/**
 * Per-pixel NDVI with Sentinel-2 L2A scene classification (SCL) cloud masking.
 * Two outputs with separate data masks:
 * - footprint: 1 for every polygon pixel that has data that day,
 * - ndvi: NDVI for clear polygon pixels only.
 * SCL classes treated as not clear: 0 no data, 1 saturated or defective,
 * 3 cloud shadow, 8 cloud medium probability, 9 cloud high probability,
 * 10 thin cirrus, 11 snow or ice.
 */
export const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "footprint", bands: 1, sampleType: "UINT8" },
      { id: "dataMask", bands: ["ndvi", "footprint"] }
    ]
  };
}
var NOT_CLEAR = [0, 1, 3, 8, 9, 10, 11];
function evaluatePixel(s) {
  var sum = s.B08 + s.B04;
  var clear = NOT_CLEAR.indexOf(s.SCL) === -1 && sum !== 0 ? 1 : 0;
  var ndvi = sum === 0 ? 0 : (s.B08 - s.B04) / sum;
  return { ndvi: [ndvi], footprint: [1], dataMask: [s.dataMask * clear, s.dataMask] };
}
`;
