export function pack(part: BlobPart, prefix?: BlobPart) {
  const header = new DataView(new ArrayBuffer(4));
  const blob = new Blob([part]);
  header.setUint32(0, blob.size, true);
  return new Blob(prefix ? [prefix, header, part] : [header, part]);
}

export function packJSON(json: any, prefix?: BlobPart) {
  return pack(JSON.stringify(json), prefix);
}

export function readBytes(
  source: Blob,
  bytes: number
): Promise<[result: Blob, remainder: Blob]>;

export function readBytes(
  source: ReadableStream<Blob>,
  bytes: number
): Promise<[result: Blob, remainder: ReadableStream<Blob>]>;

export function readBytes(
  source: Blob | ReadableStream<Blob>,
  bytes: number
): Promise<[result: Blob, remainder: Blob | ReadableStream<Blob>]>;

export async function readBytes(
  source: Blob | ReadableStream<Blob>,
  bytes: number
): Promise<[result: Blob, remainder: Blob | ReadableStream<Blob>]> {
  if (source instanceof Blob) {
    return [source.slice(0, bytes), source.slice(bytes)];
  }

  const reader = source.getReader();
  const chunks: Blob[] = [];
  let remaining = bytes;
  let remainderChunks: Blob[] = [];

  while (remaining > 0) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = value.slice(0, remaining);
    chunks.push(chunk);

    if (chunk.size < value.size) {
      remainderChunks.push(value.slice(chunk.size));
    }

    remaining -= chunk.size;
  }

  if (!remainderChunks.length) {
    return [new Blob(chunks), source];
  }

  const t = new TransformStream();
  const writer = t.writable.getWriter();
  for (const chunk of remainderChunks) {
    await writer.write(chunk);
  }

  writer.close();
  source.pipeTo(t.writable);
  return [new Blob(chunks), t.readable];
}

export function readBlob(
  source: Blob
): Promise<[result: Blob, remainder: Blob]>;

export function readBlob(
  source: ReadableStream<Blob>
): Promise<[result: Blob, remainder: ReadableStream<Blob>]>;

export function readBlob(
  source: Blob | ReadableStream<Blob>
): Promise<[result: Blob, remainder: Blob | ReadableStream<Blob>]>;

export async function readBlob(
  source: Blob | ReadableStream<Blob>
): Promise<[result: Blob, remainder: Blob | ReadableStream<Blob>]> {
  const [header, remainder] = await readBytes(source, 4);
  const size = new DataView(await header.arrayBuffer()).getUint32(0, true);
  return readBytes(remainder, size);
}

export function readText(
  source: Blob
): Promise<[result: string, remainder: Blob]>;

export function readText(
  source: ReadableStream<Blob>
): Promise<[result: string, remainder: ReadableStream<Blob>]>;

export function readText(
  source: Blob | ReadableStream<Blob>
): Promise<[result: string, remainder: Blob | ReadableStream<Blob>]>;

export async function readText(
  source: Blob | ReadableStream<Blob>
): Promise<[result: string, remainder: Blob | ReadableStream<Blob>]> {
  const [blob, remainder] = await readBlob(source);
  return [await blob.text(), remainder];
}

export function readJSON(source: Blob): Promise<[result: any, remainder: Blob]>;

export function readJSON(
  source: ReadableStream<Blob>
): Promise<[result: any, remainder: ReadableStream<Blob>]>;

export function readJSON(
  source: Blob | ReadableStream<Blob>
): Promise<[result: any, remainder: Blob | ReadableStream<Blob>]>;

export async function readJSON(
  source: Blob | ReadableStream<Blob>
): Promise<[result: any, remainder: Blob | ReadableStream<Blob>]> {
  const [text, remainder] = await readText(source);
  return [JSON.parse(text), remainder];
}
