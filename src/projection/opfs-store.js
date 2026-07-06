// The OPFS-backed local materialization editors read from (Part 3, Layer 4:
// "writes each EO entry and the folded Meant-Graph into an OPFS-backed
// store, then renders from OPFS, which gives instant local reads and
// offline capability"). OPFS (navigator.storage.getDirectory()) is a
// browser-only API — this module is the store interface plus a real
// browser-backed implementation. createInMemoryOPFSStore is the reference
// implementation this repo's own tests run against, playing the same role
// for local-projection.js that InMemoryLog plays for the kernel log
// adapter.

const ENTRIES_DIR = 'entries';
const MEANT_GRAPH_FILE = 'meant-graph.json';

export function assertOPFSStore(store) {
  for (const method of ['writeEntry', 'readEntry', 'listEntries', 'writeMeantGraph', 'readMeantGraph']) {
    if (!store || typeof store[method] !== 'function') {
      throw new TypeError(`OPFS store missing required method: ${method}`);
    }
  }
  return store;
}

export function createInMemoryOPFSStore() {
  const entries = new Map();
  let meantGraph = null;
  return {
    async writeEntry(id, entry) {
      entries.set(id, entry);
    },
    async readEntry(id) {
      return entries.has(id) ? entries.get(id) : null;
    },
    async listEntries() {
      return Array.from(entries, ([id, entry]) => ({ id, entry }));
    },
    async writeMeantGraph(graph) {
      meantGraph = graph;
    },
    async readMeantGraph() {
      return meantGraph;
    },
  };
}

// Real, browser-only implementation over navigator.storage.getDirectory().
// Each entry is its own file (entries/<id>.json) so writing one entry
// doesn't require rewriting the whole store; the folded Meant-Graph is one
// file (meant-graph.json) since it's always read/written as a unit.
export async function createOPFSStore({ rootDirName = 'eo-substrate' } = {}) {
  if (typeof navigator === 'undefined' || !navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
    throw new Error(
      'createOPFSStore requires a browser with Origin Private File System support (navigator.storage.getDirectory); use createInMemoryOPFSStore outside a browser',
    );
  }
  const opfsRoot = await navigator.storage.getDirectory();
  const root = await opfsRoot.getDirectoryHandle(rootDirName, { create: true });
  const entriesDir = await root.getDirectoryHandle(ENTRIES_DIR, { create: true });

  async function writeJSON(dirHandle, filename, value) {
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(value));
    await writable.close();
  }

  async function readJSON(dirHandle, filename) {
    try {
      const fileHandle = await dirHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return JSON.parse(await file.text());
    } catch (err) {
      if (err && err.name === 'NotFoundError') return null;
      throw err;
    }
  }

  function entryFilename(id) {
    return `${encodeURIComponent(id)}.json`;
  }

  return {
    async writeEntry(id, entry) {
      await writeJSON(entriesDir, entryFilename(id), entry);
    },
    async readEntry(id) {
      return readJSON(entriesDir, entryFilename(id));
    },
    async listEntries() {
      const out = [];
      for await (const [name, handle] of entriesDir.entries()) {
        if (handle.kind !== 'file') continue;
        const file = await handle.getFile();
        out.push({ id: decodeURIComponent(name.replace(/\.json$/, '')), entry: JSON.parse(await file.text()) });
      }
      return out;
    },
    async writeMeantGraph(graph) {
      await writeJSON(root, MEANT_GRAPH_FILE, graph);
    },
    async readMeantGraph() {
      return readJSON(root, MEANT_GRAPH_FILE);
    },
  };
}
