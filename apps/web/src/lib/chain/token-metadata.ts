/**
 * Token-2022 TokenMetadata extension value: update_authority (32), mint (32),
 * then name, symbol, uri as u32-LE-length-prefixed UTF-8, then additional metadata.
 */
export function parseTokenMetadata(data: Uint8Array): { name: string; symbol: string; uri: string } {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 64;
  const next = (): string => {
    if (offset + 4 > data.length) throw new RangeError("token metadata truncated");
    const len = view.getUint32(offset, true);
    offset += 4;
    if (offset + len > data.length) throw new RangeError("token metadata truncated");
    const s = new TextDecoder().decode(data.subarray(offset, offset + len));
    offset += len;
    return s;
  };
  return { name: next(), symbol: next(), uri: next() };
}
